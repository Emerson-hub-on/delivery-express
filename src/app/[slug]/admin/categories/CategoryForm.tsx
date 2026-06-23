'use client'
import { useState } from 'react'
import { CategoryItem, CategoryType, SizeGroup } from '@/types/product'

interface CategoryFormProps {
  form: Omit<CategoryItem, 'id'>
  editingId: number | null
  saving: boolean
  onFieldChange: (field: keyof Omit<CategoryItem, 'id'>, value: any) => void
  onSubmit: () => void
  onCancel: () => void
}

const SIZE_PRESETS: Record<'clothing' | 'footwear', string[]> = {
  clothing: ['PP', 'P', 'M', 'G', 'GG', 'XGG'],
  footwear: ['33','34','35','36','37','38','39','40','41','42','43','44'],
}

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  clothing: '👕 Roupa',
  footwear: '👟 Tênis / Sapato',
  other:    '📦 Outros tipos',
}

export function CategoryForm({
  form, editingId, saving, onFieldChange, onSubmit, onCancel,
}: CategoryFormProps) {
  const [newSize, setNewSize] = useState('')
  const sizes: string[] = form.sizes ?? []
  const showSizes = form.category_type === 'clothing' || form.category_type === 'footwear'

  const addSize = (raw: string) => {
    const v = raw.trim().toUpperCase()
    if (!v || sizes.includes(v)) return
    onFieldChange('sizes', [...sizes, v])
    setNewSize('')
  }

  const removeSize = (v: string) => {
    onFieldChange('sizes', sizes.filter(s => s !== v))
  }

  const applyPreset = () => {
    if (!form.category_type || form.category_type === 'other') return
    onFieldChange('sizes', SIZE_PRESETS[form.category_type])
  }

  const handleTypeChange = (type: CategoryType) => {
    onFieldChange('category_type', form.category_type === type ? undefined : type)
    onFieldChange('sizes', [])
    if (type === 'other') onFieldChange('size_group', undefined)
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Slug + Nome */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Slug (identificador interno)
          </label>
          <input
            type="text"
            placeholder="Ex: camisetas"
            value={form.name}
            onChange={e => onFieldChange('name', e.target.value)}
            disabled={editingId !== null}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-400"
          />
          <p className="text-xs text-gray-400 mt-1">Só letras minúsculas e underscore.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Nome de exibição
          </label>
          <input
            type="text"
            placeholder="Ex: Camisetas"
            value={form.label}
            onChange={e => onFieldChange('label', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
      </div>

      {/* Tipo de peça */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Tipo de peça <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(CATEGORY_TYPE_LABELS) as [CategoryType, string][]).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                form.category_type === type
                  ? 'bg-black text-white border-black'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Público-alvo */}
      {showSizes && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Público-alvo</label>
          <div className="flex gap-2">
            {(['adult', 'kids'] as SizeGroup[]).map(g => (
              <button
                key={g}
                type="button"
                onClick={() => onFieldChange('size_group', g)}
                className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                  form.size_group === g
                    ? 'bg-black text-white border-black'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {g === 'adult' ? '🧑 Adulto' : '👦 Infantil'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tamanhos */}
      {showSizes && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-600">Tamanhos disponíveis</label>
            <button
              type="button"
              onClick={applyPreset}
              className="text-xs text-blue-600 hover:underline"
            >
              Usar padrão ({form.category_type === 'clothing' ? 'PP → XGG' : '33 → 44'})
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-3 min-h-8">
            {sizes.length === 0
              ? <span className="text-xs text-gray-400 italic">Nenhum tamanho adicionado.</span>
              : sizes.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                    <span className="font-medium">{s}</span>
                    <button
                      type="button"
                      onClick={() => removeSize(s)}
                      className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors leading-none"
                    >×</button>
                  </span>
                ))
            }
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder={form.category_type === 'clothing' ? 'Ex: GGG' : 'Ex: 45'}
              value={newSize}
              onChange={e => setNewSize(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSize(newSize) } }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button
              type="button"
              onClick={() => addSize(newSize)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors"
            >
              Adicionar
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Enter também adiciona.</p>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2">
        <button
          onClick={onSubmit}
          disabled={saving}
          className="bg-black text-white text-sm px-5 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvando...' : editingId !== null ? 'Salvar alterações' : 'Criar categoria'}
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