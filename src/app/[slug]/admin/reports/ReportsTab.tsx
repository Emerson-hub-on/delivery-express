'use client'
import { useState, useMemo } from 'react'
import { Order, CategoryItem, Product } from '@/types/product'

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseItems(items: any) {
  if (!items) return []
  if (typeof items === 'string') {
    try { return JSON.parse(items) } catch { return [] }
  }
  return items
}

function fmtBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function todayLocalISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfWeekISO() {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfMonthISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ─── types ───────────────────────────────────────────────────────────────────

export type ReportSubTab = 'overview' | 'products' | 'categories'
type ProductPeriod = 'day' | 'week' | 'month'

export interface ReportsTabProps {
  orders: Order[]        // pedidos filtrados pela DateFilterBar
  allOrders: Order[]     // todos os pedidos, sem filtro de data
  loading: boolean
  dateFrom: string
  dateTo: string
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  onFilter: () => void
  onClearFilter: () => void
  subTab: ReportSubTab
  onSubTabChange: (s: ReportSubTab) => void
  categories: CategoryItem[]
  products: Product[]
}

// ─── export helpers ───────────────────────────────────────────────────────────

async function exportXLSX(filename: string, headers: string[], rows: (string | number)[][]) {
  const XLSX = await import('xlsx')
  const data = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = headers.map((h, ci) => ({
    wch: Math.max(h.length, ...rows.map(r => String(r[ci] ?? '').length)) + 2
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  XLSX.writeFile(wb, filename + '.xlsx')
}

function exportPDF(contentId: string, filename: string) {
  const el = document.getElementById(contentId)
  if (!el) return
  const win = window.open('', '_blank')!
  win.document.write(`
    <html><head><title>${filename}</title>
    <style>
      body { font-family: sans-serif; padding: 24px; color: #111; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #f3f4f6; text-align: left; padding: 8px 12px; font-size: 12px; color: #6b7280; }
      td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
      .card { display: inline-block; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 24px; margin: 0 8px 12px 0; min-width: 140px; }
      .card-label { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
      .card-value { font-size: 22px; font-weight: 600; }
    </style></head><body>
    ${el.innerHTML}
    </body></html>
  `)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}

// ─── DateFilterBar ────────────────────────────────────────────────────────────

function DateFilterBar({
  dateFrom, dateTo, loading,
  onDateFromChange, onDateToChange, onFilter, onClearFilter,
}: Omit<ReportsTabProps, 'orders' | 'allOrders' | 'subTab' | 'onSubTabChange' | 'categories' | 'products'>) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs text-gray-400 mb-1">De</label>
        <input type="date" value={dateFrom}
          onChange={e => onDateFromChange(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Até</label>
        <input type="date" value={dateTo}
          onChange={e => onDateToChange(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <button onClick={onFilter} disabled={loading}
        className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
        {loading ? 'Buscando...' : 'Aplicar'}
      </button>
      {(dateFrom || dateTo) && (
        <button onClick={onClearFilter}
          className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
          Limpar
        </button>
      )}
    </div>
  )
}

// ─── ExportMenu ───────────────────────────────────────────────────────────────

function ExportMenu({ onPDF, onExcel }: { onPDF: () => void; onExcel: () => void | Promise<void> }) {
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
          <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
            <button onClick={() => { onPDF(); setOpen(false) }}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              📄 PDF
            </button>
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

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between gap-3">
      <div>
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${color}`}>
        {icon}
      </div>
    </div>
  )
}

// ─── UncategorizedBanner ─────────────────────────────────────────────────────

function UncategorizedBanner({ qty, revenue }: { qty: number; revenue: number }) {
  if (qty === 0) return null
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
      <span className="text-amber-500 shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <span className="text-amber-800 font-medium">
          {qty} {qty === 1 ? 'item ignorado' : 'itens ignorados'} por não ter categoria
        </span>
        <span className="text-amber-700"> ({fmtBRL(revenue)} não contabilizados). </span>
        <a href="/products" className="text-amber-700 underline underline-offset-2 hover:text-amber-900 transition-colors">
          Corrigir produtos →
        </a>
      </div>
    </div>
  )
}

// ─── BarChart ────────────────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)

  // Calcular steps "bonitos" sem floating point issues
  const rawStep = max / 4
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 1))))
  const niceStep = Math.ceil(rawStep / magnitude) * magnitude
  const niceMax = niceStep * 4
  const round = (v: number) => Math.round(v * 1e9) / 1e9
  const steps = [0, round(niceStep), round(niceStep * 2), round(niceStep * 3), round(niceMax)]

  const CHART_HEIGHT = 280

  return (
    <div className="flex gap-3 w-full">
      {/* Eixo Y */}
      <div className="flex flex-col-reverse justify-between text-xs text-gray-400 pb-7 shrink-0" style={{ minWidth: 40 }}>
        {steps.map((s, i) => (
          <span key={i} className="text-right leading-none tabular-nums">{s}</span>
        ))}
      </div>

      {/* Área do gráfico */}
      <div className="flex-1 flex flex-col gap-0 min-w-0">
        <div className="relative w-full" style={{ height: CHART_HEIGHT }}>
          {/* Linhas de grade */}
          {steps.map((s, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-dashed border-gray-200"
              style={{ bottom: `${(s / niceMax) * 100}%` }}
            />
          ))}

          {/* Barras */}
          <div className="absolute inset-0 flex items-end gap-2 px-1">
            {data.map((d, i) => {
              const heightPct = (d.value / niceMax) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
                  {/* Valor em cima da barra */}
                  {d.value > 0 && (
                    <span className="text-xs font-medium text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.value}
                    </span>
                  )}
                  <div
                    className="w-full bg-blue-500 hover:bg-blue-600 rounded-t-md transition-all duration-500"
                    style={{
                      height: `${Math.max(heightPct, d.value > 0 ? 1 : 0)}%`,
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Eixo X — labels */}
        <div className="flex gap-2 px-1 mt-2">
          {data.map((d, i) => (
            <div key={i} className="flex-1 text-center text-xs text-gray-500 truncate">{d.label}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── PieChart ─────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
]

function PieChart({ slices }: { slices: { label: string; value: number; pct: number }[] }) {
  const SIZE = 220
  const R = 80
  const cx = SIZE / 2
  const cy = SIZE / 2

  // Gera arcos SVG
  let cumAngle = -Math.PI / 2
  const paths = slices.map((s, i) => {
    const angle = (s.pct / 100) * 2 * Math.PI
    const x1 = cx + R * Math.cos(cumAngle)
    const y1 = cy + R * Math.sin(cumAngle)
    cumAngle += angle
    const x2 = cx + R * Math.cos(cumAngle)
    const y2 = cy + R * Math.sin(cumAngle)
    const large = angle > Math.PI ? 1 : 0
    return { d: `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`, color: PIE_COLORS[i % PIE_COLORS.length] }
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Pizza */}
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} stroke="white" strokeWidth={2}>
            <title>{slices[i].label}: {slices[i].pct.toFixed(1)}%</title>
          </path>
        ))}
        {/* Buraco central (donut) */}
        <circle cx={cx} cy={cy} r={R * 0.5} fill="white" />
      </svg>

      {/* Legenda */}
      <div className="flex flex-col gap-2 min-w-0 w-full">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="text-gray-700 truncate">{s.label}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-gray-400 text-xs">{fmtBRL(s.value)}</span>
              <span className="text-gray-900 font-medium text-xs w-10 text-right">{s.pct.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── OVERVIEW ────────────────────────────────────────────────────────────────

function OverviewSection({ orders, categories, products, dateFrom, dateTo, loading, onDateFromChange, onDateToChange, onFilter, onClearFilter }: ReportsTabProps) {
  const normalized = useMemo(() => orders.map(o => ({ ...o, items: parseItems(o.items) })), [orders])
  const totalRevenue = normalized.reduce((s, o) => s + (o.total ?? 0), 0)
  const avgTicket = normalized.length > 0 ? totalRevenue / normalized.length : 0

  // Mapa produto → categoria (mesmo fix de tipo)
  const productCategoryMap = useMemo(() => {
    const map: Record<string, string> = {}
    products.forEach(p => {
      const cat = categories.find(c => c.name === p.category)
      map[String(p.id)] = cat?.label ?? p.category ?? 'Sem categoria'
    })
    return map
  }, [products, categories])

  // Receita por categoria (exclui "Sem categoria")
  const { pieSlices, uncatQty, uncatRevenue } = useMemo(() => {
    const catMap: Record<string, number> = {}
    let uncatQty = 0
    let uncatRevenue = 0
    normalized.forEach(order => {
      parseItems(order.items).forEach((item: any) => {
        const cat = productCategoryMap[String(item.product_id)] ?? 'Sem categoria'
        if (cat === 'Sem categoria') {
          uncatQty += item.quantity
          uncatRevenue += item.quantity * item.unit_price
        } else {
          catMap[cat] = (catMap[cat] ?? 0) + item.quantity * item.unit_price
        }
      })
    })
    const total = Object.values(catMap).reduce((s, v) => s + v, 0)
    const pieSlices = Object.entries(catMap)
      .map(([label, value]) => ({ label, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
    return { pieSlices, uncatQty, uncatRevenue }
  }, [normalized, productCategoryMap])

  const handlePDF = () => {
    const dateLabel = dateFrom && dateTo
      ? `${new Date(dateFrom + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(dateTo + 'T00:00:00').toLocaleDateString('pt-BR')}`
      : 'Todos os períodos'

    const catRows = pieSlices.map(s => `
      <tr>
        <td>${s.label}</td>
        <td>${fmtBRL(s.value)}</td>
        <td>${s.pct.toFixed(1)}%</td>
      </tr>`).join('')

    const uncatRow = uncatQty > 0 ? `
      <tr style="color:#d97706">
        <td>Sem categoria (ignorados)</td>
        <td>${fmtBRL(uncatRevenue)}</td>
        <td>—</td>
      </tr>` : ''

    const win = window.open('', '_blank')!
    win.document.write(`
      <html><head><title>Visão Geral</title>
      <style>
        body { font-family: sans-serif; padding: 32px; color: #111; }
        h2 { font-size: 18px; margin: 0 0 4px; }
        p.sub { font-size: 12px; color: #6b7280; margin: 0 0 24px; }
        .cards { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
        .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 24px; min-width: 160px; }
        .card-label { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
        .card-value { font-size: 22px; font-weight: 700; color: #111; }
        h3 { font-size: 14px; margin: 0 0 12px; color: #374151; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; text-align: left; padding: 10px 14px; font-size: 12px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
        td { padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        tr:last-child td { border-bottom: none; }
      </style></head><body>
      <h2>Visão Geral</h2>
      <p class="sub">Período: ${dateLabel}</p>

      <div class="cards">
        <div class="card">
          <div class="card-label">Total de Pedidos</div>
          <div class="card-value">${normalized.length.toLocaleString('pt-BR')}</div>
        </div>
        <div class="card">
          <div class="card-label">Receita Total</div>
          <div class="card-value">${fmtBRL(totalRevenue)}</div>
        </div>
        <div class="card">
          <div class="card-label">Ticket Médio</div>
          <div class="card-value">${fmtBRL(avgTicket)}</div>
        </div>
      </div>

      ${pieSlices.length > 0 ? `
        <h3>Receita por Categoria</h3>
        <table>
          <thead>
            <tr><th>Categoria</th><th>Receita</th><th>% do Total</th></tr>
          </thead>
          <tbody>
            ${catRows}
            ${uncatRow}
          </tbody>
        </table>
      ` : ''}
      </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const handleExcel = () => exportXLSX('visao-geral',
    ['Métrica', 'Valor'],
    [
      ['Total de Pedidos', normalized.length],
      ['Receita Total', fmtBRL(totalRevenue)],
      ['Ticket Médio', fmtBRL(avgTicket)],
      [],
      ['Categoria', 'Receita', '% do Total'],
      ...pieSlices.map(s => [s.label, fmtBRL(s.value), `${s.pct.toFixed(1)}%`]),
      ...(uncatQty > 0 ? [['Sem categoria (ignorados)', fmtBRL(uncatRevenue), '—']] : []),
    ]
  )

  return (
    <>
      <DateFilterBar {...{ dateFrom, dateTo, loading, onDateFromChange, onDateToChange, onFilter, onClearFilter }} />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Visão Geral</h3>
        <ExportMenu onPDF={handlePDF} onExcel={handleExcel} />
      </div>
      <div id="overview-content" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total de Pedidos" value={normalized.length.toLocaleString('pt-BR')} icon="🛒" color="bg-blue-50" />
          <StatCard label="Receita Total" value={fmtBRL(totalRevenue)} icon="💵" color="bg-green-50" />
          <StatCard label="Ticket Médio" value={fmtBRL(avgTicket)} icon="📈" color="bg-purple-50" />
        </div>

        <UncategorizedBanner qty={uncatQty} revenue={uncatRevenue} />

        {pieSlices.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-medium text-gray-900 mb-5">Receita por Categoria</h4>
            <PieChart slices={pieSlices} />
          </div>
        )}
      </div>
    </>
  )
}

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

function ProductsSection({ orders: _orders, allOrders, dateFrom, dateTo, loading, onDateFromChange, onDateToChange, onFilter, onClearFilter }: ReportsTabProps) {
  const [period, setPeriod] = useState<ProductPeriod>('week')
  const [useCustomRange, setUseCustomRange] = useState(false)

  // Quando usa período customizado, filtra allOrders pelo dateFrom/dateTo do filtro
  // Quando usa período rápido (Hoje/Semana/Mês), filtra allOrders pelo período selecionado
  const filteredOrders = useMemo(() => {
    if (useCustomRange) {
      if (!dateFrom && !dateTo) return allOrders
      return allOrders.filter(o => {
        const d = o.created_at?.slice(0, 10) ?? ''
        return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo)
      })
    }
    const from = period === 'day' ? todayLocalISO() : period === 'week' ? startOfWeekISO() : startOfMonthISO()
    const to = todayLocalISO()
    return allOrders.filter(o => {
      const d = o.created_at?.slice(0, 10) ?? ''
      return d >= from && d <= to
    })
  }, [allOrders, period, useCustomRange, dateFrom, dateTo])

  const normalized = useMemo(() => filteredOrders.map(o => ({ ...o, items: parseItems(o.items) })), [filteredOrders])

  const salesMap: Record<string, { name: string; qty: number; revenue: number }> = {}
  normalized.forEach(order => {
    order.items.forEach((item: any) => {
      // FIX: usar String(item.product_id) como chave para evitar conflito de tipos
      const key = String(item.product_id)
      if (!salesMap[key]) salesMap[key] = { name: item.product_name, qty: 0, revenue: 0 }
      salesMap[key].qty += item.quantity
      salesMap[key].revenue += item.quantity * item.unit_price
    })
  })

  const topProducts = Object.values(salesMap).sort((a, b) => b.qty - a.qty).slice(0, 10)

  // Determina granularidade do gráfico baseado no intervalo de datas
  const chartGranularity = useMemo((): 'hours' | 'days' | 'weeks' | 'months' | 'biannual' => {
    if (!useCustomRange) {
      if (period === 'day') return 'hours'
      if (period === 'week') return 'days'
      return 'days' // month
    }
    if (!dateFrom || !dateTo) return 'days'
    const from = new Date(dateFrom + 'T00:00:00')
    const to = new Date(dateTo + 'T23:59:59')
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays <= 1)   return 'hours'
    if (diffDays <= 31)  return 'days'
    if (diffDays <= 180) return 'weeks'
    if (diffDays <= 730) return 'months'
    return 'biannual'
  }, [useCustomRange, period, dateFrom, dateTo])

  const chartGranularityLabel: Record<typeof chartGranularity, string> = {
    hours:    'por hora',
    days:     'por dia',
    weeks:    'por semana',
    months:   'por mês',
    biannual: 'por semestre',
  }

  const chartData = useMemo(() => {
    // ── Período rápido (Hoje / Semana / Mês) ──────────────────
    if (!useCustomRange) {
      if (period === 'day') {
        const hours = Array.from({ length: 24 }, (_, i) => ({ label: `${i}h`, value: 0 }))
        normalized.forEach(o => {
          const h = new Date(o.created_at ?? '').getHours()
          hours[h].value += 1
        })
        return hours.filter((_, i) => i % 3 === 0)
      }
      if (period === 'week') {
        const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
        const counts = [0, 0, 0, 0, 0, 0, 0]
        normalized.forEach(o => {
          const dow = (new Date(o.created_at ?? '').getDay() + 6) % 7
          counts[dow] += 1
        })
        return days.map((label, i) => ({ label, value: counts[i] }))
      }
      // month
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
      const counts = Array.from({ length: daysInMonth }, () => 0)
      normalized.forEach(o => {
        const d = new Date(o.created_at ?? '').getDate() - 1
        if (d >= 0 && d < daysInMonth) counts[d] += 1
      })
      return counts.map((value, i) => ({ label: String(i + 1), value }))
    }

    // ── Período customizado ───────────────────────────────────
    if (!dateFrom || !dateTo) return []
    const from = new Date(dateFrom + 'T00:00:00')
    const to   = new Date(dateTo   + 'T23:59:59')

    if (chartGranularity === 'hours') {
      const hours = Array.from({ length: 24 }, (_, i) => ({ label: `${i}h`, value: 0 }))
      normalized.forEach(o => {
        const h = new Date(o.created_at ?? '').getHours()
        hours[h].value += 1
      })
      return hours.filter((_, i) => i % 3 === 0)
    }

    if (chartGranularity === 'days') {
      const map: Record<string, number> = {}
      const cur = new Date(from)
      while (cur <= to) {
        const key = cur.toISOString().slice(0, 10)
        map[key] = 0
        cur.setDate(cur.getDate() + 1)
      }
      normalized.forEach(o => {
        const key = (o.created_at ?? '').slice(0, 10)
        if (key in map) map[key]++
      })
      return Object.entries(map).map(([date, value]) => ({
        label: String(new Date(date + 'T00:00:00').getDate()),
        value,
      }))
    }

    if (chartGranularity === 'weeks') {
      // Agrupa por semana ISO (Segunda a Domingo)
      const map: Record<string, { label: string; value: number }> = {}
      normalized.forEach(o => {
        const d = new Date(o.created_at ?? '')
        // Início da semana (segunda)
        const dow = (d.getDay() + 6) % 7
        const monday = new Date(d)
        monday.setDate(d.getDate() - dow)
        const key = monday.toISOString().slice(0, 10)
        const label = `${String(monday.getDate()).padStart(2,'0')}/${String(monday.getMonth()+1).padStart(2,'0')}`
        if (!map[key]) map[key] = { label, value: 0 }
        map[key].value++
      })
      return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v)
    }

    if (chartGranularity === 'months') {
      const map: Record<string, number> = {}
      const cur = new Date(from.getFullYear(), from.getMonth(), 1)
      const end = new Date(to.getFullYear(), to.getMonth(), 1)
      while (cur <= end) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`
        map[key] = 0
        cur.setMonth(cur.getMonth() + 1)
      }
      normalized.forEach(o => {
        const key = (o.created_at ?? '').slice(0, 7)
        if (key in map) map[key]++
      })
      const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
      return Object.entries(map).map(([key, value]) => ({
        label: MONTH_LABELS[parseInt(key.slice(5,7)) - 1],
        value,
      }))
    }

    // biannual — semestres
    const map: Record<string, number> = {}
    const cur = new Date(from.getFullYear(), from.getMonth() < 6 ? 0 : 6, 1)
    const end = new Date(to.getFullYear(), to.getMonth() < 6 ? 0 : 6, 1)
    while (cur <= end) {
      const sem = cur.getMonth() < 6 ? '1' : '2'
      const key = `${cur.getFullYear()}-S${sem}`
      map[key] = 0
      cur.setMonth(cur.getMonth() + 6)
    }
    normalized.forEach(o => {
      const d = new Date(o.created_at ?? '')
      const sem = d.getMonth() < 6 ? '1' : '2'
      const key = `${d.getFullYear()}-S${sem}`
      if (key in map) map[key]++
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ label: key, value }))
  }, [normalized, period, useCustomRange, dateFrom, dateTo, chartGranularity])

  const PERIOD_LABELS: Record<ProductPeriod, string> = { day: 'Hoje', week: 'Última semana', month: 'Este mês' }

  const handlePDF = () => {
    const PERIOD_LABEL_MAP: Record<ProductPeriod, string> = { day: 'Hoje', week: 'Última semana', month: 'Este mês' }
    const rows = topProducts.map((p, i) => `
      <tr>
        <td class="pos">${i + 1}</td>
        <td>${p.name}</td>
        <td>${p.qty}</td>
        <td>${fmtBRL(p.revenue)}</td>
      </tr>`).join('')
    const win = window.open('', '_blank')!
    win.document.write(`
      <html><head><title>Produtos mais vendidos</title>
      <style>
        body { font-family: sans-serif; padding: 32px; color: #111; }
        h2 { font-size: 18px; margin: 0 0 4px; }
        p.sub { font-size: 12px; color: #6b7280; margin: 0 0 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; text-align: left; padding: 10px 14px; font-size: 12px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
        td { padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        tr:last-child td { border-bottom: none; }
        td.pos { color: #9ca3af; font-weight: 700; width: 32px; }
      </style></head><body>
      <h2>Produtos mais vendidos</h2>
      <p class="sub">Período: ${PERIOD_LABEL_MAP[period]}</p>
      <table>
        <thead><tr><th>#</th><th>Produto</th><th>Quantidade</th><th>Receita</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }
  const handleExcel = () => exportXLSX('produtos-mais-vendidos',
    ['Posição', 'Produto', 'Quantidade', 'Receita'],
    topProducts.map((p, i) => [i + 1, p.name, p.qty, fmtBRL(p.revenue)])
  )

  return (
    <>
      {/* Checkbox para ativar filtro por período customizado */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={useCustomRange}
            onChange={e => setUseCustomRange(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-black"
          />
          <span className="text-sm text-gray-600">Filtrar por período personalizado</span>
        </label>
        {useCustomRange && (
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1">De</label>
              <input type="date" value={dateFrom}
                onChange={e => onDateFromChange(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Até</label>
              <input type="date" value={dateTo}
                onChange={e => onDateToChange(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <button onClick={onFilter} disabled={loading}
              className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {loading ? 'Buscando...' : 'Aplicar'}
            </button>
            {(dateFrom || dateTo) && (
              <button onClick={onClearFilter}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Produtos mais vendidos</h3>
        <ExportMenu onPDF={handlePDF} onExcel={handleExcel} />
      </div>

      <div id="products-content" className="flex flex-col gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">Vendas por período</h4>
            {!useCustomRange && (
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {(['day', 'week', 'month'] as ProductPeriod[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors
                      ${period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            )}
            {useCustomRange && dateFrom && dateTo && (
              <span className="text-xs text-gray-400">
                {new Date(dateFrom + 'T00:00:00').toLocaleDateString('pt-BR')} até {new Date(dateTo + 'T00:00:00').toLocaleDateString('pt-BR')}
                {' · '}{chartGranularityLabel[chartGranularity]}
              </span>
            )}
          </div>
          <BarChart data={chartData} />
        </div>

        {topProducts.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Ranking</h4>
            <div className="flex flex-col gap-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5 text-right font-mono">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-700 truncate">{p.name}</span>
                      <span className="text-xs text-gray-400 ml-2 shrink-0">{p.qty} un · {fmtBRL(p.revenue)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${(p.qty / topProducts[0].qty) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

function CategoriesSection({ orders, categories, products, dateFrom, dateTo, loading, onDateFromChange, onDateToChange, onFilter, onClearFilter }: ReportsTabProps) {
  const normalized = useMemo(() => orders.map(o => ({ ...o, items: parseItems(o.items) })), [orders])

  // FIX: usar String(p.id) como chave para garantir consistência com item.product_id
  // que pode vir como string após JSON.parse dos items
  const productCategoryMap = useMemo(() => {
    const map: Record<string, string> = {}
    products.forEach(p => {
      const cat = categories.find(c => c.name === p.category)
      map[String(p.id)] = cat?.label ?? p.category ?? 'Sem categoria'
    })
    return map
  }, [products, categories])

  const catMap: Record<string, { name: string; revenue: number; qty: number }> = {}
  let uncatQty = 0
  let uncatRevenue = 0

  normalized.forEach(order => {
    order.items.forEach((item: any) => {
      const catLabel = productCategoryMap[String(item.product_id)] ?? 'Sem categoria'
      if (catLabel === 'Sem categoria') {
        uncatQty += item.quantity
        uncatRevenue += item.quantity * item.unit_price
      } else {
        if (!catMap[catLabel]) catMap[catLabel] = { name: catLabel, revenue: 0, qty: 0 }
        catMap[catLabel].revenue += item.quantity * item.unit_price
        catMap[catLabel].qty += item.quantity
      }
    })
  })

  const catList = Object.values(catMap).sort((a, b) => b.revenue - a.revenue)
  const totalRevenue = catList.reduce((s, c) => s + c.revenue, 0)

  const handlePDF = () => {
    const rows = catList.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${fmtBRL(c.revenue)}</td>
        <td>${totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(1) + '%' : '0%'}</td>
        <td>${c.qty}</td>
      </tr>`).join('')
    const win = window.open('', '_blank')!
    win.document.write(`
      <html><head><title>Vendas por Categoria</title>
      <style>
        body { font-family: sans-serif; padding: 32px; color: #111; }
        h2 { font-size: 18px; margin: 0 0 24px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; text-align: left; padding: 10px 14px; font-size: 12px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
        td { padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        tr:last-child td { border-bottom: none; }
      </style></head><body>
      <h2>Vendas por Categoria</h2>
      <table>
        <thead><tr><th>Categoria</th><th>Valor</th><th>% do Total</th><th>Qtd. Itens</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }
  const handleExcel = () => exportXLSX('vendas-por-categoria',
    ['Categoria', 'Valor', '% do Total', 'Qtd. Itens'],
    catList.map(c => [
      c.name,
      fmtBRL(c.revenue),
      totalRevenue > 0 ? `${((c.revenue / totalRevenue) * 100).toFixed(1)}%` : '0%',
      c.qty,
    ])
  )

  return (
    <>
      <DateFilterBar {...{ dateFrom, dateTo, loading, onDateFromChange, onDateToChange, onFilter, onClearFilter }} />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Vendas por Categoria</h3>
        <ExportMenu onPDF={handlePDF} onExcel={handleExcel} />
      </div>

      <div id="categories-content" className="flex flex-col gap-4">
        <UncategorizedBanner qty={uncatQty} revenue={uncatRevenue} />
        {catList.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400 text-sm">
            Nenhum dado encontrado para o período selecionado.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">Categoria</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">Valor</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">% do Total</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400">Qtd. Itens</th>
                </tr>
              </thead>
              <tbody>
                {catList.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-800">{c.name}</td>
                    <td className="px-5 py-3.5 text-gray-700">{fmtBRL(c.revenue)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-1.5 hidden sm:block">
                          <div className="bg-blue-500 h-1.5 rounded-full"
                            style={{ width: totalRevenue > 0 ? `${(c.revenue / totalRevenue) * 100}%` : '0%' }} />
                        </div>
                        <span className="text-gray-500 text-xs">
                          {totalRevenue > 0 ? `${((c.revenue / totalRevenue) * 100).toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{c.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export function ReportsTab(props: ReportsTabProps) {
  const { subTab } = props

  return (
    <div className="mt-6">
      {subTab === 'overview'   && <OverviewSection   {...props} />}
      {subTab === 'products'   && <ProductsSection   {...props} />}
      {subTab === 'categories' && <CategoriesSection {...props} />}
    </div>
  )
}
