'use client'
import { useEffect, useState } from 'react'
import { Order } from "@/types/product";
import { updateOrderStatus, assignMotoboy } from '@/services/orders'
import { getPaymentLabel } from '@/lib/payment-labels'
import { getAllMotoboys } from '@/services/motoboys'
import { Motoboy } from '@/types/motoboy'
import React from 'react';

const STATUS_ORDER_DELIVERY = ['pending', 'confirmed', 'delivering', 'completed', 'cancelled'] as const
const STATUS_ORDER_PICKUP = ['pending', 'Pronto p/ retirada', 'completed', 'cancelled'] as const

const STATUS_OPTIONS_DELIVERY = [
  { value: 'pending',    label: 'Pendente',         active: 'bg-yellow-400 text-white' },
  { value: 'confirmed',  label: 'Pago (Pix)',        active: 'bg-green-500 text-white'  },
  { value: 'delivering', label: 'Pronto p/ entrega', active: 'bg-blue-500 text-white'   },
  { value: 'completed',  label: 'Concluído',         active: 'bg-green-500 text-white'  },
  { value: 'cancelled',  label: 'Cancelado',         active: 'bg-red-500 text-white'    },
] as const

const STATUS_OPTIONS_PICKUP = [
  { value: 'pending',            label: 'Pendente',          active: 'bg-yellow-400 text-white'  },
  { value: 'confirmed',          label: 'Pago (Pix)',         active: 'bg-green-500 text-white'   },
  { value: 'Pronto p/ retirada', label: 'Pronto p/ retirada', active: 'bg-purple-500 text-white' },
  { value: 'completed',          label: 'Concluído',          active: 'bg-green-500 text-white'  },
  { value: 'cancelled',          label: 'Cancelado',          active: 'bg-red-500 text-white'    },
] as const

const DELIVERY_TYPE_BADGE: Record<string, string> = {
  delivery: '🛵 Entrega',
  pickup:   '🏪 Retirada',
}

type KanbanColumn = 'all' | 'preparing' | 'ready' | 'completed'

const MOBILE_TABS: { value: KanbanColumn; label: string }[] = [
  { value: 'all',       label: 'Todos'     },
  { value: 'preparing', label: 'Em preparo'},
  { value: 'ready',     label: 'Pronto'    },
  { value: 'completed', label: 'Concluído' },
]

const COLUMN_STATUSES: Record<Exclude<KanbanColumn, 'all'>, string[]> = {
  preparing: ['pending', 'confirmed'],
  ready:     ['delivering', 'Pronto p/ retirada'],
  completed: ['completed', 'cancelled'],
}

const COLUMN_CONFIG: Record<Exclude<KanbanColumn, 'all'>, { title: string; color: string; dot: string }> = {
  preparing: { title: 'Em preparo',         color: 'border-t-yellow-400', dot: 'bg-yellow-400' },
  ready:     { title: 'Pronto / A caminho', color: 'border-t-blue-500',   dot: 'bg-blue-500'   },
  completed: { title: 'Concluído',          color: 'border-t-green-500',  dot: 'bg-green-500'  },
}

function fmt(value: unknown): string {
  const n = Number(value)
  return isNaN(n) ? '0,00' : n.toFixed(2).replace('.', ',')
}

function todayLocalISO() {
  const d = new Date()
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

function formatDisplayDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife' })
}

interface OrdersTabProps {
  orders: Order[]
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>
  loading: boolean
  onError: (msg: string | null) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  onFilter: () => void
  onClearFilter: () => void
  orderSearch: string
  searchedOrder: Order | null
  searchingOrder: boolean
  onClearSearch: () => void
}

export function OrdersTab({
  orders, setOrders, loading, onError,
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  onFilter, onClearFilter, orderSearch,
  searchedOrder, searchingOrder, onClearSearch,
}: OrdersTabProps) {
  const [expandedOrder, setExpandedOrder]               = useState<number | null>(null)
  const [mobileTab, setMobileTab]                       = useState<KanbanColumn>('all')
  const [motoboys, setMotoboys]                         = useState<Motoboy[]>([])
  const [motoboyDialogOrderId, setMotoboyDialogOrderId] = useState<number | null>(null)
  const [acceptingId, setAcceptingId]                   = useState<number | null>(null)

  useEffect(() => { getAllMotoboys().then(setMotoboys).catch(() => {}) }, [])

  const today           = todayLocalISO()
  const isFilteredToday = dateFrom === today && dateTo === today

  const isPickup         = (order: Order) => order.delivery_type === 'pickup'
  const getStatusOrder   = (order: Order) => isPickup(order) ? STATUS_ORDER_PICKUP  : STATUS_ORDER_DELIVERY
  const getStatusOptions = (order: Order) => isPickup(order) ? STATUS_OPTIONS_PICKUP : STATUS_OPTIONS_DELIVERY
  const isIfoodOrder     = (order: Order) => !!order.ifood_id

  const handleAcceptIfood = async (order: Order) => {
    if (!order.ifood_id) return
    if (!confirm(`Aceitar pedido #${order.code ?? order.id} do iFood?`)) return
    setAcceptingId(order.id)
    try {
      const res = await fetch('/api/ifood/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ifoodId: order.ifood_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao confirmar pedido')
      setOrders(prev =>
        prev.map(o => o.id === order.id ? { ...o, status: 'confirmed', ...(data.order ?? {}) } : o)
      )
    } catch (e: any) {
      onError(e.message)
    } finally {
      setAcceptingId(null)
    }
  }

  const dispatchOrder = async (id: number) => {
    try {
      const updated = await updateOrderStatus(id, 'delivering')
      setOrders(prev => prev.map(o =>
        o.id === id ? { ...o, status: 'delivering', dispatched_at: updated.dispatched_at } : o
      ))
      const order = orders.find(o => o.id === id)
      if (order?.ifood_id) {
        fetch('/api/ifood/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ifoodId: order.ifood_id }),
        }).catch(err => console.warn('[iFood Dispatch] Falha silenciosa:', err.message))
      }
    } catch (e: any) { onError(e.message) }
  }

  const handleUpdateStatus = async (id: number, status: string) => {
    const order = orders.find(o => o.id === id) ?? searchedOrder ?? null
    if (!order) return
    const statusOrder  = getStatusOrder(order)
    const currentIndex = statusOrder.indexOf(order.status as any)
    const nextIndex    = statusOrder.indexOf(status as any)
    if (nextIndex <= currentIndex) return
    if (status === 'delivering' && !isPickup(order) && !order.motoboy_id) {
      setMotoboyDialogOrderId(id); return
    }
    const confirmMessages: Record<string, string> = {
      delivering:           'Deseja despachar esse pedido?',
      'Pronto p/ retirada': 'O pedido está pronto para retirada?',
      completed:            'Esse pedido foi finalizado?',
      cancelled:            'Deseja realmente cancelar esse pedido?',
    }
    if (confirmMessages[status] && !confirm(confirmMessages[status])) return
    try {
      const updated = await updateOrderStatus(id, status)
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: updated.status, dispatched_at: updated.dispatched_at, completed_at: updated.completed_at } : o))
    } catch (e: any) { onError(e.message) }
  }

  const handleAssignMotoboy = async (orderId: number, motoboyId: string | null) => {
    try {
      const updated = await assignMotoboy(orderId, motoboyId)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, motoboy_id: updated.motoboy_id } : o))
    } catch (e: any) { onError(e.message) }
  }

  const getOrdersForColumn = (column: Exclude<KanbanColumn, 'all'>) =>
    orders.filter(o => COLUMN_STATUSES[column].includes(o.status))

  const getOrdersForMobile = () =>
    mobileTab === 'all' ? orders : getOrdersForColumn(mobileTab)

  const dialogOrder               = motoboyDialogOrderId !== null ? (orders.find(o => o.id === motoboyDialogOrderId) ?? (searchedOrder?.id === motoboyDialogOrderId ? searchedOrder : null)) : null
  const dialogIsAlreadyDispatched = dialogOrder?.status === 'delivering'

  return (
    <div className="mt-6 flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <h3 className="text-sm font-medium text-gray-900 mb-4 shrink-0">Pedidos</h3>

      {/* ── Filtro de data ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4 flex flex-wrap items-end gap-3 shrink-0">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-400 uppercase tracking-wide">De</label>
          <input type="date" value={dateFrom} onChange={e => onDateFromChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-400 uppercase tracking-wide">Até</label>
          <input type="date" value={dateTo} onChange={e => onDateToChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div className="flex gap-2 pb-0.5">
          <button onClick={onFilter}
            className="text-sm px-4 py-1.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors">
            Filtrar
          </button>
          {!isFilteredToday && (
            <button onClick={onClearFilter}
              className="text-sm px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              Hoje
            </button>
          )}
        </div>
        {(dateFrom || dateTo) && (
          <span className="text-xs text-gray-400 ml-auto self-center">
            📅 {dateFrom === dateTo ? formatDisplayDate(dateFrom) : `${formatDisplayDate(dateFrom)} → ${formatDisplayDate(dateTo)}`}
          </span>
        )}
      </div>

      {/* ── Resultado de busca por número ── */}
      {orderSearch.length > 0 && (
        <div className="mb-4 shrink-0 max-h-[60vh] overflow-y-auto">
          {searchingOrder ? (
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-5 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin shrink-0" />
              <p className="text-sm text-gray-400">Buscando pedido <span className="font-medium text-gray-600">#{orderSearch}</span>…</p>
            </div>
          ) : searchedOrder ? (
            <div className="bg-white border-2 border-gray-900 rounded-xl overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 sticky top-0 z-10">  {/* ← sticky no header */}
              <span className="text-xs font-semibold text-white">🔍 Pedido #{searchedOrder.code ?? searchedOrder.id} encontrado</span>
              <button onClick={onClearSearch} className="text-gray-400 hover:text-white text-xs transition-colors">✕ Fechar busca</button>
            </div>
              <div className="p-3">
                <OrderCard
                  order={searchedOrder}
                  expanded={true}
                  onToggle={() => {}}
                  onUpdateStatus={handleUpdateStatus}
                  onChangeMotoboy={id => setMotoboyDialogOrderId(id)}
                  onAcceptIfood={handleAcceptIfood}
                  isPickup={isPickup(searchedOrder)}
                  isIfood={isIfoodOrder(searchedOrder)}
                  isAccepting={acceptingId === searchedOrder.id}
                  statusOptions={getStatusOptions(searchedOrder)}
                  statusOrder={getStatusOrder(searchedOrder)}
                  motoboys={motoboys}
                  highlighted={false}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-5 flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Nenhum pedido encontrado com o número <span className="font-medium text-gray-600">#{orderSearch}</span>.
              </p>
              <button onClick={onClearSearch} className="text-xs text-gray-400 hover:text-gray-600 transition-colors ml-4 shrink-0">✕</button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shrink-0">
          <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shrink-0">
          <p className="text-sm text-gray-400 text-center py-8">Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">

          {/* ── Mobile: abas ── */}
          <div className="flex md:hidden gap-1 mb-4 bg-gray-100 p-1 rounded-xl shrink-0">
            {MOBILE_TABS.map(t => (
              <button key={t.value} onClick={() => setMobileTab(t.value)}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors
                  ${mobileTab === t.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
                <span className="ml-1 text-[10px] text-gray-400">
                  ({t.value === 'all' ? orders.length : getOrdersForColumn(t.value).length})
                </span>
              </button>
            ))}
          </div>

          {/* ── Mobile: lista ── */}
          <div className="flex md:hidden flex-col gap-2 overflow-y-auto flex-1 pr-1">
            {getOrdersForMobile().length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-gray-400 text-center py-8">Nenhum pedido nessa etapa.</p>
              </div>
            ) : (
              getOrdersForMobile().map(order => (
                <OrderCard key={order.id} order={order}
                  expanded={expandedOrder === order.id}
                  onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  onUpdateStatus={handleUpdateStatus}
                  onChangeMotoboy={id => setMotoboyDialogOrderId(id)}
                  onAcceptIfood={handleAcceptIfood}
                  isPickup={isPickup(order)}
                  isIfood={isIfoodOrder(order)}
                  isAccepting={acceptingId === order.id}
                  statusOptions={getStatusOptions(order)}
                  statusOrder={getStatusOrder(order)}
                  motoboys={motoboys}
                  highlighted={false}
                />
              ))
            )}
          </div>

          {/* ── Desktop: 3 colunas kanban ── */}
          <div className="hidden md:grid md:grid-cols-3 gap-6 flex-1 min-h-0">
            {(['preparing', 'ready', 'completed'] as const).map(col => {
              const config    = COLUMN_CONFIG[col]
              const colOrders = getOrdersForColumn(col)
              return (
                <div key={col}
                  className={`bg-white border border-gray-200 border-t-4 ${config.color} rounded-xl p-4 flex flex-col min-h-0`}>
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                    <h4 className="text-sm font-semibold text-gray-700">{config.title}</h4>
                    <span className="ml-auto text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                      {colOrders.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1">
                    {colOrders.length === 0 ? (
                      <p className="text-xs text-gray-300 text-center py-6">Nenhum pedido</p>
                    ) : (
                      colOrders.map(order => (
                        <OrderCard key={order.id} order={order}
                          expanded={expandedOrder === order.id}
                          onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                          onUpdateStatus={handleUpdateStatus}
                          onChangeMotoboy={id => setMotoboyDialogOrderId(id)}
                          onAcceptIfood={handleAcceptIfood}
                          isPickup={isPickup(order)}
                          isIfood={isIfoodOrder(order)}
                          isAccepting={acceptingId === order.id}
                          statusOptions={getStatusOptions(order)}
                          statusOrder={getStatusOrder(order)}
                          motoboys={motoboys}
                          highlighted={false}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {motoboyDialogOrderId !== null && dialogOrder && (
        <MotoboyDialog
          order={dialogOrder}
          motoboys={motoboys}
          isSwap={dialogIsAlreadyDispatched}
          onAssign={async (motoboyId) => {
            await handleAssignMotoboy(motoboyDialogOrderId, motoboyId)
            setMotoboyDialogOrderId(null)
            if (!dialogIsAlreadyDispatched) await dispatchOrder(motoboyDialogOrderId)
          }}
          onClose={() => setMotoboyDialogOrderId(null)}
        />
      )}
    </div>
  )
}

// ── Card de pedido ────────────────────────────────────────────

interface OrderCardProps {
  order: Order
  expanded: boolean
  onToggle: () => void
  onUpdateStatus: (id: number, status: string) => void
  onChangeMotoboy: (orderId: number) => void
  onAcceptIfood: (order: Order) => void
  isPickup: boolean
  isIfood: boolean
  isAccepting: boolean
  statusOptions: typeof STATUS_OPTIONS_DELIVERY | typeof STATUS_OPTIONS_PICKUP
  statusOrder: typeof STATUS_ORDER_DELIVERY | typeof STATUS_ORDER_PICKUP
  motoboys: Motoboy[]
  highlighted: boolean
}

function OrderCard({
  order, expanded, onToggle, onUpdateStatus, onChangeMotoboy,
  onAcceptIfood, isPickup, isIfood, isAccepting,
  statusOptions, statusOrder, motoboys, highlighted,
}: OrderCardProps) {

  const isPending      = order.status === 'pending'
  const isNotFinished  = !['completed', 'cancelled'].includes(order.status)

  return (
    <div className={[
      'border rounded-lg overflow-hidden bg-white shrink-0',
      highlighted
        ? 'order-highlight'
        : isIfood && isPending
          ? 'border-orange-300 ring-1 ring-orange-200'
          : 'border-gray-100',
    ].join(' ')}>

      {isIfood && isPending && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">🛵</span>
            <span className="text-xs font-semibold text-orange-700">Pedido iFood — aguardando aceitação</span>
          </div>
          <button
            onClick={() => onAcceptIfood(order)}
            disabled={isAccepting}
            className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 shrink-0"
          >
            {isAccepting ? 'Aceitando…' : '✓ Aceitar pedido'}
          </button>
        </div>
      )}

      <div className="flex flex-col px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors gap-1" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">Pedido #{order.code ?? order.id}</p>
            {isIfood && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-medium">iFood</span>
            )}
          </div>
          {order.delivery_type && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
              ${isPickup ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
              {DELIVERY_TYPE_BADGE[order.delivery_type] ?? order.delivery_type}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-0.5 mt-0.5">
          <p className="text-[10px] text-gray-400 font-medium">Status time:</p>
          <span className="text-xs text-gray-400">🕐 Pedido: {formatDateTime(order.created_at)}</span>
          {order.dispatched_at && (
            <span className="text-xs text-blue-400">🛵 Despachado: {formatDateTime(order.dispatched_at)}</span>
          )}
          {order.completed_at && (
            <span className={`text-xs ${order.status === 'cancelled' ? 'text-red-400' : 'text-green-500'}`}>
              {order.status === 'cancelled' ? '❌ Cancelado' : '✅ Concluído'}: {formatDateTime(order.completed_at)}
            </span>
          )}
        </div>

        <span className="text-sm font-medium text-green-600">R$ {fmt(order.total)}</span>

        <div onClick={e => e.stopPropagation()} className="flex flex-wrap gap-1 mt-1">
          {statusOptions.map(option => {
            const currentIndex = statusOrder.indexOf(order.status as any)
            const optionIndex  = statusOrder.indexOf(option.value as any)
            const isActive     = order.status === option.value
            const isBlocked    = optionIndex <= currentIndex && !isActive
            return (
              <button key={option.value}
                onClick={() => !isBlocked && onUpdateStatus(order.id, option.value)}
                className={`px-2 py-1 text-xs rounded-md transition-colors
                  ${isActive ? option.active : isBlocked
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : 'bg-white text-gray-400 border border-gray-200 hover:border-gray-400'}`}>
                {option.label}
              </button>
            )
          })}
        </div>

        <span className="text-xs text-gray-400 mt-0.5">{expanded ? '▲ Ver menos' : '▼ Ver mais'}</span>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">

          <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Cliente</p>
            <p className="text-sm font-medium text-gray-800">{order.customer ?? '—'}</p>
            {order.customer_phone && <p className="text-xs text-gray-500 mt-0.5">📱 {order.customer_phone}</p>}
            {!isPickup && order.address && (
              <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Endereço</p>
                <p className="text-xs text-gray-600">
                  {order.address.street}, {order.address.number}
                  {order.address.complement ? ` — ${order.address.complement}` : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {order.address.district}, {order.address.city} / {order.address.state?.toUpperCase() ?? ''}
                </p>
              </div>
            )}
            {isPickup && (
              <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                <p className="text-xs text-purple-600 font-medium">🏪 Cliente retira no local</p>
              </div>
            )}
          </div>

          {!isPickup && (
            <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Motoboy</p>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  {order.motoboy_id
                    ? motoboys.find(m => m.id === order.motoboy_id)?.name ?? '—'
                    : <span className="text-gray-400 italic text-xs">Não atribuído</span>}
                </p>
                {isNotFinished && (
                  <button onClick={() => onChangeMotoboy(order.id)}
                    className="text-xs px-3 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                    {order.motoboy_id ? 'Trocar' : 'Atribuir'}
                  </button>
                )}
              </div>
            </div>
          )}

          {(order.items ?? []).length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left pb-2 font-medium">Produto</th>
                  <th className="text-center pb-2 font-medium">Qtd</th>
                  <th className="text-right pb-2 font-medium">Unitário</th>
                  <th className="text-right pb-2 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
  {(order.items ?? []).map((item, i) => {
    console.log(`[OrderCard] item[${i}]:`, item)
    return (
      <React.Fragment key={i}>
        <tr>
          <td className="py-1.5 text-gray-700">{item.product_name}</td>
          <td className="py-1.5 text-center text-gray-500">{item.quantity}</td>
          <td className="py-1.5 text-right text-gray-500">R$ {fmt(item.unit_price)}</td>
          <td className="py-1.5 text-right text-gray-700 font-medium">R$ {fmt(item.quantity * item.unit_price)}</td>
        </tr>

        {(item.addons ?? []).map((addon, j) => (
          <tr key={`addon-${i}-${j}`}>
            <td className="pb-1 pl-3 text-gray-400 text-[10px]" colSpan={2}>
              ↳ {addon.qty}× {addon.itemName}
            </td>
            <td className="pb-1 text-right text-gray-400 text-[10px]">
              {addon.subtotal > 0 ? `+R$ ${fmt(addon.subtotal)}` : ''}
            </td>
            <td />
          </tr>
        ))}

        {item.observation && (
          <tr>
            <td className="pb-1.5 pl-1 text-[10px] text-amber-600 italic" colSpan={4}>
              OBS: "{item.observation}"
            </td>
          </tr>
        )}
      </React.Fragment>
    )
  })}
</tbody>
            </table>
          )}

          <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Pagamento</p>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-gray-800">{getPaymentLabel(order.payment_method)}</p>
                {order.payment_method === 'dinheiro' && (
                  <span className="text-xs text-gray-500">
                    {order.change === null || order.change === undefined
                      ? '💵 Pagamento na entrega (dinheiro)'
                      : order.change === 0
                        ? '💵 Sem troco (valor exato)'
                        : `💵 Troco para: R$ ${fmt((order.change ?? 0) + (order.total ?? 0))} — Troco: R$ ${fmt(order.change)}`}
                  </span>
                )}
                {order.payment_method === 'pix' && order.status === 'confirmed' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200 w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    ✓ Pagamento confirmado
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total do pedido:</p>
                <span className="text-sm font-medium text-green-600">R$ {fmt(order.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dialog motoboy ────────────────────────────────────────────

interface MotoboyDialogProps {
  order: Order
  motoboys: Motoboy[]
  isSwap: boolean
  onAssign: (motoboyId: string) => Promise<void>
  onClose: () => void
}

function MotoboyDialog({ order, motoboys, isSwap, onAssign, onClose }: MotoboyDialogProps) {
  const [selected, setSelected] = useState<string | null>(order.motoboy_id ?? null)
  const [saving, setSaving]     = useState(false)
  const activeMotoboys          = motoboys.filter(m => m.active)

  const handleConfirm = async () => {
    if (!selected) return
    setSaving(true)
    try { await onAssign(selected) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {isSwap ? 'Trocar motoboy' : 'Atribuir motoboy'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {isSwap
              ? <>Selecione o novo motoboy para o pedido <span className="font-medium text-gray-700">#{order.code ?? order.id}</span>.</>
              : <>Para despachar o pedido <span className="font-medium text-gray-700">#{order.code ?? order.id}</span>, selecione um motoboy ativo.</>}
          </p>
        </div>

        {activeMotoboys.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2.5">
            <p className="text-sm text-yellow-700">Nenhum motoboy ativo cadastrado.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {activeMotoboys.map(m => (
              <button key={m.id} onClick={() => setSelected(m.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left
                  ${selected === m.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 bg-gray-800">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-400">📱 {m.phone}</p>
                </div>
                {selected === m.id && <span className="ml-auto text-gray-900 text-base">✓</span>}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={handleConfirm}
            disabled={!selected || saving || activeMotoboys.length === 0}
            className="flex-1 bg-black text-white text-sm py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40">
            {saving ? 'Salvando…' : isSwap ? 'Confirmar troca' : 'Confirmar e despachar'}
          </button>
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}