'use client'
import { Product, CategoryItem } from '@/types/product'

interface ProductListProps {
  products: Product[]
  categories: CategoryItem[]
  onEdit: (product: Product) => void
  onDelete: (id: number) => void
  onToggleActive: (id: number, active: boolean) => void
  deletingId?: number | null
}

export function ProductList({ products, onEdit, onDelete, onToggleActive, deletingId }: ProductListProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        Nenhum produto cadastrado.
      </div>
    )
  }

  return (
    <>
      {/* ── Mobile: cards ── */}
      <div className="flex flex-col gap-3 md:hidden">
        {products.map(product => (
          <div
            key={product.id}
            className={`bg-white border border-gray-200 rounded-xl p-4 flex gap-3 ${!product.active ? 'opacity-50' : ''}`}
          >
            <img
              src={product.image}
              alt={product.name}
              className="w-14 h-14 object-cover rounded-lg bg-gray-100 shrink-0"
              onError={e => (e.currentTarget.style.display = 'none')}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-900 text-sm truncate">{product.name}</p>
                <button
                  onClick={() => onToggleActive(product.id, !product.active)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200
                    ${product.active ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
                    ${product.active ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {product.description && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{product.description}</p>
              )}

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    R$ {product.price.toFixed(2)}
                  </span>
                  {product.stock == null ? null : product.stock === 0 ? (
                    <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full font-medium">Esgotado</span>
                  ) : product.stock <= 5 ? (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">{product.stock} un.</span>
                  ) : (
                    <span className="text-xs text-gray-500">{product.stock} un.</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onEdit(product)}
                    className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onDelete(product.id)}
                    disabled={deletingId === -1}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                  >
                    {deletingId === -1 ? 'Verificando...' : 'Excluir'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop: tabela ── */}
      <div className="hidden md:block border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest px-5 py-3 w-16">Imagem</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Descrição</th>
              <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Preço</th>
              <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-widest px-4 py-3">Estoque</th>
              <th className="px-5 py-3 w-36" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map(product => (
              <tr key={product.id} className={`bg-white transition-colors hover:bg-gray-50 ${!product.active ? 'opacity-50' : ''}`}>
                <td className="px-5 py-3">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-12 h-12 object-cover rounded-lg bg-gray-100 shrink-0"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{product.name}</p>
                  {product.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{product.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                  R$ {product.price.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {product.stock == null ? (
                    <span className="text-xs text-gray-300">—</span>
                  ) : product.stock === 0 ? (
                    <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full font-medium">Esgotado</span>
                  ) : product.stock <= 5 ? (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">{product.stock} un.</span>
                  ) : (
                    <span className="text-xs text-gray-600 font-medium">{product.stock} un.</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-4">
                    <button
                      onClick={() => onToggleActive(product.id, !product.active)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200
                        ${product.active ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
                        ${product.active ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                    <button onClick={() => onEdit(product)} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
                      Editar
                    </button>
                    <button
                      onClick={() => onDelete(product.id)}
                      disabled={deletingId === -1}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-wait transition-colors"
                    >
                      {deletingId === -1 ? 'Verificando...' : 'Excluir'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}