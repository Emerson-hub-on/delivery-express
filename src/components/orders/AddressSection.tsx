'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Address } from '@/hooks/useCustomerAddress'

// ── Schema ────────────────────────────────────────────────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface AddressSectionProps {
  address: Address | null
  loading: boolean
  saving: boolean
  onSave: (values: Address) => Promise<void>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddressSection({ address, loading, saving, onSave }: AddressSectionProps) {
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

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse mb-6">
        <div className="h-3 w-32 bg-gray-100 rounded mb-3" />
        <div className="h-4 w-48 bg-gray-100 rounded mb-1" />
        <div className="h-3 w-36 bg-gray-50 rounded" />
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Endereço padrão</p>
        {!editing && (
          <button
            onClick={handleEdit}
            className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
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
              <input
                {...register('street')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                placeholder="Nome da rua"
              />
              {errors.street && <p className="text-xs text-red-500 mt-0.5">{errors.street.message}</p>}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Número</label>
              <input
                {...register('number')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                placeholder="123"
              />
              {errors.number && <p className="text-xs text-red-500 mt-0.5">{errors.number.message}</p>}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Complemento</label>
              <input
                {...register('complement')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                placeholder="Apto, bloco... (opcional)"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Bairro</label>
              <input
                {...register('district')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                placeholder="Bairro"
              />
              {errors.district && <p className="text-xs text-red-500 mt-0.5">{errors.district.message}</p>}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Cidade</label>
              <input
                {...register('city')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                placeholder="Cidade"
              />
              {errors.city && <p className="text-xs text-red-500 mt-0.5">{errors.city.message}</p>}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Estado</label>
              <input
                {...register('state')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                placeholder="PB"
              />
              {errors.state && <p className="text-xs text-red-500 mt-0.5">{errors.state.message}</p>}
            </div>

          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 text-sm py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar endereço'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
