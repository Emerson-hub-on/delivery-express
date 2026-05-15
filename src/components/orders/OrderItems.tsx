import { OrderItem } from '@/types/product'
import { formatCurrency } from './order.helpers'

interface OrderItemsProps {
  items: OrderItem[]
  expanded: boolean
}

export function OrderItems({ items, expanded }: OrderItemsProps) {
  if (items.length === 0) return null

  return (
    <ul className="space-y-1.5 mb-4">
      {items.slice(0, expanded ? items.length : 1).map((item, i) => (
        <li key={i} className="text-sm text-gray-600">
          <div className="flex justify-between">
            <span>
              <span className="text-gray-400 mr-1">{item.quantity}×</span>
              {item.product_name}
            </span>
            <span className="text-gray-500">{formatCurrency(item.unit_price * item.quantity)}</span>
          </div>

          {/* Adicionais */}
          {(item.addons ?? []).map((addon, j) => (
            <div key={j} className="flex justify-between text-xs text-gray-400 pl-4 mt-0.5">
              <span>↳ {addon.qty}× {addon.itemName}</span>
              {addon.subtotal > 0 && <span>+{formatCurrency(addon.subtotal)}</span>}
            </div>
          ))}

          {/* Observação */}
          {item.observation && (
            <p className="text-xs text-amber-600 italic pl-4 mt-0.5">OBS: "{item.observation}"</p>
          )}
        </li>
      ))}

      {!expanded && items.length > 1 && (
        <li className="text-xs text-gray-400">
          + {items.length - 1} {items.length - 1 === 1 ? 'item' : 'itens'} a mais
        </li>
      )}
    </ul>
  )
}
