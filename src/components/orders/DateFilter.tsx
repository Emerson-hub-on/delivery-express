import { todayLocalISO, formatDisplayDate } from './order.helpers'

interface DateFilterProps {
  dateFrom: string
  dateTo: string
  totalFiltered: number
  totalAll: number
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  onToday: () => void
  onShowAll: () => void
}

export function DateFilter({
  dateFrom, dateTo,
  totalFiltered, totalAll,
  onDateFromChange, onDateToChange,
  onToday, onShowAll,
}: DateFilterProps) {
  const today     = todayLocalISO()
  const isToday   = dateFrom === today && dateTo === today
  const hasFilter = dateFrom !== '' || dateTo !== ''

  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 mb-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-400 uppercase tracking-wide">De</label>
          <input
            type="date" value={dateFrom} max={dateTo || today}
            onChange={e => onDateFromChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700
              focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-gray-400 uppercase tracking-wide">Até</label>
          <input
            type="date" value={dateTo} min={dateFrom || undefined} max={today}
            onChange={e => onDateToChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700
              focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
          />
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          {!isToday && (
            <button
              onClick={onToday}
              className="text-sm px-4 py-1.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              Hoje
            </button>
          )}
          {hasFilter && (
            <button
              onClick={onShowAll}
              className="text-sm px-4 py-1.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              Ver todos
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 self-center">
          {hasFilter && dateFrom && dateTo && (
            <span className="text-xs text-gray-400">
              📅{' '}
              {dateFrom === dateTo
                ? formatDisplayDate(dateFrom)
                : `${formatDisplayDate(dateFrom)} → ${formatDisplayDate(dateTo)}`}
            </span>
          )}
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {hasFilter ? `${totalFiltered} de ${totalAll}` : `${totalAll}`}{' '}
            {totalAll !== 1 ? 'pedidos' : 'pedido'}
          </span>
        </div>

      </div>
    </div>
  )
}
