'use client'
import { useState } from 'react'
import { Order } from '@/types/product'
import { getPaymentLabel } from '@/lib/payment-labels'
import { formatDate, formatCurrency, DELIVERY_TYPE_BADGE } from './order.helpers'
import { StatusBadge }  from './StatusBadge'
import { DeliveryPin }  from './DeliveryPin'
import { OrderItems }   from './OrderItems'
import { CancelButton } from './CancelButton'

interface OrderCardProps {
  order: Order
  onCancel: (id: number) => void
  cancelling: boolean
}

export function OrderCard({ order, onCancel, cancelling }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false)

  const items         = Array.isArray(order.items) ? order.items : []
  const deliveryBadge = order.delivery_type ? DELIVERY_TYPE_BADGE[order.delivery_type] : null
  const canCancel     =
    order.status === 'pending' ||
    (order.status === 'confirmed' && order.payment_method === 'pix')

  return (
    <div
      className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => setExpanded(e => !e)}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{formatDate(order.created_at)}</p>
          <p className="text-sm font-semibold text-gray-900">#{order.code ?? order.id}</p>

          {/* PIN de entrega */}
          {order.delivery_type === 'delivery' && order.delivery_pin && (
            <DeliveryPin pin={order.delivery_pin} />
          )}

          {order.customer_phone && (
            <p className="text-xs text-gray-500 mt-0.5">📱 {order.customer_phone}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={order.status ?? 'pending'} />
          {deliveryBadge && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${deliveryBadge.color}`}>
              {deliveryBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* Itens */}
      <OrderItems items={items} expanded={expanded} />

      {/* Seta Ver mais */}
      {(order.delivery_type === 'delivery' || order.delivery_type === 'pickup') && (
        <p className="text-xs text-gray-400 mb-2">{expanded ? '▲ Ver menos' : '▼ Ver mais'}</p>
      )}

      {/* Status de pagamento */}
      {order.payment_method && (
        <div className="flex flex-col gap-1">
          {order.payment_status === 'paid' || (order.payment_method === 'pix' && order.status === 'confirmed') ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              ✓ Pago · {getPaymentLabel(order.payment_method)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              {order.delivery_type === 'pickup' ? 'Pagar na retirada' : 'Pagar na entrega'} · {getPaymentLabel(order.payment_method)}
            </span>
          )}

          {order.payment_method === 'dinheiro' && (
            <span className="text-xs text-gray-500 pl-1">
              {order.change === null || order.change === undefined
                ? '💵 Pagamento em dinheiro'
                : order.change === 0
                  ? '💵 Sem troco (valor exato)'
                  : `💵 Troco para: ${((order.change ?? 0) + (order.total ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} — Troco: ${(order.change ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
            </span>
          )}
        </div>
      )}

      {/* Seção expansível: endereço */}
      {expanded && order.delivery_type === 'delivery' && order.address && (
        <div className="mb-4 pt-2 border-t border-gray-50">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Endereço de entrega</p>
          <p className="text-xs text-gray-600">
            {order.address.street}, {order.address.number}
            {order.address.complement ? ` — ${order.address.complement}` : ''}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {order.address.district}, {order.address.city} / {order.address.state.toUpperCase()}
          </p>
        </div>
      )}

      {/* Rodapé: total + cancelar */}
      <div
        className="flex items-center justify-between pt-3 border-t border-gray-50"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.total ?? 0)}</p>

        {canCancel && (
          <CancelButton
            cancelling={cancelling}
            onCancel={() => onCancel(order.id)}
          />
        )}
      </div>
    </div>
  )
}