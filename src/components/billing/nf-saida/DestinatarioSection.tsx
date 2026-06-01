'use client'
import { Search, User, Building2, X } from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'
import { UFS } from './constants'
import type { DestinatarioForm } from './types'
import { searchDestinatarios, type DestinatarioResult } from '@/services/searchDestinatario'

interface Props {
  form: DestinatarioForm
  onChange: <K extends keyof DestinatarioForm>(k: K, v: DestinatarioForm[K]) => void
  companyId: string
}

export function DestinatarioSection({ form, onChange, companyId }: Props) {
  const isJuridica = form.tipo === 'juridica'

  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<DestinatarioResult[]>([])
  const [loading, setLoading]       = useState(false)
  const [open, setOpen]             = useState(false)
  const [selected, setSelected]     = useState<DestinatarioResult | null>(null)
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef                  = useRef<HTMLDivElement>(null)

  // ── Fecha dropdown ao clicar fora ─────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Busca com debounce ────────────────────────────────────────────────────
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim() || value.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchDestinatarios(value, companyId)
        setResults(data)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [companyId])

  // ── Seleciona um resultado e preenche o form ──────────────────────────────
  // dest_id e origem agora são propagados para DestinatarioForm,
  // permitindo que o service grave dest_id e dest_origem no banco corretamente.
  const handleSelect = useCallback((r: DestinatarioResult) => {
    setSelected(r)
    setQuery(r.nome)
    setOpen(false)
    setResults([])

    onChange('nome',             r.nome)
    onChange('tipo',             r.tipo)
    onChange('email',            r.email      ?? '')
    onChange('telefone',         r.telefone   ?? '')
    onChange('logradouro',       r.logradouro ?? '')
    onChange('numero',           r.numero     ?? '')
    onChange('bairro',           r.bairro     ?? '')
    onChange('municipio',        r.municipio  ?? '')
    onChange('codigo_municipio', r.codigo_municipio ?? '')
    onChange('uf',               r.uf  ?? '')
    onChange('cep',              r.cep ?? '')
    onChange('ie',               r.ie  ?? '')

    // ← campos novos em DestinatarioForm (ver types-patch.ts)
    onChange('dest_id', r.id)
    onChange('origem',  r.origem)

    if (r.tipo === 'juridica') {
      onChange('cnpj', r.cpf_cnpj ?? '')
      onChange('cpf',  '')
    } else {
      onChange('cpf',  r.cpf_cnpj ?? '')
      onChange('cnpj', '')
    }
  }, [onChange])

  // ── Limpa seleção ─────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setSelected(null)
    setQuery('')
    setResults([])
    setOpen(false)
    // Limpa também dest_id e origem do form
    onChange('dest_id', undefined)
    onChange('origem',  undefined)
  }, [onChange])

  return (
    <div className="bg-white border border-gray-300 rounded-xl mb-3.5 overflow-hidden shadow-sm">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-300 bg-gray-100">
        <Search size={14} className="text-gray-500" />
        <span className="text-[11px] font-bold text-gray-600 tracking-wider uppercase">
          Destinatário
        </span>
      </div>

      <div className="p-4 space-y-3">

        {/* ── Campo de busca com dropdown ── */}
        <div ref={wrapperRef} className="relative">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder="Buscar por nome, CPF ou CNPJ..."
              className="w-full bg-gray-50 border border-gray-300 hover:border-gray-400
                focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:bg-white
                rounded-lg pl-8 pr-8 py-2 text-sm text-gray-900 placeholder-gray-400
                outline-none transition-colors"
            />
            {/* Spinner ou botão limpar */}
            {loading ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="animate-spin h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </span>
            ) : selected ? (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* Dropdown de resultados */}
          {open && results.length > 0 && (
            <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {results.map(r => (
                <li key={`${r.origem}-${r.id}`}>
                  <button
                    type="button"
                    onMouseDown={() => handleSelect(r)}
                    className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-blue-50
                      transition-colors text-left border-b border-gray-100 last:border-0"
                  >
                    <span className={`mt-0.5 shrink-0 rounded-full p-1
                      ${r.origem === 'cliente' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}
                    >
                      {r.origem === 'cliente'
                        ? <User size={11} />
                        : <Building2 size={11} />
                      }
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-gray-800 truncate">{r.nome}</span>
                      <span className="text-[11px] text-gray-400 flex gap-2">
                        {r.cpf_cnpj && <span>{r.cpf_cnpj}</span>}
                        {r.municipio && r.uf && <span>{r.municipio} / {r.uf}</span>}
                        <span className={`font-medium
                          ${r.origem === 'cliente' ? 'text-blue-500' : 'text-amber-500'}`}
                        >
                          {r.origem === 'cliente' ? 'Cliente' : 'Fornecedor'}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Nenhum resultado */}
          {open && !loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500">
              Nenhum cliente ou fornecedor encontrado.
            </div>
          )}
        </div>

        {/* ── Nome + Tipo ── */}
        <div className="grid grid-cols-[1fr_160px] gap-2.5">
          <Field label="Nome / Razão social" required>
            <Input value={form.nome} onChange={v => onChange('nome', v)} placeholder="Nome completo ou razão social" />
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

        {/* ── Documento + E-mail + Telefone ── */}
        <div className="grid grid-cols-3 gap-2.5">
          {isJuridica ? (
            <>
              <Field label="CNPJ" required>
                <Input value={form.cnpj} onChange={v => onChange('cnpj', v)} placeholder="00.000.000/0000-00" />
              </Field>
              <Field label="IE">
                <Input value={form.ie} onChange={v => onChange('ie', v)} placeholder="Inscrição Estadual" />
              </Field>
            </>
          ) : (
            <Field label="CPF" required>
              <Input value={form.cpf} onChange={v => onChange('cpf', v)} placeholder="000.000.000-00" />
            </Field>
          )}
          <Field label="E-mail">
            <Input value={form.email} onChange={v => onChange('email', v)} placeholder="email@exemplo.com" />
          </Field>
          <Field label="Telefone">
            <Input value={form.telefone} onChange={v => onChange('telefone', v)} placeholder="(00) 00000-0000" />
          </Field>
        </div>

        {/* ── Endereço ── */}
        <p className="text-[11px] text-gray-500 uppercase tracking-wider pt-1 font-bold">Endereço</p>
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
            <Input value={form.codigo_municipio} onChange={v => onChange('codigo_municipio', v)} placeholder="7 dígitos IBGE" maxLength={7} />
          </Field>
          <Field label="UF">
            <Select value={form.uf} onChange={v => onChange('uf', v)} options={UFS.map(u => ({ value: u, label: u }))} />
          </Field>
        </div>
      </div>
    </div>
  )
}

// ── Subcomponentes reutilizáveis ───────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, maxLength }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number
}) {
  return (
    <input
      type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} maxLength={maxLength}
      className="bg-gray-50 border border-gray-300 hover:border-gray-400
        focus:border-blue-500 focus:ring-1 focus:ring-blue-200 focus:bg-white
        rounded-lg px-2.5 py-[7px] text-sm text-gray-900 placeholder-gray-400
        outline-none transition-colors w-full"
    />
  )
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      className="bg-gray-50 border border-gray-300 hover:border-gray-400
        focus:border-blue-500 focus:ring-1 focus:ring-blue-200
        rounded-lg px-2.5 py-[7px] text-sm text-gray-900
        outline-none transition-colors w-full"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}