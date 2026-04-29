'use client'
import { useState, useMemo } from 'react'
import { Product, CategoryItem } from '@/types/product'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(value: number | null | undefined) {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function calcMargin(price: number, costPrice: number | null | undefined): string {
  if (!costPrice || costPrice <= 0) return '—'
  const margin = ((price - costPrice) / price) * 100
  return `${margin.toFixed(1)}%`
}

function marginColor(price: number, costPrice: number | null | undefined): string {
  if (!costPrice || costPrice <= 0) return 'text-gray-400'
  const margin = ((price - costPrice) / price) * 100
  if (margin >= 50) return 'text-emerald-600 font-semibold'
  if (margin >= 25) return 'text-amber-600 font-semibold'
  return 'text-red-500 font-semibold'
}

function isFiscalComplete(p: Product): boolean {
  return !!(p.ncm && p.cfop && p.unit_com && p.icms_csosn && p.pis_cst && p.cofins_cst)
}

const ORIGEM_LABELS: Record<number, string> = {
  0: 'Nacional',
  1: 'Imp. Direta',
  2: 'Merc. Estrangeiro',
  3: 'Nacional c/ + 40% imp.',
  4: 'Nacional (proc. básicos)',
  5: 'Nacional c/ + 70% imp.',
  6: 'Importação Direta (sem similar)',
  7: 'Estrangeiro (sem similar)',
  8: 'Nacional (gás/eletricidade)',
}

// ─── types ───────────────────────────────────────────────────────────────────

export interface InventoryTabProps {
  products: Product[]
  categories: CategoryItem[]
  loading?: boolean
}

type SortKey = 'id' | 'name' | 'price' | 'cost_price' | 'margin' | 'stock' | 'fiscal'
type SortDir = 'asc' | 'desc'

// ─── FiscalBadge ──────────────────────────────────────────────────────────────

function FiscalBadge({ product }: { product: Product }) {
  const complete = isFiscalComplete(product)
  const missing: string[] = []
  if (!product.ncm) missing.push('NCM')
  if (!product.cfop) missing.push('CFOP')
  if (!product.unit_com) missing.push('Unid.')
  if (!product.icms_csosn) missing.push('CSOSN')
  if (!product.pis_cst) missing.push('PIS')
  if (!product.cofins_cst) missing.push('COFINS')

  return (
    <div className="group relative inline-flex">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
        ${complete ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${complete ? 'bg-emerald-500' : 'bg-red-500'}`} />
        {complete ? 'Completo' : 'Incompleto'}
      </span>
      {/* Tooltip with details */}
      <div className="pointer-events-none absolute bottom-full left-0 mb-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 min-w-40 shadow-xl">
          <div className="font-semibold mb-1.5 text-gray-300">Dados Fiscais</div>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            {[
              ['NCM', product.ncm],
              ['CEST', product.cest],
              ['CFOP', product.cfop],
              ['Unid.', product.unit_com],
              ['Orig.', product.origem != null ? ORIGEM_LABELS[product.origem] : undefined],
              ['CSOSN', product.icms_csosn],
              ['ICMS%', product.icms_aliq != null ? `${product.icms_aliq}%` : undefined],
              ['PIS CST', product.pis_cst],
              ['COFINS CST', product.cofins_cst],
              ['EAN', product.ean],
            ].map(([label, value]) => (
              <div key={label as string} className="contents">
                <span className="text-gray-400">{label}:</span>
                <span className={value ? 'text-white' : 'text-gray-600 italic'}>{value ?? '—'}</span>
              </div>
            ))}
          </div>
          {missing.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-700 text-red-400">
              Faltando: {missing.join(', ')}
            </div>
          )}
        </div>
        <div className="w-2 h-2 bg-gray-900 rotate-45 ml-3 -mt-1" />
      </div>
    </div>
  )
}

// ─── ExportMenu ───────────────────────────────────────────────────────────────

function ExportMenu({ onExcel }: { onExcel: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Exportar
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
            <button onClick={() => { onExcel(); setOpen(false) }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              📊 Excel (.xlsx)
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── SortButton ───────────────────────────────────────────────────────────────

function SortButton({ label, sortKey, current, dir, onSort }: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 text-xs font-medium transition-colors
        ${active ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {label}
      <span className="flex flex-col">
        <svg width="8" height="5" viewBox="0 0 8 5" className={active && dir === 'asc' ? 'opacity-100' : 'opacity-30'}>
          <path d="M4 0L8 5H0L4 0Z" fill="currentColor" />
        </svg>
        <svg width="8" height="5" viewBox="0 0 8 5" className={active && dir === 'desc' ? 'opacity-100' : 'opacity-30'}>
          <path d="M4 5L0 0H8L4 5Z" fill="currentColor" />
        </svg>
      </span>
    </button>
  )
}

// ─── StockBadge ──────────────────────────────────────────────────────────────

function StockBadge({ stock }: { stock: number | null | undefined }) {
  if (stock == null) return <span className="text-gray-300">—</span>
  if (stock === 0) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
      Esgotado
    </span>
  )
  if (stock <= 5) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
      {stock} un.
    </span>
  )
  return <span className="text-gray-700 text-sm">{stock} un.</span>
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export function InventoryTab({ products, categories, loading }: InventoryTabProps) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterFiscal, setFilterFiscal] = useState<'all' | 'complete' | 'incomplete'>('all')
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const categoryLabel = useMemo(() => {
    const map: Record<string, string> = {}
    categories.forEach(c => { map[c.name] = c.label })
    return map
  }, [categories])

  const filtered = useMemo(() => {
    let list = [...products]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        String(p.id).includes(q) ||
        (p.ncm ?? '').includes(q) ||
        (p.ean ?? '').includes(q)
      )
    }

    if (filterCategory !== 'all') {
      list = list.filter(p => p.category === filterCategory)
    }

    if (filterFiscal === 'complete') list = list.filter(isFiscalComplete)
    if (filterFiscal === 'incomplete') list = list.filter(p => !isFiscalComplete(p))

    if (filterStock === 'low') list = list.filter(p => p.stock != null && p.stock > 0 && p.stock <= 5)
    if (filterStock === 'out') list = list.filter(p => p.stock === 0)

    list.sort((a, b) => {
      let va: any, vb: any
      if (sortKey === 'id') { va = a.id; vb = b.id }
      else if (sortKey === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase() }
      else if (sortKey === 'price') { va = a.price; vb = b.price }
      else if (sortKey === 'cost_price') { va = a.cost_price ?? -1; vb = b.cost_price ?? -1 }
      else if (sortKey === 'stock') { va = a.stock ?? -1; vb = b.stock ?? -1 }
      else if (sortKey === 'fiscal') { va = isFiscalComplete(a) ? 1 : 0; vb = isFiscalComplete(b) ? 1 : 0 }
      else if (sortKey === 'margin') {
        va = a.cost_price && a.cost_price > 0 ? ((a.price - a.cost_price) / a.price) : -1
        vb = b.cost_price && b.cost_price > 0 ? ((b.price - b.cost_price) / b.price) : -1
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [products, search, filterCategory, filterFiscal, filterStock, sortKey, sortDir])

  // Summary stats
  const stats = useMemo(() => ({
    total: products.length,
    fiscalComplete: products.filter(isFiscalComplete).length,
    outOfStock: products.filter(p => p.stock === 0).length,
    lowStock: products.filter(p => p.stock != null && p.stock > 0 && p.stock <= 5).length,
  }), [products])

  const handleExcel = async () => {
    const XLSX = await import('xlsx')
    const headers = ['#', 'Nome', 'Categoria', 'Unidade', 'Preço Custo', 'Preço Venda', 'Margem', 'Estoque',
      'NCM', 'CEST', 'CFOP', 'Origem', 'CSOSN', 'PIS CST', 'PIS%', 'COFINS CST', 'COFINS%', 'EAN', 'Fiscal']
    const rows = filtered.map(p => [
      p.id,
      p.name,
      categoryLabel[p.category] ?? p.category,
      p.unit_com ?? '—',
      p.cost_price ?? '',
      p.price,
      p.cost_price ? `${(((p.price - p.cost_price) / p.price) * 100).toFixed(1)}%` : '—',
      p.stock ?? '—',
      p.ncm ?? '—',
      p.cest ?? '—',
      p.cfop ?? '—',
      p.origem != null ? ORIGEM_LABELS[p.origem] : '—',
      p.icms_csosn ?? '—',
      p.pis_cst ?? '—',
      p.pis_aliq ?? 0,
      p.cofins_cst ?? '—',
      p.cofins_aliq ?? 0,
      p.ean ?? '—',
      isFiscalComplete(p) ? 'Completo' : 'Incompleto',
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = headers.map((h, ci) => ({
      wch: Math.max(h.length, ...rows.map(r => String(r[ci] ?? '').length)) + 2
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inventário')
    XLSX.writeFile(wb, 'inventario-produtos.xlsx')
  }

  const uniqueCategories = useMemo(() =>
    Array.from(new Set(products.map(p => p.category))).sort(),
    [products]
  )

  return (
    <div className="mt-6 flex flex-col gap-4">

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total de Produtos', value: stats.total, icon: '📦', color: 'bg-blue-50' },
          { label: 'Dados Fiscais OK', value: `${stats.fiscalComplete}/${stats.total}`, icon: '🧾', color: 'bg-emerald-50' },
          { label: 'Estoque Baixo', value: stats.lowStock, icon: '⚠️', color: 'bg-amber-50' },
          { label: 'Esgotados', value: stats.outOfStock, icon: '🚫', color: 'bg-red-50' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">{card.label}</p>
              <p className="text-xl font-semibold text-gray-900">{card.value}</p>
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${card.color}`}>
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-45 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar por nome, ID, NCM..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {/* Category */}
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black text-gray-600"
        >
          <option value="all">Todas categorias</option>
          {uniqueCategories.map(cat => (
            <option key={cat} value={cat}>{categoryLabel[cat] ?? cat}</option>
          ))}
        </select>

        {/* Fiscal filter */}
        <select
          value={filterFiscal}
          onChange={e => setFilterFiscal(e.target.value as any)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black text-gray-600"
        >
          <option value="all">Fiscal: todos</option>
          <option value="complete">Fiscal: completo</option>
          <option value="incomplete">Fiscal: incompleto</option>
        </select>

        {/* Stock filter */}
        <select
          value={filterStock}
          onChange={e => setFilterStock(e.target.value as any)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black text-gray-600"
        >
          <option value="all">Estoque: todos</option>
          <option value="low">Estoque baixo (≤5)</option>
          <option value="out">Esgotado</option>
        </select>

        <div className="ml-auto">
          <ExportMenu onExcel={handleExcel} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Carregando produtos...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">Nenhum produto encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left">
                    <SortButton label="#" sortKey="id" current={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Imagem</th>
                  <th className="px-4 py-3 text-left">
                    <SortButton label="Descrição" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Unid.</th>
                  <th className="px-4 py-3 text-left">
                    <SortButton label="Preço Custo" sortKey="cost_price" current={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortButton label="Preço Venda" sortKey="price" current={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortButton label="Margem" sortKey="margin" current={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortButton label="Estoque" sortKey="stock" current={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-left">
                    <SortButton label="Fiscal" sortKey="fiscal" current={sortKey} dir={sortDir} onSort={handleSort} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                  >
                    {/* ID */}
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.id}</td>

                    {/* Image */}
                    <td className="px-4 py-3">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-100"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-300 border border-gray-100">
                          sem foto
                        </div>
                      )}
                    </td>

                    {/* Name + category */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{p.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{categoryLabel[p.category] ?? p.category}</div>
                    </td>

                    {/* Unit */}
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                        {p.unit_com ?? 'UN'}
                      </span>
                    </td>

                    {/* Cost price */}
                    <td className="px-4 py-3 text-gray-600 tabular-nums">{fmtBRL(p.cost_price)}</td>

                    {/* Sale price */}
                    <td className="px-4 py-3 text-gray-900 font-medium tabular-nums">{fmtBRL(p.price)}</td>

                    {/* Margin */}
                    <td className={`px-4 py-3 tabular-nums ${marginColor(p.price, p.cost_price)}`}>
                      {calcMargin(p.price, p.cost_price)}
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-3">
                      <StockBadge stock={p.stock} />
                    </td>

                    {/* Fiscal */}
                    <td className="px-4 py-3">
                      <FiscalBadge product={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Results count */}
      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'} exibidos
        </p>
      )}
    </div>
  )
}
