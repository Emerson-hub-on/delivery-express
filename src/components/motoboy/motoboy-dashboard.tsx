// motoboy-dashboard.tsx

'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Motoboy } from '@/types/motoboy'


// ── Types ──────────────────────────────────────────────────────────────────────
export type OrderStatus = 'pending' | 'delivering' | 'completed' | 'cancelled'

export interface OrderItem {
  product_name: string
  quantity: number
  unit_price: number
}

export interface DeliveryOrder {
  id: number
  motoboy_id: string
  customer: string
  customer_phone: string
  address: {
    street?: string
    number?: string
    district?: string
    city?: string
    complement?: string
  }
  status: OrderStatus
  notes?: string
  total?: number
  payment_method?: string
  items?: OrderItem[]
  created_at: string
  dispatched_at?: string
  completed_at?: string
  delivery_pin?: string | null
  ifood_id?: string | null       // ← para identificar pedidos iFood
}

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<OrderStatus, {
  label: string; color: string; bg: string
  next: OrderStatus | null; nextLabel: string | null
}> = {
  pending:    { label: 'Pendente',  color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', next: 'delivering', nextLabel: 'Iniciar entrega' },
  delivering: { label: 'Em rota',   color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/30',     next: 'completed',  nextLabel: 'Confirmar entrega' },
  completed:  { label: 'Entregue',  color: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/30',   next: null,         nextLabel: null },
  cancelled:  { label: 'Cancelado', color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/30',       next: null,         nextLabel: null },
}

const STATUS_ICONS: Record<OrderStatus, string> = {
  pending:    '⏳',
  delivering: '🛵',
  completed:  '✅',
  cancelled:  '❌',
}

const PAYMENT_LABELS: Record<string, string> = {
  cash:        '💵 Dinheiro',
  credit_card: '💳 Cartão de crédito',
  debit_card:  '💳 Cartão de débito',
  pix:         '⚡ Pix',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function formatCurrency(value?: number) {
  if (value == null) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function todayLocalISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDisplayDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── PIN Modal ──────────────────────────────────────────────────────────────────
interface PinModalProps {
  isIfood: boolean
  onConfirm: (pin: string) => Promise<boolean>
  onCancel: () => void
}

function PinModal({ isIfood, onConfirm, onCancel }: PinModalProps) {
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [confirming, setConfirming] = useState(false)

  const handleConfirm = async () => {
    if (pinInput.length !== 4) { setPinError('Digite os 4 dígitos.'); return }
    setConfirming(true)
    const ok = await onConfirm(pinInput)
    setConfirming(false)
    if (!ok) { setPinError('Código incorreto. Tente novamente.'); setPinInput('') }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setPinInput(val)
    if (pinError) setPinError('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onCancel}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-xs flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
          <span className="text-2xl">{isIfood ? '🛵' : '🔐'}</span>
        </div>
        <div className="text-center">
          <p className="text-white font-semibold text-base">Confirmar entrega</p>
          {isIfood ? (
            <>
              <p className="text-gray-400 text-sm mt-1">Este é um pedido iFood.</p>
              <p className="text-gray-400 text-sm">Solicite o código de entrega de 4 dígitos ao cliente.</p>
              <div className="mt-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2">
                <p className="text-xs text-orange-400">O código foi enviado pelo iFood ao cliente no app.</p>
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-sm mt-1">Solicite ao cliente o código de 4 dígitos</p>
          )}
        </div>
        <input
          type="tel" inputMode="numeric" maxLength={4} value={pinInput}
          onChange={handleChange} placeholder="0000" autoFocus
          className={`w-full text-center text-3xl font-bold tracking-[0.4em] bg-gray-800 border rounded-xl px-4 py-3 text-white focus:outline-none transition-colors ${
            pinError ? 'border-red-500' : 'border-gray-600 focus:border-orange-500'
          }`}
        />
        {pinError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2 w-full">
            <p className="text-xs text-red-400 text-center">{pinError}</p>
          </div>
        )}
        <div className="flex gap-3 w-full">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-400 text-sm hover:bg-gray-800 transition-colors">Cancelar</button>
          <button onClick={handleConfirm} disabled={pinInput.length !== 4 || confirming}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-400 transition-colors disabled:opacity-40">
            {confirming ? 'Verificando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── OrderCard ──────────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onUpdateStatus,
  onRequestPin,
}: {
  order: DeliveryOrder
  onUpdateStatus: (id: number, status: OrderStatus) => Promise<void>
  onRequestPin: (order: DeliveryOrder) => void
}) {
  const cfg = STATUS_CONFIG[order.status]
  const [updating, setUpdating] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const isIfood = !!order.ifood_id

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!cfg.next) return
    if (cfg.next === 'completed' && order.delivery_pin) {
      onRequestPin(order)
      return
    }
    setUpdating(true)
    onUpdateStatus(order.id, cfg.next).finally(() => setUpdating(false))
  }

  const address = order.address || {}
  const fullAddress = [
    address.street, address.number, address.district,
    address.city, address.complement,
  ].filter(Boolean).join(', ')

  return (
    <div
      onClick={() => setExpanded(v => !v)}
      className={`bg-gray-900 border rounded-2xl overflow-hidden cursor-pointer ${
        isIfood ? 'border-orange-500/40' : 'border-gray-800'
      }`}
    >
      {/* iFood badge */}
      {isIfood && (
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-1.5 flex items-center gap-2">
          <span className="text-xs font-semibold text-orange-400">🛵 Pedido iFood</span>
          {order.delivery_pin && (
            <span className="ml-auto text-[10px] text-orange-300/70 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5">
              PIN de entrega ativo
            </span>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-base">{STATUS_ICONS[order.status]}</span>
          <span className="text-sm font-semibold text-white">Pedido #{order.id}</span>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-3">
        {/* Customer */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm shrink-0">👤</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{order.customer}</p>
            <a
              href={`tel:${order.customer_phone}`}
              onClick={e => e.stopPropagation()}
              className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
            >
              📞 {order.customer_phone}
            </a>
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm shrink-0">📍</div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">Endereço de entrega</p>
            <p className="text-sm text-gray-200">{fullAddress || 'Endereço não informado'}</p>
            {fullAddress && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-0.5 inline-block"
              >
                Abrir no Maps →
              </a>
            )}
          </div>
        </div>

        {/* Pagamento */}
        {order.payment_method && (
          <div className="bg-gray-800 rounded-xl px-3 py-2 flex items-center justify-between">
            <p className="text-xs text-gray-400">Pagamento</p>
            <p className="text-xs font-medium text-gray-200">
              {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
            </p>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="bg-gray-800 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Observações</p>
            <p className="text-xs text-gray-300">{order.notes}</p>
          </div>
        )}

        {/* Itens */}
        {(order.items ?? []).length > 0 && (
          <div>
            <button
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              className="text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1"
            >
              {expanded ? '▲ Ocultar itens' : `▼ Ver itens (${order.items!.length})`}
            </button>
            {expanded && (
              <div className="mt-2 bg-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left px-3 py-2 text-gray-400 font-medium">Produto</th>
                      <th className="text-center px-3 py-2 text-gray-400 font-medium">Qtd</th>
                      <th className="text-right px-3 py-2 text-gray-400 font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {order.items!.map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-gray-300">{item.product_name}</td>
                        <td className="px-3 py-2 text-center text-gray-400">{item.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-300">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-gray-500">🕐 Pedido: {formatDate(order.created_at)}</p>
            {order.completed_at && order.status === 'completed' && (
              <p className="text-xs text-green-400">✅ Entregue: {formatDate(order.completed_at)}</p>
            )}
          </div>
          {order.total != null && (
            <p className="text-sm font-semibold text-green-400">{formatCurrency(order.total)}</p>
          )}
        </div>
      </div>

      {/* Action */}
      {cfg.next && (
        <div className="px-4 pb-4" onClick={e => e.stopPropagation()}>
          <button
            onClick={handleNext}
            disabled={updating}
            className="w-full bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-orange-500/20"
          >
            {updating ? 'Atualizando…' : cfg.nextLabel}
            {cfg.next === 'completed' && order.delivery_pin && ' 🔐'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
interface MotoboyDashboardProps {
  motoboy: Motoboy
  onLogout: () => void
}

const FILTER_TABS: { key: 'active' | 'done'; label: string }[] = [
  { key: 'active', label: 'Ativos' },
  { key: 'done',   label: 'Concluídos' },
]

export function MotoboyDashboard({ motoboy, onLogout }: MotoboyDashboardProps) {
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'done'>('active')
  const [error, setError] = useState<string | null>(null)
  const [pinOrder, setPinOrder] = useState<DeliveryOrder | null>(null)

  const [dateFrom, setDateFrom] = useState(todayLocalISO)
  const [dateTo, setDateTo]     = useState(todayLocalISO)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('motoboy_id', String(motoboy.id))
        .eq('delivery_type', 'delivery')
        .order('created_at', { ascending: false })

      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
      if (dateTo)   query = query.lte('created_at', `${dateTo}T23:59:59`)

      const { data, error: dbError } = await query
      if (dbError) throw new Error(dbError.message)

      const mapped = (data ?? []).map((o: any): DeliveryOrder => ({
        id:             o.id,
        motoboy_id:     o.motoboy_id,
        customer:       o.customer,
        customer_phone: o.customer_phone,
        address:        o.address || {},
        status:         o.status,
        notes:          o.notes,
        total:          o.total,
        payment_method: o.payment_method,
        items:          o.items ?? [],
        created_at:     o.created_at,
        dispatched_at:  o.dispatched_at,
        completed_at:   o.completed_at,
        delivery_pin:   o.delivery_pin ?? null,
        ifood_id:       o.ifood_id ?? null,   // ← mapeado aqui
      }))

      setOrders(mapped)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [motoboy.id, dateFrom, dateTo])

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel(`motoboy-orders-${motoboy.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const updated = payload.new as any
        if (updated?.motoboy_id === String(motoboy.id)) { fetchOrders(); return }
        if ((payload.old as any)?.motoboy_id === String(motoboy.id)) { fetchOrders(); return }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders, motoboy.id])

  const handleUpdateStatus = async (id: number, status: OrderStatus) => {
    try {
      const patch: Record<string, any> = { status }
      if (status === 'completed') patch.completed_at = new Date().toISOString()

      const { error: dbError } = await supabase
        .from('orders')
        .update(patch)
        .eq('id', id)

      if (dbError) throw new Error(dbError.message)

      setOrders(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handlePinConfirm = async (pin: string): Promise<boolean> => {
    if (!pinOrder || pin !== pinOrder.delivery_pin) return false
    setPinOrder(null)
    await handleUpdateStatus(pinOrder.id, 'completed')
    return true
  }

  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'delivering')
  const doneOrders   = orders.filter(o => o.status === 'completed' || o.status === 'cancelled')
  const displayed    = filter === 'active' ? activeOrders : doneOrders

  const isToday = dateFrom === todayLocalISO() && dateTo === todayLocalISO()

  return (
    <div className="min-h-screen bg-gray-950">
      {pinOrder && (
        <PinModal
          isIfood={!!pinOrder.ifood_id}
          onConfirm={handlePinConfirm}
          onCancel={() => setPinOrder(null)}
        />
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-orange-500/30">
              {motoboy.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{motoboy.name}</p>
              <p className="text-xs text-gray-500">📱 {motoboy.phone}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Filtro de datas */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 mb-5 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">De</label>
            <input
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-500 uppercase tracking-wide">Até</label>
            <input
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>
          <div className="flex gap-2 pb-0.5">
            <button onClick={fetchOrders}
              className="text-xs bg-orange-500 hover:bg-orange-400 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
              Filtrar
            </button>
            {!isToday && (
              <button onClick={() => { setDateFrom(todayLocalISO()); setDateTo(todayLocalISO()) }}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg font-medium transition-colors">
                Hoje
              </button>
            )}
          </div>
          {(dateFrom || dateTo) && (
            <span className="text-[10px] text-gray-500 ml-auto self-center">
              📅 {dateFrom === dateTo ? formatDisplayDate(dateFrom) : `${formatDisplayDate(dateFrom)} → ${formatDisplayDate(dateTo)}`}
            </span>
          )}
        </div>

        {/* Summary pills */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-orange-400">{activeOrders.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Ativos</p>
          </div>
          <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-green-400">
              {orders.filter(o => o.status === 'completed').length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Entregues</p>
          </div>
          <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {orders.filter(o => o.status === 'delivering').length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Em rota</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 mb-5">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${
                filter === tab.key
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                filter === tab.key ? 'bg-white/20' : 'bg-gray-700'
              }`}>
                {tab.key === 'active' ? activeOrders.length : doneOrders.length}
              </span>
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Refresh */}
        <div className="flex justify-end mb-3">
          <button onClick={fetchOrders} className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
            🔄 Atualizar
          </button>
        </div>

        {/* Orders */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl h-48 animate-pulse" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">{filter === 'active' ? '🛵' : '✅'}</p>
            <p className="text-sm text-gray-500">
              {filter === 'active' ? 'Nenhum pedido ativo no momento.' : 'Nenhum pedido concluído ainda.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleUpdateStatus}
                onRequestPin={setPinOrder}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
