// ── Helpers de data ───────────────────────────────────────────────────────────

export function todayLocalISO() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export function formatDisplayDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function toLocalDateISO(iso: string) {
  const d = new Date(iso)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '00'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Recife',
  })
}

export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Status & badges ───────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending:              { label: 'Em preparo',               color: 'bg-amber-50 text-amber-700 border-amber-200',    dot: 'bg-amber-400'  },
  confirmed:            { label: 'Confirmado',               color: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-400'   },
  preparing:            { label: 'Preparando',               color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
  ready:                { label: 'Pronto',                   color: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-400'  },
  delivering:           { label: 'Pedido saiu para entrega', color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400' },
  'Pronto p/ retirada': { label: 'Pronto p/ retirada',       color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400' },
  completed:            { label: 'Concluído',                color: 'bg-gray-50 text-gray-600 border-gray-200',       dot: 'bg-gray-400'   },
  delivered:            { label: 'Entregue',                 color: 'bg-gray-50 text-gray-600 border-gray-200',       dot: 'bg-gray-400'   },
  cancelled:            { label: 'Cancelado',                color: 'bg-red-50 text-red-600 border-red-200',          dot: 'bg-red-400'    },
}

export const DELIVERY_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  delivery: { label: '🛵 Entrega',  color: 'bg-blue-100 text-blue-700'     },
  pickup:   { label: '🏪 Retirada', color: 'bg-purple-100 text-purple-700' },
}