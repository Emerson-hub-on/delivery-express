'use client'
import { useRef, useState } from 'react'
import { Product, CategoryItem, ICMS_CSOSN, PIS_COFINS_CST, UnitCom } from '@/types/product'
import { AddonSection } from '@/components/products/AddonSection'

interface ProductFormProps {
  form: Omit<Product, 'id'>
  editingId: number | null
  categories: CategoryItem[]
  loadingCats: boolean
  saving: boolean
  uploading: boolean
  imagePreview: string | null
  onFieldChange: (field: keyof Omit<Product, 'id'>, value: string | number | boolean) => void
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: () => void
  onCancel: () => void
  onGoToCategories: () => void
}

const UNIT_OPTIONS: { value: UnitCom; label: string }[] = [
  { value: 'UN', label: 'UN — Unidade' },
  { value: 'KG', label: 'KG — Quilograma' },
  { value: 'G',  label: 'G — Grama' },
  { value: 'L',  label: 'L — Litro' },
  { value: 'ML', label: 'ML — Mililitro' },
  { value: 'CX', label: 'CX — Caixa' },
  { value: 'PCT', label: 'PCT — Pacote' },
  { value: 'M',  label: 'M — Metro' },
  { value: 'M2', label: 'M² — Metro quadrado' },
]

const CFOP_OPTIONS = [
  { value: '5101', label: '5101 — Venda de produção própria (dentro do estado)' },
  { value: '5102', label: '5102 — Venda de mercadoria de terceiros (dentro do estado)' },
  { value: '5405', label: '5405 — Venda com substituição tributária (dentro do estado)' },
  { value: '6101', label: '6101 — Venda de produção própria (fora do estado)' },
  { value: '6102', label: '6102 — Venda de mercadoria de terceiros (fora do estado)' },
]

const CSOSN_OPTIONS: { value: ICMS_CSOSN; label: string }[] = [
  { value: '102', label: '102 — Tributada pelo SN sem crédito' },
  { value: '103', label: '103 — Isenção para faixa de receita bruta' },
  { value: '300', label: '300 — Imune' },
  { value: '400', label: '400 — Não tributada pelo Simples Nacional' },
  { value: '500', label: '500 — ICMS cobrado anteriormente por ST' },
  { value: '900', label: '900 — Outros (com alíquota ICMS)' },
]

const PIS_COFINS_CST_OPTIONS: { value: PIS_COFINS_CST; label: string }[] = [
  { value: '07', label: '07 — Operação isenta (Simples Nacional)' },
  { value: '08', label: '08 — Sem incidência' },
  { value: '01', label: '01 — Tributável alíquota básica' },
  { value: '02', label: '02 — Tributável alíquota diferenciada' },
  { value: '49', label: '49 — Outras saídas' },
]

const ORIGEM_OPTIONS = [
  { value: 0, label: '0 — Nacional' },
  { value: 1, label: '1 — Estrangeira — Importação direta' },
  { value: 2, label: '2 — Estrangeira — Adquirida no mercado interno' },
  { value: 3, label: '3 — Nacional com mais de 40% de conteúdo estrangeiro' },
  { value: 4, label: '4 — Nacional produção conforme básico' },
  { value: 5, label: '5 — Nacional com menos de 40% de conteúdo estrangeiro' },
]

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-1">
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  )
}

function InputCls() {
  return 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black'
}

export function ProductForm({
  form,
  editingId,
  categories,
  loadingCats,
  saving,
  uploading,
  imagePreview,
  onFieldChange,
  onImageChange,
  onSubmit,
  onCancel,
  onGoToCategories,
}: ProductFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fiscalOpen, setFiscalOpen] = useState(false)

  // Detecta se algum campo fiscal já está preenchido (modo edição)
  const hasFiscalData = !!(form.ncm || form.cfop || form.icms_csosn)

  const inputCls = InputCls()

  // NCM: aplica máscara XXXX.XX.XX enquanto digita
  const handleNcm = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    onFieldChange('ncm', digits)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="text-base font-medium text-gray-900 mb-4">
        {editingId !== null ? 'Editar produto' : 'Novo produto'}
      </h2>

      {/* ── Campos principais ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Imagem */}
        <div className="sm:col-span-2">
          <FieldLabel>Imagem</FieldLabel>
          <div className="flex items-center gap-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-400 transition-colors flex-shrink-0"
            >
              {imagePreview
                ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                : <span style={{ fontSize: 28, color: '#d1d5db' }}>+</span>}
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {uploading ? 'Enviando...' : imagePreview ? 'Trocar imagem' : 'Escolher imagem'}
              </button>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG ou WEBP — máx. 2MB</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageChange} />
          </div>
        </div>

        {/* Nome */}
        <div>
          <FieldLabel required>Nome</FieldLabel>
          <input
            type="text"
            placeholder="Ex: Sushi Salmão"
            value={form.name}
            onChange={e => onFieldChange('name', e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Categoria */}
        <div>
          <FieldLabel required>Categoria</FieldLabel>
          {loadingCats ? (
            <div className="text-xs text-gray-400 py-2">Carregando categorias...</div>
          ) : (
            <select
              value={form.category}
              onChange={e => onFieldChange('category', e.target.value)}
              className={inputCls}
            >
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.label}</option>
              ))}
            </select>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Gerencie categorias na aba{' '}
            <button onClick={onGoToCategories} className="underline hover:text-gray-600">Categorias</button>
          </p>
        </div>

        {/* Preço */}
        <div>
          <FieldLabel required>Preço (R$)</FieldLabel>
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Ex: 49.90"
            value={form.price || ''}
            onChange={e => onFieldChange('price', Number(e.target.value))}
            className={inputCls}
          />
        </div>

        {/* Descrição */}
        <div>
          <FieldLabel>Descrição</FieldLabel>
          <input
            type="text"
            placeholder="Ex: 8 peças de salmão com cream cheese"
            value={form.description || ''}
            onChange={e => onFieldChange('description', e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Ativo */}
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            id="active-toggle"
            type="checkbox"
            checked={form.active ?? true}
            onChange={e => onFieldChange('active', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-black"
          />
          <label htmlFor="active-toggle" className="text-sm text-gray-600 select-none cursor-pointer">
            Produto ativo (visível no cardápio)
          </label>
        </div>
      </div>
      {editingId !== null && <AddonSection productId={editingId} />}

      {/* ── Seção Fiscal (colapsável) ────────────────────────── */}
      <div className="mt-6 border border-gray-100 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setFiscalOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Dados Fiscais</span>
            {hasFiscalData && !fiscalOpen && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                Preenchido
              </span>
            )}
            {!hasFiscalData && !fiscalOpen && (
              <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                Necessário para emitir NFC-e
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${fiscalOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {fiscalOpen && (
          <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white">

            {/* NCM */}
            <div>
              <FieldLabel required>NCM</FieldLabel>
              <input
                type="text"
                placeholder="Ex: 21069090"
                maxLength={8}
                value={form.ncm || ''}
                onChange={e => handleNcm(e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">8 dígitos — Nomenclatura Comum do Mercosul</p>
            </div>

            {/* CEST */}
            <div>
              <FieldLabel>CEST</FieldLabel>
              <input
                type="text"
                placeholder="Ex: 1700100"
                maxLength={7}
                value={form.cest || ''}
                onChange={e => onFieldChange('cest', e.target.value.replace(/\D/g, '').slice(0, 7))}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">7 dígitos — somente se houver ST</p>
            </div>

            {/* CFOP */}
            <div>
              <FieldLabel required>CFOP</FieldLabel>
              <select
                value={form.cfop || '5102'}
                onChange={e => onFieldChange('cfop', e.target.value)}
                className={inputCls}
              >
                {CFOP_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Unidade comercial */}
            <div>
              <FieldLabel required>Unidade comercial</FieldLabel>
              <select
                value={form.unit_com || 'UN'}
                onChange={e => onFieldChange('unit_com', e.target.value)}
                className={inputCls}
              >
                {UNIT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Unidade tributável */}
            <div>
              <FieldLabel>Unidade tributável</FieldLabel>
              <select
                value={form.unit_trib || ''}
                onChange={e => onFieldChange('unit_trib', e.target.value)}
                className={inputCls}
              >
                <option value="">Igual à unidade comercial</option>
                {UNIT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Somente quando diferente</p>
            </div>

            {/* Origem */}
            <div>
              <FieldLabel required>Origem</FieldLabel>
              <select
                value={form.origem ?? 0}
                onChange={e => onFieldChange('origem', Number(e.target.value))}
                className={inputCls}
              >
                {ORIGEM_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Divisor visual */}
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">ICMS – Simples Nacional</p>
              <div className="border-t border-gray-100 mt-2" />
            </div>

            {/* CSOSN */}
            <div className="sm:col-span-2">
              <FieldLabel required>CSOSN</FieldLabel>
              <select
                value={form.icms_csosn || '400'}
                onChange={e => onFieldChange('icms_csosn', e.target.value)}
                className={inputCls}
              >
                {CSOSN_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Para a maioria dos estabelecimentos alimentícios no Simples: <strong>400</strong>
              </p>
            </div>

            {/* Alíquota ICMS — somente CSOSN 900 */}
            {form.icms_csosn === '900' && (
              <div>
                <FieldLabel>Alíquota ICMS (%)</FieldLabel>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  placeholder="Ex: 12.00"
                  value={form.icms_aliq ?? ''}
                  onChange={e => onFieldChange('icms_aliq', Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            )}

            {/* Divisor PIS/COFINS */}
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">PIS / COFINS</p>
              <div className="border-t border-gray-100 mt-2" />
            </div>

            {/* PIS CST */}
            <div>
              <FieldLabel required>CST do PIS</FieldLabel>
              <select
                value={form.pis_cst || '07'}
                onChange={e => onFieldChange('pis_cst', e.target.value)}
                className={inputCls}
              >
                {PIS_COFINS_CST_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* PIS alíquota */}
            <div>
              <FieldLabel>Alíquota PIS (%)</FieldLabel>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                placeholder="0.00"
                value={form.pis_aliq ?? 0}
                onChange={e => onFieldChange('pis_aliq', Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">0% para Simples Nacional</p>
            </div>

            {/* Spacer no grid de 3 colunas */}
            <div className="hidden lg:block" />

            {/* COFINS CST */}
            <div>
              <FieldLabel required>CST do COFINS</FieldLabel>
              <select
                value={form.cofins_cst || '07'}
                onChange={e => onFieldChange('cofins_cst', e.target.value)}
                className={inputCls}
              >
                {PIS_COFINS_CST_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* COFINS alíquota */}
            <div>
              <FieldLabel>Alíquota COFINS (%)</FieldLabel>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                placeholder="0.00"
                value={form.cofins_aliq ?? 0}
                onChange={e => onFieldChange('cofins_aliq', Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">0% para Simples Nacional</p>
            </div>

            {/* Dica fiscal */}
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 leading-relaxed">
                <strong>Simples Nacional:</strong> na maioria dos casos, use CSOSN <strong>400</strong>,
                CST PIS/COFINS <strong>07</strong> e alíquotas <strong>0%</strong>.
                Consulte seu contador para confirmar o NCM e o CFOP corretos para cada produto.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Ações ────────────────────────────────────────────── */}
      <div className="flex gap-3 mt-5">
        <button
          onClick={onSubmit}
          disabled={saving || uploading}
          className="bg-black text-white text-sm px-5 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvando...' : editingId !== null ? 'Salvar alterações' : 'Criar produto'}
        </button>
        <button
          onClick={onCancel}
          className="text-sm px-5 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
