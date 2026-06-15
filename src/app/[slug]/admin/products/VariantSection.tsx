'use client'
import { useState, useEffect } from 'react'
import { ProductColor, ProductVariant, ProductSize } from '@/types/product'
import {
  getVariantsByProduct, getColors, createColor,
  upsertVariant, deleteVariant, toggleVariant
} from '@/services/productVariants'
import { ProductSizeStock } from '@/components/products/ProductSizeStock'

interface Props {
  productId: number
  companyId: string
  availableSizes: string[]   // vindo da categoria
}

// ── Modal de seleção / criação de cor ─────────────────────────
function ColorPickerModal({
  colors,
  onSelect,
  onCreate,
  onClose,
}: {
  colors: ProductColor[]
  onSelect: (color: ProductColor) => void
  onCreate: (name: string, hex?: string) => Promise<ProductColor>
  onClose: () => void
}) {
  const [newName, setNewName] = useState('')
  const [newHex, setNewHex] = useState('#000000')
  const [creating, setCreating] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const color = await onCreate(newName, newHex)
    onSelect(color)
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Selecionar cor</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {/* Lista de cores existentes */}
        {colors.length > 0 && (
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {colors.map(c => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 
                           hover:border-gray-400 text-xs font-medium transition-colors"
              >
                {c.hex_code && (
                  <span
                    className="w-3 h-3 rounded-full border border-gray-200 shrink-0"
                    style={{ background: c.hex_code }}
                  />
                )}
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 pt-3">
          {!showNew ? (
            <button
              onClick={() => setShowNew(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Cadastrar nova cor
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: VERDE MILITAR"
                  value={newName}
                  onChange={e => setNewName(e.target.value.toUpperCase())}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm 
                             focus:outline-none focus:ring-2 focus:ring-black"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={newHex}
                    onChange={e => setNewHex(e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer border border-gray-200"
                    title="Cor opcional"
                  />
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="bg-black text-white text-sm px-4 py-2 rounded-lg 
                           hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Criando...' : 'Criar e adicionar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────
export function VariantSection({ productId, companyId, availableSizes }: Props) {
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [colors, setColors] = useState<ProductColor[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)   // color_id sendo salvo

  useEffect(() => {
    Promise.all([
      getVariantsByProduct(productId),
      getColors(companyId),
    ]).then(([v, c]) => {
      setVariants(v)
      setColors(c)
      setLoading(false)
    })
  }, [productId, companyId])

  const existingColorIds = new Set(variants.map(v => v.color_id))
  const availableColors = colors.filter(c => !existingColorIds.has(c.id))

  const handleSelectColor = async (color: ProductColor) => {
    setShowModal(false)
    setSaving(color.id)
    const variant = await upsertVariant(productId, color.id, { stock: null, sizes: [] })
    setVariants(prev => [...prev, variant])
    setSaving(null)
  }

  const handleCreateColor = async (name: string, hex?: string) => {
    const color = await createColor(companyId, name, hex)
    setColors(prev => [...prev, color])
    return color
  }

  const handleSaveVariant = async (
    variantId: number,
    colorId: number,
    payload: { sizes?: ProductSize[] | null; stock?: number | null; image?: string | null }
  ) => {
    setSaving(colorId)
    const updated = await upsertVariant(productId, colorId, payload)
    setVariants(prev => prev.map(v => v.id === variantId ? updated : v))
    setSaving(null)
  }

  const handleDelete = async (variantId: number) => {
    await deleteVariant(variantId)
    setVariants(prev => prev.filter(v => v.id !== variantId))
  }

  const handleToggle = async (variantId: number, active: boolean) => {
    await toggleVariant(variantId, active)
    setVariants(prev => prev.map(v => v.id === variantId ? { ...v, active } : v))
  }

  if (loading) return <div className="text-xs text-gray-400 py-2">Carregando variantes...</div>

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-gray-700">Variantes de cor</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Cada cor pode ter tamanhos e estoques independentes
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-sm bg-black text-white px-3 py-1.5 rounded-lg 
                     hover:bg-gray-800 transition-colors"
        >
          + Adicionar cor
        </button>
      </div>

      {variants.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-400">Nenhuma variante cadastrada</p>
          <p className="text-xs text-gray-300 mt-1">
            Adicione cores para ter estoques separados por variante
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {variants.map(v => (
          <VariantRow
            key={v.id}
            variant={v}
            availableSizes={availableSizes}
            saving={saving === v.color_id}
            onSave={(payload) => handleSaveVariant(v.id, v.color_id, payload)}
            onDelete={() => handleDelete(v.id)}
            onToggle={(active) => handleToggle(v.id, active)}
          />
        ))}
      </div>

      {showModal && (
        <ColorPickerModal
          colors={availableColors}
          onSelect={handleSelectColor}
          onCreate={handleCreateColor}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

// ── Linha de variante ─────────────────────────────────────────
function VariantRow({
  variant,
  availableSizes,
  saving,
  onSave,
  onDelete,
  onToggle,
}: {
  variant: ProductVariant
  availableSizes: string[]
  saving: boolean
  onSave: (p: { sizes?: ProductSize[] | null; stock?: number | null }) => void
  onDelete: () => void
  onToggle: (active: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const color = variant.color!

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors
      ${variant.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      
      {/* Header da variante */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          {color.hex_code && (
            <span
              className="w-4 h-4 rounded-full border border-gray-200 shrink-0"
              style={{ background: color.hex_code }}
            />
          )}
          <span className="text-sm font-medium text-gray-800">{color.name}</span>
          {!variant.active && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              Inativo
            </span>
          )}
          {availableSizes.length > 0 && variant.sizes && (
            <span className="text-xs text-gray-400">
              {variant.sizes.length} tamanho(s)
            </span>
          )}
          {availableSizes.length === 0 && variant.stock != null && (
            <span className="text-xs text-gray-400">{variant.stock} em estoque</span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onToggle(!variant.active)}
            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 
                       rounded border border-gray-100 hover:border-gray-300 transition-colors"
          >
            {variant.active ? 'Desativar' : 'Ativar'}
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 
                       rounded border border-red-100 hover:border-red-300 transition-colors"
          >
            Remover
          </button>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Corpo expansível */}
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
          {availableSizes.length > 0 ? (
            <ProductSizeStock
              availableSizes={availableSizes}
              value={variant.sizes ?? []}
              onChange={sizes => onSave({ sizes })}
            />
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Estoque desta cor
              </label>
              <input
                type="number"
                min={0}
                step={1}
                placeholder="Deixe vazio para não controlar"
                defaultValue={variant.stock ?? ''}
                onBlur={e => onSave({
                  stock: e.target.value === '' ? null : Number(e.target.value)
                })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm 
                           focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          )}
          {saving && (
            <p className="text-xs text-gray-400 mt-2">Salvando...</p>
          )}
        </div>
      )}
    </div>
  )
}