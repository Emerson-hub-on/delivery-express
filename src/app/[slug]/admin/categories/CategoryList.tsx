'use client'
import { useState } from 'react'
import { CategoryItem, Product } from '@/types/product'
import { updateCategoriesOrder } from '@/services/category'

interface CategoryListProps {
  categories: CategoryItem[]
  products: Product[]
  onEdit: (cat: CategoryItem) => void
  onDelete: (id: number) => void
  onActivate: (id: number) => void
  onReorder: (reordered: CategoryItem[]) => void
  deletingId?: number | null
}

export function CategoryList({
  categories,
  products,
  onEdit,
  onDelete,
  onActivate,
  onReorder,
  deletingId,
}: CategoryListProps) {
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  if (categories.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        Nenhuma categoria cadastrada.
      </div>
    )
  }

  const handleDragStart = (id: number) => setDraggingId(id)

  const handleDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault()
    if (draggingId === null || draggingId === targetId) return

    const from = categories.findIndex(c => c.id === draggingId)
    const to   = categories.findIndex(c => c.id === targetId)
    if (from === -1 || to === -1) return

    const reordered = [...categories]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    onReorder(reordered)
  }

  const handleDragEnd = async () => {
    setDraggingId(null)
    setSavingOrder(true)
    try {
      await updateCategoriesOrder(categories.map(c => c.id))
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {savingOrder && (
        <p className="text-xs text-gray-400 text-right">Salvando ordem...</p>
      )}
      {categories.map(cat => {
        const isArchived    = cat.active === false
        const isDragging    = draggingId === cat.id
        const productCount  = products.filter(p => p.category === cat.name).length

        return (
          <div
            key={cat.id}
            draggable
            onDragStart={() => handleDragStart(cat.id)}
            onDragOver={e => handleDragOver(e, cat.id)}
            onDragEnd={handleDragEnd}
            className={`bg-white border rounded-xl px-5 py-4 flex items-center justify-between gap-4 transition-all
              ${isArchived   ? 'opacity-60 border-gray-100 bg-gray-50' : 'border-gray-200'}
              ${isDragging   ? 'opacity-40 scale-95 shadow-lg'         : ''}
              cursor-grab active:cursor-grabbing`}
          >
            {/* Handle de arraste */}
            <span className="text-gray-300 hover:text-gray-500 select-none shrink-0 text-lg" title="Arrastar para reordenar">
              ⠿
            </span>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">{cat.label}</p>
                {isArchived && (
                  <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                    Arquivada
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 font-mono">{cat.name}</p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <span className="text-xs text-gray-400">
                {productCount} {productCount === 1 ? 'produto' : 'produtos'}
              </span>

              {isArchived ? (
                <>
                  <button onClick={() => onActivate(cat.id)}
                    className="text-xs text-green-600 hover:text-green-800 font-medium transition-colors">
                    Ativar
                  </button>
                  <button onClick={() => onDelete(cat.id)} disabled={deletingId === -1}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-wait transition-colors">
                    {deletingId === -1 ? 'Verificando...' : 'Excluir'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => onEdit(cat)}
                    className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                    Editar
                  </button>
                  <button onClick={() => onDelete(cat.id)} disabled={deletingId === -1}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-wait transition-colors">
                    {deletingId === -1 ? 'Verificando...' : 'Excluir'}
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}