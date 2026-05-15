'use client'
import { useState, useMemo } from 'react'
import { useMyOrders } from '@/hooks/Usemyorders'
import { useCustomerAddress } from '@/hooks/useCustomerAddress'
import { todayLocalISO, toLocalDateISO } from './order.helpers'
import { AddressSection } from './AddressSection'
import { DateFilter } from './DateFilter'
import { OrderCard } from './OrderCard'

export function MyOrdersList() {
  const { orders, loading, error, cancellingId, cancelOrder } = useMyOrders()
  const { address, loading: loadingAddress, saving, saveAddress } = useCustomerAddress()

  const today = todayLocalISO()
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo,   setDateTo]   = useState(today)

  const filteredOrders = useMemo(() => {
    if (!dateFrom && !dateTo) return orders
    return orders.filter(o => {
      const d = toLocalDateISO(o.created_at)
      if (dateFrom && d < dateFrom) return false
      if (dateTo   && d > dateTo)   return false
      return true
    })
  }, [orders, dateFrom, dateTo])

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse mb-6">
          <div className="h-3 w-32 bg-gray-100 rounded mb-3" />
          <div className="h-4 w-48 bg-gray-100 rounded mb-1" />
          <div className="h-3 w-36 bg-gray-50 rounded" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
            <div className="flex justify-between mb-4">
              <div className="space-y-1.5">
                <div className="h-3 w-24 bg-gray-100 rounded" />
                <div className="h-4 w-16 bg-gray-100 rounded" />
              </div>
              <div className="h-6 w-24 bg-gray-100 rounded-full" />
            </div>
            <div className="space-y-1.5 mb-4">
              <div className="h-3 w-full bg-gray-50 rounded" />
              <div className="h-3 w-3/4 bg-gray-50 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
        {error}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <AddressSection
        address={address}
        loading={loadingAddress}
        saving={saving}
        onSave={saveAddress}
      />

      {orders.length > 0 && (
        <DateFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          totalFiltered={filteredOrders.length}
          totalAll={orders.length}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onToday={() => { setDateFrom(today); setDateTo(today) }}
          onShowAll={() => { setDateFrom(''); setDateTo('') }}
        />
      )}

      {orders.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🛍️</p>
          <p className="text-sm font-medium text-gray-700">Nenhum pedido ainda</p>
          <p className="text-xs text-gray-400 mt-1">
            Seus pedidos vão aparecer aqui assim que você fizer um.
          </p>
        </div>
      )}

      {orders.length > 0 && filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">📭</p>
          <p className="text-sm font-medium text-gray-700">Nenhum pedido nesse período</p>
          <p className="text-xs text-gray-400 mt-1">
            Tente ampliar o intervalo ou{' '}
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="underline text-gray-600"
            >
              ver todos os pedidos
            </button>
            .
          </p>
        </div>
      )}

      {filteredOrders.length > 0 && (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onCancel={cancelOrder}
              cancelling={cancellingId === order.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}