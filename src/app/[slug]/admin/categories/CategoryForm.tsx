'use client'
import { CategoryItem } from '@/types/product'

interface CategoryFormProps {
  form: Omit<CategoryItem, 'id'>
  editingId: number | null
  saving: boolean
  onFieldChange: (field: keyof Omit<CategoryItem, 'id'>, value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export function CategoryForm({
  form,
  editingId,
  saving,
  onFieldChange,
  onSubmit,
  onCancel,
}: CategoryFormProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
      <h2 className="text-base font-medium text-gray-900 mb-4">
        {editingId !== null ? 'Editar categoria' : 'Nova categoria'}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Slug (identificador interno)
          </label>
          <input
            type="text"
            placeholder="Ex: temaki"
            value={form.name}
            onChange={e => onFieldChange('name', e.target.value)}
            disabled={editingId !== null}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-400"
          />
          <p className="text-xs text-gray-400 mt-1">Só letras minúsculas e underscore. Ex: hot_roll</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Nome de exibição
          </label>
          <input
            type="text"
            placeholder="Ex: Temakis"
            value={form.label}
            onChange={e => onFieldChange('label', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <p className="text-xs text-gray-400 mt-1">Aparece no menu e na listagem de produtos.</p>
        </div>
      </div>
      <div className="flex gap-3 mt-5">
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
