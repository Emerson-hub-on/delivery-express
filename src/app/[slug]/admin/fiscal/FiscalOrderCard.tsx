'use client'
import { useState } from 'react'
import { Order } from '@/types/product'

interface FiscalOrderCardProps {
  order: Order
  emitting: boolean
  configOk: boolean
  onEmitir: (order: Order, cpfCnpj?: string) => void
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function maskCpfCnpj(raw: string) {
  const d = raw.replace(/\D/g, '')
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4')
  }
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5')
}

const STATUS_BADGE: Record<string, string> = {
  rejeitado: 'bg-red-50 text-red-600 border border-red-100',
  pendente:  'bg-amber-50 text-amber-600 border border-amber-100',
}

export function FiscalOrderCard({ order, emitting, configOk, onEmitir }: FiscalOrderCardProps) {
  const [cpfCnpj, setCpfCnpj] = useState(order.cpf_cnpj_consumidor ?? '')
  const [expanded, setExpanded] = useState(false)

  const isRejeitado = order.nfce_status === 'rejeitado'

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all
      ${isRejeitado ? 'border-red-200' : 'border-gray-200'}`}
    >
      {/* ── Cabeçalho ───────────────────────────────────── */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">#{order.code}</span>
            <span className="text-xs text-gray-400">{formatDateTime(order.created_at)}</span>
            {order.nfce_status && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[order.nfce_status] ?? ''}`}>
                {order.nfce_status}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-0.5 truncate">{order.customer}</p>
          {order.nfce_motivo && isRejeitado && (
            <p className="text-xs text-red-500 mt-1">↳ {order.nfce_motivo}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold text-gray-900">{formatCurrency(order.total)}</span>
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            {expanded ? 'Fechar ▲' : 'Detalhes ▼'}
          </button>
        </div>
      </div>

      {/* ── Itens expandidos ─────────────────────────────── */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-50">
          <div className="mt-3 space-y-1">
            {order.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-xs text-gray-600">
                <span>{item.quantity}× {item.product_name}</span>
                <span>{formatCurrency(item.unit_price * item.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Delivery/pagamento */}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
            {order.delivery_type && (
              <span>
                {order.delivery_type === 'delivery' ? '🛵 Delivery' : '🏪 Retirada'}
              </span>
            )}
            {order.payment_method && <span>Pgto: {order.payment_method}</span>}
            {order.address && (
              <span className="truncate max-w-xs">
                {order.address.street}, {order.address.number} — {order.address.district}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Rodapé: CPF/CNPJ + Emitir ───────────────────── */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <label className="text-xs text-gray-500 shrink-0">CPF/CNPJ</label>
          <input
            type="text"
            placeholder="Opcional"
            maxLength={18}
            value={cpfCnpj}
            onChange={e => setCpfCnpj(maskCpfCnpj(e.target.value))}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-black bg-white"
          />
        </div>

        <button
          onClick={() => onEmitir(order, cpfCnpj.replace(/\D/g, '') || undefined)}
          disabled={emitting || !configOk}
          className={`text-sm px-5 py-1.5 rounded-lg font-medium transition-colors shrink-0
            ${!configOk
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-black text-white hover:bg-gray-800 disabled:opacity-60'
            }`}
        >
          {emitting
            ? <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                Emitindo...
              </span>
            : isRejeitado ? 'Reenviar NFC-e' : 'Emitir NFC-e'
          }
        </button>
      </div>
    </div>
  )
}
