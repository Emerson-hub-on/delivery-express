'use client'
import { Product, CategoryItem } from '@/types/product'

interface ProductListProps {
  products: Product[]
  categories: CategoryItem[]
  onEdit: (product: Product) => void
  onDelete: (id: number) => void
  onActivate: (id: number) => void
  deletingId?: number | null  // -1 = algum produto está sendo verificado
}

export function ProductList({ products, categories, onEdit, onDelete, onActivate, deletingId }: ProductListProps) {
  const getCatLabel = (name: string) =>
    categories.find(c => c.name === name)?.label ?? name

  const hasFiscalData = (p: Product) => !!(p.ncm && p.cfop && p.icms_csosn)

  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  if (products.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        Nenhum produto cadastrado.
      </div>
    )
  }

  return (
    <>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            {getCatLabel(category)}
          </h2>
          <div className="flex flex-col gap-2">
            {items.map(product => {
              const isArchived = product.active === false

              return (
                <div
                  key={product.id}
                  className={`bg-white border rounded-xl px-5 py-4 flex items-center justify-between gap-4
                    ${isArchived ? 'opacity-60 border-gray-100 bg-gray-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded-lg bg-gray-100 shrink-0"
                      onError={e => (e.currentTarget.style.display = 'none')}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                        {isArchived && (
                          <span className="shrink-0 text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                            Arquivado
                          </span>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-xs text-gray-400 truncate">{product.description}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {hasFiscalData(product) ? (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                            NCM: {product.ncm}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            Dados fiscais incompletos
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-sm font-medium text-gray-900">
                      R$ {product.price.toFixed(2)}
                    </span>

                    {isArchived ? (
                      // ── Produto arquivado: Ativar ou Excluir permanentemente ──
                      <>
                        <button
                          onClick={() => onActivate(product.id)}
                          className="text-xs text-green-600 hover:text-green-800 font-medium transition-colors"
                        >
                          Ativar
                        </button>
                        <button
                          onClick={() => onDelete(product.id)}
                          disabled={deletingId === -1}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-wait transition-colors"
                        >
                          {deletingId === -1 ? 'Verificando...' : 'Excluir'}
                        </button>
                      </>
                    ) : (
                      // ── Produto ativo: Editar ou Excluir ──
                      <>
                        <button
                          onClick={() => onEdit(product)}
                          className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => onDelete(product.id)}
                          disabled={deletingId === -1}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-wait transition-colors"
                        >
                          {deletingId === -1 ? 'Verificando...' : 'Excluir'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
