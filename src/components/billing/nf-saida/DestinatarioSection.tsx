'use client'
import { Search } from 'lucide-react'
import { UFS } from './constants'
import type { DestinatarioForm } from './types'

interface Props {
  form: DestinatarioForm
  onChange: <K extends keyof DestinatarioForm>(k: K, v: DestinatarioForm[K]) => void
  onSearch?: (query: string) => void
}

export function DestinatarioSection({ form, onChange, onSearch }: Props) {
  const isJuridica = form.tipo === 'juridica'

  return (
    <div className="bg-[#22262b] border border-[#2e3238] rounded-xl mb-3.5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2e3238]">
        <Search size={15} className="text-[#6c8ebf]" />
        <span className="text-[11px] font-semibold text-[#a0a5ad] tracking-wider uppercase">
          Destinatário
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Busca */}
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou CNPJ..."
          onChange={e => onSearch?.(e.target.value)}
          className="w-full bg-[#1a1c1e] border border-[#3a3d42] focus:border-[#4a7ab5]
            rounded-md px-3 py-2 text-[13px] text-[#e2e4e6] placeholder-[#4a4f56]
            outline-none transition-colors"
        />

        {/* Nome + Tipo */}
        <div className="grid grid-cols-[1fr_160px] gap-2.5">
          <Field label="Nome / Razão social" required>
            <Input
              value={form.nome}
              onChange={v => onChange('nome', v)}
              placeholder="Nome completo ou razão social"
            />
          </Field>
          <Field label="Tipo">
            <Select
              value={form.tipo}
              onChange={v => onChange('tipo', v as 'fisica' | 'juridica')}
              options={[
                { value: 'fisica',   label: 'Pessoa física' },
                { value: 'juridica', label: 'Pessoa jurídica' },
              ]}
            />
          </Field>
        </div>

        {/* Documento + Email + Telefone */}
        <div className="grid grid-cols-3 gap-2.5">
          {isJuridica ? (
            <>
              <Field label="CNPJ" required>
                <Input
                  value={form.cnpj}
                  onChange={v => onChange('cnpj', v)}
                  placeholder="00.000.000/0000-00"
                />
              </Field>
              <Field label="IE">
                <Input
                  value={form.ie}
                  onChange={v => onChange('ie', v)}
                  placeholder="Inscrição Estadual"
                />
              </Field>
            </>
          ) : (
            <Field label="CPF" required>
              <Input
                value={form.cpf}
                onChange={v => onChange('cpf', v)}
                placeholder="000.000.000-00"
              />
            </Field>
          )}
          <Field label="E-mail">
            <Input
              value={form.email}
              onChange={v => onChange('email', v)}
              placeholder="email@exemplo.com"
            />
          </Field>
          {!isJuridica && (
            <Field label="Telefone">
              <Input
                value={form.telefone}
                onChange={v => onChange('telefone', v)}
                placeholder="(00) 00000-0000"
              />
            </Field>
          )}
          {isJuridica && (
            <Field label="Telefone">
              <Input
                value={form.telefone}
                onChange={v => onChange('telefone', v)}
                placeholder="(00) 00000-0000"
              />
            </Field>
          )}
        </div>

        {/* Endereço */}
        <p className="text-[11px] text-[#5a5f66] uppercase tracking-wider pt-1">Endereço</p>
        <div className="grid grid-cols-3 gap-2.5">
          <Field label="CEP">
            <Input value={form.cep} onChange={v => onChange('cep', v)} placeholder="00000-000" />
          </Field>
          <Field label="Logradouro">
            <Input value={form.logradouro} onChange={v => onChange('logradouro', v)} placeholder="Rua, Avenida..." />
          </Field>
          <Field label="Número">
            <Input value={form.numero} onChange={v => onChange('numero', v)} placeholder="Nº" />
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          <Field label="Bairro">
            <Input value={form.bairro} onChange={v => onChange('bairro', v)} placeholder="Bairro" />
          </Field>
          <Field label="Município">
            <Input value={form.municipio} onChange={v => onChange('municipio', v)} placeholder="Cidade" />
          </Field>
          <Field label="Cód. município">
            <Input
              value={form.codigo_municipio}
              onChange={v => onChange('codigo_municipio', v)}
              placeholder="7 dígitos IBGE"
              maxLength={7}
            />
          </Field>
          <Field label="UF">
            <Select
              value={form.uf}
              onChange={v => onChange('uf', v)}
              options={UFS.map(u => ({ value: u, label: u }))}
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

/* ── helpers de campo ─────────────────────────────────────────── */
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-[#7a7f86]">
        {label} {required && <span className="text-[#e26b5a]">*</span>}
      </label>
      {children}
    </div>
  )
}

function Input({
  value, onChange, placeholder, maxLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="bg-[#1a1c1e] border border-[#3a3d42] focus:border-[#4a7ab5]
        rounded-md px-2.5 py-[7px] text-[13px] text-[#e2e4e6] placeholder-[#4a4f56]
        outline-none transition-colors w-full"
    />
  )
}

function Select({
  value, onChange, options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-[#1a1c1e] border border-[#3a3d42] focus:border-[#4a7ab5]
        rounded-md px-2.5 py-[7px] text-[13px] text-[#e2e4e6]
        outline-none transition-colors w-full"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
