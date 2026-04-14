'use client'
import { useState, useMemo } from 'react'
import { useMyOrders } from '@/hooks/Usemyorders'
import { useCustomerAddress, Address } from '@/hooks/useCustomerAddress'
import { Order } from '@/types/product'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { getPaymentLabel, isPaymentPending } from '@/lib/payment-labels'

// ── Helpers de data ───────────────────────────────────────────────────────────

function todayLocalISO() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDisplayDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function toLocalDateISO(iso: string) {
  const d = new Date(iso)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Recife',
  })
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Status & badges ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending:              { label: 'Em preparo',              color: 'bg-amber-50 text-amber-700 border-amber-200',    dot: 'bg-amber-400'  },
  confirmed:            { label: 'Confirmado',              color: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-400'   },
  preparing:            { label: 'Preparando',              color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
  ready:                { label: 'Pronto',                  color: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-400'  },
  delivering:           { label: 'Pedido saiu para entrega',color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400' },
  'Pronto p/ retirada': { label: 'Pronto p/ retirada',      color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400' },
  completed:            { label: 'Concluído',               color: 'bg-gray-50 text-gray-600 border-gray-200',       dot: 'bg-gray-400'   },
  delivered:            { label: 'Entregue',                color: 'bg-gray-50 text-gray-600 border-gray-200',       dot: 'bg-gray-400'   },
  cancelled:            { label: 'Cancelado',               color: 'bg-red-50 text-red-600 border-red-200',          dot: 'bg-red-400'    },
}

const DELIVERY_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  delivery: { label: '🛵 Entrega',  color: 'bg-blue-100 text-blue-700'     },
  pickup:   { label: '🏪 Retirada', color: 'bg-purple-100 text-purple-700' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    color: 'bg-gray-50 text-gray-600 border-gray-200',
    dot:   'bg-gray-400',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Filtro de data ────────────────────────────────────────────────────────────

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

function DateFilter({
  dateFrom, dateTo,
  totalFiltered, totalAll,
  onDateFromChange, onDateToChange,
  onToday, onShowAll,
}: DateFilterProps) {
  const today    = todayLocalISO()
  const isToday  = dateFrom === today && dateTo === today
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
            <button onClick={onToday}
              className="text-sm px-4 py-1.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors">
              Hoje
            </button>
          )}
          {hasFilter && (
            <button onClick={onShowAll}
              className="text-sm px-4 py-1.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors">
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

// ── Address Form ──────────────────────────────────────────────────────────────

const addressSchema = z.object({
  cep:        z.string().min(8, 'CEP inválido').max(9, 'CEP inválido'),
  street:     z.string().min(2, 'Preencha a rua'),
  number:     z.string().min(1, 'Preencha o número'),
  complement: z.string().optional(),
  district:   z.string().min(2, 'Preencha o bairro'),
  city:       z.string().min(2, 'Preencha a cidade'),
  state:      z.string().min(2, 'Preencha o estado'),
})

type AddressValues = z.infer<typeof addressSchema>

interface AddressSectionProps {
  address: Address | null
  loading: boolean
  saving: boolean
  onSave: (values: Address) => Promise<void>
}

function AddressSection({ address, loading, saving, onSave }: AddressSectionProps) {
  const [editing,    setEditing]    = useState(false)
  const [success,    setSuccess]    = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError,   setCepError]   = useState<string | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { cep: '', ...(address ?? {}) },
  })

  const handleEdit = () => {
    reset({ cep: '', ...(address ?? {}) })
    setCepError(null)
    setEditing(true)
    setSuccess(false)
  }

  const handleCancel = () => {
    setEditing(false)
    setCepError(null)
    reset({ cep: '', ...(address ?? {}) })
  }

  const handleCepChange = async (raw: string) => {
    const digits    = raw.replace(/\D/g, '').slice(0, 8)
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    setValue('cep', formatted)
    setCepError(null)

    if (digits.length !== 8) return

    setCepLoading(true)
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()

      if (data.erro) {
        setCepError('CEP não encontrado.')
        return
      }

      setValue('street',   data.logradouro ?? '')
      setValue('district', data.bairro     ?? '')
      setValue('city',     data.localidade ?? '')
      setValue('state',    data.uf         ?? '')

      setTimeout(() => {
        document.querySelector<HTMLInputElement>('input[name="number"]')?.focus()
      }, 100)
    } catch {
      setCepError('Erro ao buscar CEP. Verifique sua conexão.')
    } finally {
      setCepLoading(false)
    }
  }

  const onSubmit = async (values: AddressValues) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cep, ...addressFields } = values
    try {
      await onSave(addressFields)
      setEditing(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch { /* erro tratado no hook */ }
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse mb-6">
        <div className="h-3 w-32 bg-gray-100 rounded mb-3" />
        <div className="h-4 w-48 bg-gray-100 rounded mb-1" />
        <div className="h-3 w-36 bg-gray-50 rounded" />
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Endereço padrão</p>
        {!editing && (
          <button onClick={handleEdit}
            className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors">
            {address ? 'Alterar' : 'Adicionar'}
          </button>
        )}
      </div>

      {!editing && address && (
        <div>
          <p className="text-sm font-medium text-gray-800">
            {address.street}, {address.number}
            {address.complement ? ` — ${address.complement}` : ''}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {address.district}, {address.city} / {address.state.toUpperCase()}
          </p>
          {success && <p className="text-xs text-green-600 mt-2">✓ Endereço atualizado com sucesso</p>}
        </div>
      )}

      {!editing && !address && (
        <p className="text-sm text-gray-400">Nenhum endereço salvo ainda.</p>
      )}

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">

            {/* CEP */}
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">CEP</label>
              <div className="relative">
                <input
                  {...register('cep')}
                  placeholder="00000-000"
                  inputMode="numeric"
                  maxLength={9}
                  onChange={e => handleCepChange(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm pr-9 focus:outline-none focus:border-gray-400 ${
                    cepError ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                {cepLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  </span>
                )}
              </div>
              {cepError
                ? <p className="text-xs text-red-500 mt-0.5">{cepError}</p>
                : errors.cep && <p className="text-xs text-red-500 mt-0.5">{errors.cep.message}</p>
              }
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Rua</label>
              <input {...register('street')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                placeholder="Nome da rua" />
              {errors.street && <p className="text-xs text-red-500 mt-0.5">{errors.street.message}</p>}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Número</label>
              <input {...register('number')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                placeholder="123" />
              {errors.number && <p className="text-xs text-red-500 mt-0.5">{errors.number.message}</p>}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Complemento</label>
              <input {...register('complement')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                placeholder="Apto, bloco... (opcional)" />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Bairro</label>
              <input {...register('district')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                placeholder="Bairro" />
              {errors.district && <p className="text-xs text-red-500 mt-0.5">{errors.district.message}</p>}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Cidade</label>
              <input {...register('city')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                placeholder="Cidade" />
              {errors.city && <p className="text-xs text-red-500 mt-0.5">{errors.city.message}</p>}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Estado</label>
              <input {...register('state')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                placeholder="PB" />
              {errors.state && <p className="text-xs text-red-500 mt-0.5">{errors.state.message}</p>}
            </div>

          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 text-sm py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar endereço'}
            </button>
            <button type="button" onClick={handleCancel}
              className="px-4 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── OrderCard ─────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: Order
  onCancel: (id: number) => void
  cancelling: boolean
}

function OrderCard({ order, onCancel, cancelling }: OrderCardProps) {
  const [expanded,         setExpanded]         = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const items         = Array.isArray(order.items) ? order.items : []
  const deliveryBadge = order.delivery_type ? DELIVERY_TYPE_BADGE[order.delivery_type] : null
  const isPaid        = order.payment_method === 'pix' && order.status === 'confirmed'

  const handleCancelClick    = (e: React.MouseEvent) => { e.stopPropagation(); setConfirmingCancel(true)  }
  const handleConfirmCancel  = (e: React.MouseEvent) => { e.stopPropagation(); onCancel(order.id)        }
  const handleDismissCancel  = (e: React.MouseEvent) => { e.stopPropagation(); setConfirmingCancel(false) }

  return (
    <div
      className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => setExpanded(e => !e)}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{formatDate(order.created_at)}</p>
          <p className="text-sm font-semibold text-gray-900">#{order.id}</p>
          <div className="flex items-center gap-2 flex-wrap">
                  {order.delivery_type === 'delivery' && order.delivery_pin && (
              <div
                className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex flex-col items-center gap-1"
                onClick={e => e.stopPropagation()}
              >
                <p className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
                  🔐 Código de confirmação de entrega
                </p>
                <p className="text-2xl font-bold text-blue-700 tracking-[0.25em]">
                  {order.delivery_pin}
                </p>
                <p className="text-[10px] text-blue-400 text-center">
                  Mostre ao motoboy no momento da entrega
                </p>
              </div>
            )}
          </div>
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
      {items.length > 0 && (
        <ul className="space-y-1.5 mb-4">
          {items.map((item, i) => (
            <li key={i} className="flex justify-between text-sm text-gray-600">
              <span>
                <span className="text-gray-400 mr-1">{item.quantity}×</span>
                {item.product_name}
              </span>
              <span className="text-gray-500">{formatCurrency(item.unit_price * item.quantity)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* PIN de entrega */}


      {/* Seta Ver mais */}
      {(order.delivery_type === 'delivery' || order.delivery_type === 'pickup') && (
        <p className="text-xs text-gray-400 mb-2">{expanded ? '▲ Ver menos' : '▼ Ver mais'}</p>
      )}

      {/* Status de pagamento */}
      {order.payment_method && (
        <div className="flex items-center gap-2">
          {isPaid ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              ✓ Pagamento confirmado
            </span>
          ) : (
            <span className={`text-xs font-medium ${isPaymentPending(order.payment_method) ? 'text-red-500' : 'text-gray-500'}`}>
              {getPaymentLabel(order.payment_method)}
            </span>
          )}
        </div>
      )}

      {/* Seção expansível: endereço */}
      {expanded && (
        <div className="mb-4 pt-2 border-t border-gray-50 flex flex-col gap-3">
          {order.delivery_type === 'delivery' && order.address && (
            <div>
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
        </div>
      )}

      {/* Rodapé: total + cancelar */}
      <div
        className="flex items-center justify-between pt-3 border-t border-gray-50"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.total ?? 0)}</p>

        {(order.status === 'pending' || (order.status === 'confirmed' && order.payment_method === 'pix')) && (
          <button
            onClick={handleCancelClick}
            disabled={cancelling}
            className="text-xs px-3 py-1.5 bg-red-700 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelling ? 'Cancelando...' : 'Cancelar pedido'}
          </button>
        )}
      </div>

      {/* Confirmação de cancelamento */}
      {confirmingCancel && !cancelling && (
        <div
          className="mt-3 p-4 bg-red-50 border border-red-200 rounded-xl"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-sm font-medium text-red-700 mb-1">Cancelar este pedido?</p>
          <p className="text-xs text-red-500 mb-3">Essa ação não pode ser desfeita.</p>
          <div className="flex gap-2">
            <button onClick={handleConfirmCancel}
              className="flex-1 text-xs py-2 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800 transition-colors">
              Sim, cancelar
            </button>
            <button onClick={handleDismissCancel}
              className="flex-1 text-xs py-2 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors">
              Não, voltar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MyOrdersList ──────────────────────────────────────────────────────────────

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

  const hasFilter = dateFrom !== '' || dateTo !== ''

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
