'use client'
import { Order } from '@/types/product'

interface FiscalEmitidoCardProps {
  order: Order
  canceling: boolean
  onCancelar: (order: Order) => void
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

const STATUS_STYLES: Record<string, { bg: string; label: string }> = {
  emitido:   { bg: 'bg-green-50 text-green-700 border border-green-100', label: 'Autorizada' },
  cancelado: { bg: 'bg-gray-100 text-gray-500 border border-gray-200',   label: 'Cancelada'  },
  rejeitado: { bg: 'bg-red-50 text-red-600 border border-red-100',       label: 'Rejeitada'  },
  pendente:  { bg: 'bg-amber-50 text-amber-600 border border-amber-100', label: 'Pendente'   },
}

export function FiscalEmitidoCard({ order, canceling, onCancelar }: FiscalEmitidoCardProps) {
  const st = STATUS_STYLES[order.nfce_status ?? ''] ?? STATUS_STYLES.emitido
  const isCancelada = order.nfce_status === 'cancelado'
  const isEmitida   = order.nfce_status === 'emitido'

  // Prazo de cancelamento: 30 minutos após emissão (regra SEFAZ para NFC-e)
  const dentroDosPrazo = (() => {
    if (!order.nfce_emitido_at) return false
    const diff = Date.now() - new Date(order.nfce_emitido_at).getTime()
    return diff < 30 * 60 * 1000
  })()

  return (
    <div className={`bg-white border rounded-xl overflow-hidden
      ${isCancelada ? 'opacity-60 border-gray-100' : 'border-gray-200'}`}
    >
      {/* ── Cabeçalho ───────────────────────────────────── */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">#{order.code}</span>
            {order.nfce_numero && (
              <span className="text-xs text-gray-500 font-mono">
                NFC-e {String(order.nfce_numero).padStart(6, '0')}/{order.nfce_serie ?? '001'}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.bg}`}>
              {st.label}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{order.customer}</p>
          {order.nfce_emitido_at && (
            <p className="text-xs text-gray-400 mt-0.5">
              Emitida em {formatDateTime(order.nfce_emitido_at)}
            </p>
          )}
          {order.nfce_cancelado_at && (
            <p className="text-xs text-gray-400 mt-0.5">
              Cancelada em {formatDateTime(order.nfce_cancelado_at)}
            </p>
          )}
          {order.nfce_motivo && (
            <p className="text-xs text-gray-500 mt-0.5">↳ {order.nfce_motivo}</p>
          )}
        </div>

        <span className="text-sm font-semibold text-gray-900 shrink-0">
          {formatCurrency(order.total)}
        </span>
      </div>

      {/* ── Chave de acesso ──────────────────────────────── */}
      {order.nfce_chave && (
        <div className="px-5 py-2 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-0.5">Chave de acesso</p>
          <p className="font-mono text-xs text-gray-600 break-all select-all">
            {order.nfce_chave}
          </p>
        </div>
      )}

      {/* ── Rodapé: ações ───────────────────────────────── */}
      {!isCancelada && (
        <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
          {/* Link DANFE */}
          {order.nfce_danfe_url && (
            <a
              href={order.nfce_danfe_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 underline transition-colors"
            >
              Ver DANFE / QR-Code ↗
            </a>
          )}

          {/* CPF do consumidor */}
          {order.cpf_cnpj_consumidor && (
            <span className="text-xs text-gray-400">
              CPF/CNPJ: {order.cpf_cnpj_consumidor}
            </span>
          )}

          {/* Cancelar — somente dentro do prazo */}
          {isEmitida && (
            <div className="ml-auto">
              {dentroDosPrazo ? (
                <button
                  onClick={() => onCancelar(order)}
                  disabled={canceling}
                  className="text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {canceling ? 'Cancelando...' : 'Cancelar nota'}
                </button>
              ) : (
                <span className="text-xs text-gray-300">
                  Prazo de cancelamento expirado (30 min)
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
