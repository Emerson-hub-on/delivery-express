'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Customer, CustomerAddress, PessoaTipo } from '@/types/customer'
import { createCustomer, updateCustomer } from '@/services/customers'
import { maskPhone, maskCpf, maskCnpj } from './customer.helpers'

// ── Schemas ───────────────────────────────────────────────────────────────────

const addrFields = {
  cep:        z.string().optional(),
  street:     z.string().optional(),
  number:     z.string().optional(),
  complement: z.string().optional(),
  district:   z.string().optional(),
  city:       z.string().optional(),
  state:      z.string().optional(),
}

const baseSchema = z.object({
  name:  z.string().min(2, 'Preencha o nome'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  ...addrFields,
})

const pfSchema = baseSchema.extend({
  cpf: z.string().optional(),
})

const pjSchema = baseSchema.extend({
  cnpj:         z.string().min(18, 'CNPJ inválido'),
  razao_social: z.string().min(2, 'Preencha a razão social'),
  ie:           z.string().optional(),
})

type FormValues = z.infer<typeof pfSchema> & Partial<z.infer<typeof pjSchema>>

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initial?:   Customer | null
  companyId:  string
  onSaved:    (c: Customer) => void
  onCancel:   () => void
  onError:    (msg: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CustomerForm({ initial, companyId, onSaved, onCancel, onError }: Props) {
  const [pessoaTipo, setPessoaTipo] = useState<PessoaTipo>(initial?.pessoa_tipo ?? 'fisica')
  const [saving,     setSaving]     = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError,   setCepError]   = useState<string | null>(null)

  const { register, handleSubmit, setValue, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(pessoaTipo === 'fisica' ? pfSchema : pjSchema),
      defaultValues: {
        name:         initial?.name                  ?? '',
        email:        initial?.email                 ?? '',
        phone:        initial?.phone                 ?? '',
        cpf:          initial?.cpf                   ?? '',
        cnpj:         initial?.cnpj                  ?? '',
        razao_social: initial?.razao_social          ?? '',
        ie:           initial?.ie                    ?? '',
        cep:          '',
        street:       initial?.address?.street       ?? '',
        number:       initial?.address?.number       ?? '',
        complement:   initial?.address?.complement   ?? '',
        district:     initial?.address?.district     ?? '',
        city:         initial?.address?.city         ?? '',
        state:        initial?.address?.state        ?? '',
      },
    })

  // ── CEP lookup ─────────────────────────────────────────────────────────────

  const handleCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    setValue('cep', digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits)
    setCepError(null)
    if (digits.length !== 8) return

    setCepLoading(true)
    try {
      const d = await (await fetch(`https://viacep.com.br/ws/${digits}/json/`)).json()
      if (d.erro) { setCepError('CEP não encontrado.'); return }
      setValue('street',   d.logradouro ?? '')
      setValue('district', d.bairro     ?? '')
      setValue('city',     d.localidade ?? '')
      setValue('state',    d.uf         ?? '')
      setTimeout(() =>
        document.querySelector<HTMLInputElement>('input[name="number"]')?.focus(), 100)
    } catch {
      setCepError('Erro ao buscar CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    console.log('companyId recebido:', companyId)
    const address: CustomerAddress | null = values.street
      ? {
          cep:        values.cep        ?? '',
          street:     values.street!,
          number:     values.number     ?? '',
          complement: values.complement ?? '',
          district:   values.district   ?? '',
          city:       values.city       ?? '',
          state:      values.state      ?? '',
        }
      : null

    const common = {
      company_id:   companyId,
      is_guest:     true,
      pessoa_tipo:  pessoaTipo,
      name:         values.name,
      email:        values.email,
      phone:        values.phone        || null,
      address,
      cpf:          pessoaTipo === 'fisica'    ? (values.cpf          || null) : null,
      cnpj:         pessoaTipo === 'juridica'  ? (values.cnpj         || null) : null,
      razao_social: pessoaTipo === 'juridica'  ? (values.razao_social || null) : null,
      ie:           pessoaTipo === 'juridica'  ? (values.ie           || null) : null,
    }

    try {
      setSaving(true)
      // Cria (sem id) ou atualiza (com id existente)
      const saved = initial
        ? await updateCustomer(initial.id, common)
        : await createCustomer(common)
      onSaved(saved)
    } catch (e: any) {
      onError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Field helper ───────────────────────────────────────────────────────────

  const F = (
    label: string,
    name: keyof FormValues,
    props?: React.InputHTMLAttributes<HTMLInputElement>
  ) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        {...register(name)}
        {...props}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
          focus:outline-none focus:border-gray-400 placeholder:text-gray-300"
      />
      {errors[name] && (
        <p className="text-xs text-red-500 mt-0.5">
          {errors[name]?.message as string}
        </p>
      )}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm max-w-2xl">
      <h2 className="text-sm font-semibold text-gray-800 mb-5">
        {initial ? 'Editar cliente' : 'Novo cliente'}
      </h2>

      {/* Tipo de pessoa */}
      <div className="flex gap-2 mb-6">
        {(['fisica', 'juridica'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setPessoaTipo(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              pessoaTipo === t
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {t === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* ── Dados básicos ── */}
        <div className="grid grid-cols-2 gap-4">
          {F(
            pessoaTipo === 'fisica' ? 'Nome completo' : 'Nome do responsável',
            'name',
            { placeholder: 'Nome' }
          )}
          {F('E-mail', 'email', { type: 'email', placeholder: 'email@exemplo.com' })}

          {/* Telefone */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Telefone</label>
            <input
              {...register('phone')}
              onChange={e => setValue('phone', maskPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:border-gray-400 placeholder:text-gray-300"
            />
          </div>

          {/* Documento — muda conforme tipo */}
          {pessoaTipo === 'fisica' ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">CPF</label>
              <input
                {...register('cpf')}
                onChange={e => setValue('cpf', maskCpf(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:border-gray-400 placeholder:text-gray-300"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">CNPJ</label>
                <input
                  {...register('cnpj')}
                  onChange={e => setValue('cnpj', maskCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                    focus:outline-none focus:border-gray-400 placeholder:text-gray-300"
                />
                {errors.cnpj && (
                  <p className="text-xs text-red-500 mt-0.5">{errors.cnpj.message}</p>
                )}
              </div>
              <div className="col-span-2">
                {F('Razão Social', 'razao_social', { placeholder: 'Razão Social Ltda.' })}
              </div>
              {F('Inscrição Estadual', 'ie', { placeholder: 'Isento ou número' })}
            </>
          )}
        </div>

        {/* ── Endereço ── */}
        <p className="text-[10px] text-gray-400 uppercase tracking-wide pt-2">Endereço</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">CEP</label>
            <div className="relative">
              <input
                {...register('cep')}
                placeholder="00000-000"
                maxLength={9}
                onChange={e => handleCep(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8
                  focus:outline-none focus:border-gray-400 placeholder:text-gray-300"
              />
              {cepLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-3.5 h-3.5 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                </span>
              )}
            </div>
            {cepError && <p className="text-xs text-red-500 mt-0.5">{cepError}</p>}
          </div>
          {F('Rua',         'street',     { placeholder: 'Rua / Avenida' })}
          {F('Número',      'number',     { placeholder: '123' })}
          {F('Complemento', 'complement', { placeholder: 'Apto, sala... (opcional)' })}
          {F('Bairro',      'district',   { placeholder: 'Bairro' })}
          {F('Cidade',      'city',       { placeholder: 'Cidade' })}
          {F('Estado',      'state',      { placeholder: 'PB', maxLength: 2 })}
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium
              hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar cliente'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 text-sm text-gray-400 hover:text-gray-600 border border-gray-200
              rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}