'use client'
import { useRef, useState } from 'react'
import { Product, CategoryItem, ICMS_CSOSN, PIS_COFINS_CST, UnitCom, ProductSize } from '@/types/product'
import { AddonSection } from '@/components/products/AddonSection'
import { ProductSizeStock } from '@/components/products/ProductSizeStock'
import { VariantSection } from '../products/VariantSection'

interface ProductFormProps {
  form: Omit<Product, 'id' | 'code'>
  editingId: number | null
  companyId: string | null
  categories: CategoryItem[]
  loadingCats: boolean
  saving: boolean
  uploading: boolean
  imagePreview: string | null
  onFieldChange: (
    field: keyof Omit<Product, 'id' | 'code'>,
    value: string | number | boolean | null | ProductSize[]
  ) => void
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: () => void
  onCancel: () => void
  onGoToCategories: () => void
}

const UNIT_OPTIONS: { value: UnitCom; label: string }[] = [
  { value: 'UN',  label: 'UN — Unidade' },
  { value: 'KG',  label: 'KG — Quilograma' },
  { value: 'G',   label: 'G — Grama' },
  { value: 'L',   label: 'L — Litro' },
  { value: 'ML',  label: 'ML — Mililitro' },
  { value: 'CX',  label: 'CX — Caixa' },
  { value: 'PCT', label: 'PCT — Pacote' },
  { value: 'M',   label: 'M — Metro' },
  { value: 'M2',  label: 'M² — Metro quadrado' },
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

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black'

type Tab = 'geral' | 'fiscal'

export function ProductForm({
  form,
  editingId,
  companyId,
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
  const [activeTab, setActiveTab] = useState<Tab>('geral')

  const currentCategory = categories.find(c => c.name === form.category)
  const availableSizes  = currentCategory?.sizes ?? []
  const hasFiscalData   = !!(form.ncm || form.cfop || form.icms_csosn)

  const handleNcm = (raw: string) => {
    onFieldChange('ncm', raw.replace(/\D/g, '').slice(0, 8))
  }

  return (
    <div className="flex flex-col">

      {/* ── Abas ── */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('geral')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
            ${activeTab === 'geral'
              ? 'border-black text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Dados Gerais
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('fiscal')}
          className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
            ${activeTab === 'fiscal'
              ? 'border-black text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Dados Fiscais
          {!hasFiscalData && (
            <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold leading-none">
              Pendente
            </span>
          )}
          {hasFiscalData && (
            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold leading-none">
              ✓
            </span>
          )}
        </button>
      </div>

      {/* ── Aba: Dados Gerais ── */}
      {activeTab === 'geral' && (
        <div className="flex flex-col gap-6">

          {/* campos principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Imagem */}
            <div className="sm:col-span-2">
              <FieldLabel>Imagem</FieldLabel>
              <div className="flex items-center gap-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-400 transition-colors shrink-0"
                >
                  {imagePreview
                    ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                    : <span className="text-3xl text-gray-300">+</span>}
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
                placeholder="Ex: Camisa Básica"
                value={form.name}
                onChange={e => onFieldChange('name', e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Categoria */}
            <div>
              <FieldLabel>Categoria</FieldLabel>
              {loadingCats ? (
                <div className="text-xs text-gray-400 py-2">Carregando categorias...</div>
              ) : (
                <select
                  value={form.category}
                  onChange={e => {
                    onFieldChange('category', e.target.value)
                    const cat = categories.find(c => c.name === e.target.value)
                    if (cat?.sizes?.length) {
                      onFieldChange('stock', null)
                      onFieldChange('sizes', [])
                    } else {
                      onFieldChange('sizes', null)
                    }
                  }}
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

            {/* EAN */}
            <div>
              <FieldLabel>EAN / Código de barras</FieldLabel>
              <input
                type="text"
                placeholder="Ex: 7891234567890"
                maxLength={14}
                value={form.ean ?? ''}
                onChange={e => onFieldChange('ean', e.target.value.replace(/\D/g, '').slice(0, 14) || null)}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">Opcional — EAN-8, EAN-13 ou EAN-14</p>
            </div>

            {/* Preço de custo */}
            <div>
              <FieldLabel>Preço de custo (R$)</FieldLabel>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Ex: 12.50"
                value={form.cost_price ?? ''}
                onChange={e => onFieldChange('cost_price', e.target.value === '' ? null : Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">Opcional — usado para calcular margem</p>
            </div>

            {/* Preço de venda */}
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
                placeholder="Ex: Camisa tradicional manga curta"
                value={form.description || ''}
                onChange={e => onFieldChange('description', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Agora em modo de edição com categoria sem tamanhos, 
          aparece o campo de estoque do produto 
          (que edita form.stock) e logo abaixo o VariantSection 
          para gerenciar cores. O usuário pode usar um ou outro 
          — se tiver variantes de cor cadastradas, o estoque por 
          cor prevalece; se não tiver, o form.stock é o controle 
          simples. A nota explicativa deixa isso claro pra quem 
          for usar. */}
          
          {/* Estoque / Tamanhos / Variantes */}
          {editingId !== null && companyId ? (
            <>
              {/* Estoque simples — só quando a categoria não tem tamanhos */}
              {availableSizes.length === 0 && (
                <div>
                  <FieldLabel>Estoque</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    placeholder="Deixe vazio para não controlar"
                    value={form.stock ?? ''}
                    onChange={e => onFieldChange('stock', e.target.value === '' ? null : Number(e.target.value))}
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Deixe vazio para não controlar estoque deste produto diretamente.
                    Se adicionar variantes de cor abaixo, o estoque passará a ser controlado por cor.
                  </p>
                </div>
              )}

              {/* Variantes de cor (com ou sem tamanhos) */}
              <VariantSection
                productId={editingId}
                companyId={companyId}
                availableSizes={availableSizes}
              />
            </>
          ) : availableSizes.length > 0 ? (
            <div>
              <ProductSizeStock
                availableSizes={availableSizes}
                value={form.sizes ?? []}
                onChange={sizes => onFieldChange('sizes', sizes)}
              />
              <p className="text-xs text-amber-600 mt-2">
                💡 Variantes de cor ficam disponíveis após salvar o produto.
              </p>
            </div>
          ) : (
            <div>
              <FieldLabel>Estoque</FieldLabel>
              <input
                type="number"
                min={0}
                step="1"
                placeholder="Deixe vazio para não controlar"
                value={form.stock ?? ''}
                onChange={e => onFieldChange('stock', e.target.value === '' ? null : Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">Deixe vazio para não controlar estoque</p>
              <p className="text-xs text-amber-600 mt-1">
                💡 Variantes de cor ficam disponíveis após salvar o produto.
              </p>
            </div>
          )}

          {/* Addons */}
          {editingId !== null && <AddonSection productId={editingId} />}
        </div>
      )}

      {/* ── Aba: Dados Fiscais ── */}
      {activeTab === 'fiscal' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* NCM */}
          <div>
            <FieldLabel required>NCM</FieldLabel>
            <input
              type="text"
              placeholder="Ex: 61051000"
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
              {CFOP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
              {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
              {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Somente quando diferente</p>
          </div>

          {/* Fator de conversão */}
          {form.unit_trib && (
            <div>
              <FieldLabel>Fator de conversão</FieldLabel>
              <input
                type="number"
                min={1}
                step={1}
                value={form.fator_conversao ?? 1}
                onChange={e => onFieldChange('fator_conversao', Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">Ex: 1 CX = 12 UN → fator 12</p>
            </div>
          )}

          {/* Origem */}
          <div>
            <FieldLabel required>Origem</FieldLabel>
            <select
              value={form.origem ?? 0}
              onChange={e => onFieldChange('origem', Number(e.target.value))}
              className={inputCls}
            >
              {ORIGEM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Escala relevante */}
          <div>
            <FieldLabel required>Escala Relevante</FieldLabel>
            <select
              value={form.ind_escala ?? 'S'}
              onChange={e => onFieldChange('ind_escala', e.target.value)}
              className={inputCls}
            >
              <option value="S">S — Produção em escala relevante</option>
              <option value="N">N — Não produzido em escala (sob encomenda)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Padrão <strong>S</strong> para a maioria dos produtos</p>
          </div>

          {/* CNPJ Fabricante */}
          {form.ind_escala === 'N' && (
            <div>
              <FieldLabel required>CNPJ do Fabricante</FieldLabel>
              <input
                type="text"
                placeholder="Ex: 12345678000195"
                maxLength={14}
                value={form.cnpj_fabricante ?? ''}
                onChange={e => onFieldChange('cnpj_fabricante', e.target.value.replace(/\D/g, '').slice(0, 14) || null)}
                className={inputCls}
              />
            </div>
          )}

          {/* Divisor ICMS */}
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">ICMS – Simples Nacional</p>
              <div className="flex-1 border-t border-gray-100" />
            </div>
          </div>

          {/* CSOSN */}
          <div className="sm:col-span-2">
            <FieldLabel required>CSOSN</FieldLabel>
            <select
              value={form.icms_csosn || '400'}
              onChange={e => onFieldChange('icms_csosn', e.target.value)}
              className={inputCls}
            >
              {CSOSN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Para a maioria dos estabelecimentos no Simples: <strong>400</strong>
            </p>
          </div>

          {/* Alíquota ICMS */}
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
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">PIS / COFINS</p>
              <div className="flex-1 border-t border-gray-100" />
            </div>
          </div>

          {/* PIS CST */}
          <div>
            <FieldLabel required>CST do PIS</FieldLabel>
            <select
              value={form.pis_cst || '07'}
              onChange={e => onFieldChange('pis_cst', e.target.value)}
              className={inputCls}
            >
              {PIS_COFINS_CST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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

          <div className="hidden lg:block" />

          {/* COFINS CST */}
          <div>
            <FieldLabel required>CST do COFINS</FieldLabel>
            <select
              value={form.cofins_cst || '07'}
              onChange={e => onFieldChange('cofins_cst', e.target.value)}
              className={inputCls}
            >
              {PIS_COFINS_CST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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

          {/* Dica */}
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 leading-relaxed">
              <strong>Simples Nacional:</strong> na maioria dos casos, use CSOSN <strong>400</strong>,
              CST PIS/COFINS <strong>07</strong> e alíquotas <strong>0%</strong>.
              Consulte seu contador para confirmar o NCM e o CFOP corretos para cada produto.
            </div>
          </div>
        </div>
      )}

      {/* ── Ações ── */}
      <div className="flex gap-3 mt-8 pt-5 border-t border-gray-100">
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