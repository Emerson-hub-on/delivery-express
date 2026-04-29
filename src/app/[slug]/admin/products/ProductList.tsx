'use client'
import { useState, useMemo } from 'react'
import { Product, CategoryItem } from '@/types/product'

interface ProductListProps {
  products: Product[]
  categories: CategoryItem[]
  onEdit: (product: Product) => void
  onDelete: (id: number) => void
  onToggleActive: (id: number, active: boolean) => void
  deletingId?: number | null
}

export function ProductList({ products, categories, onEdit, onDelete, onToggleActive, deletingId }: ProductListProps) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all')

  const categoryLabel = useMemo(() => {
    const map: Record<string, string> = {}
    categories.forEach(c => { map[c.name] = c.label })
    return map
  }, [categories])

  const uniqueCategories = useMemo(() =>
    Array.from(new Set(products.map(p => p.category))).sort(),
    [products]
  )

  const filtered = useMemo(() => {
    let list = [...products]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
      )
    }
    if (filterCategory !== 'all') list = list.filter(p => p.category === filterCategory)
    if (filterStock === 'low') list = list.filter(p => p.stock != null && p.stock > 0 && p.stock <= 5)
    if (filterStock === 'out') list = list.filter(p => p.stock === 0)
    return list
  }, [products, search, filterCategory, filterStock])

  if (products.length === 0) {
    return <div className="text-center py-16 text-gray-400 text-sm">Nenhum produto cadastrado.</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filtros ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar por nome ou descrição..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="flex-1 sm:flex-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black text-gray-600"
          >
            <option value="all">Todas categorias</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{categoryLabel[cat] ?? cat}</option>
            ))}
          </select>
          <select
            value={filterStock}
            onChange={e => setFilterStock(e.target.value as any)}
            className="flex-1 sm:flex-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black text-gray-600"
          >
            <option value="all">Estoque: todos</option>
            <option value="low">Estoque baixo (≤5)</option>
            <option value="out">Esgotado</option>
          </select>
        </div>
        {(search || filterCategory !== 'all' || filterStock !== 'all') && (
          <span className="text-xs text-gray-400 self-center">
            {filtered.length} de {products.length} {products.length === 1 ? 'produto' : 'produtos'}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">
          Nenhum produto encontrado para os filtros aplicados.
        </div>
      ) : (
        <>
          {/* ── Mobile: cards ── */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map(product => (
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
                      <span className="text-sm font-semibold text-gray-900">R$ {product.price.toFixed(2)}</span>
                      {product.stock == null ? null : product.stock === 0 ? (
                        <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full font-medium">Esgotado</span>
                      ) : product.stock <= 5 ? (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">{product.stock} un.</span>
                      ) : (
                        <span className="text-xs text-gray-500">{product.stock} un.</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => onEdit(product)} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Editar</button>
                      <button onClick={() => onDelete(product.id)} disabled={deletingId === -1}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors">
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
                {filtered.map(product => (
                  <tr key={product.id} className={`bg-white transition-colors hover:bg-gray-50 ${!product.active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <img src={product.image} alt={product.name}
                        className="w-12 h-12 object-cover rounded-lg bg-gray-100 shrink-0"
                        onError={e => (e.currentTarget.style.display = 'none')} />
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
                        <button onClick={() => onToggleActive(product.id, !product.active)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200
                            ${product.active ? 'bg-green-500' : 'bg-gray-300'}`}>
                          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200
                            ${product.active ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                        <button onClick={() => onEdit(product)} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Editar</button>
                        <button onClick={() => onDelete(product.id)} disabled={deletingId === -1}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-wait transition-colors">
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
      )}
    </div>
  )
}