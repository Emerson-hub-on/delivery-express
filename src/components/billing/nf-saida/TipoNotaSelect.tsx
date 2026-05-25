'use client'
import { useState, useMemo } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { TIPOS_NOTA_PADRAO, GRUPOS_TIPO_NOTA } from './constants'
import { CadastrarTipoModal } from './CadastrarTipoModal'
import type { TipoNota, TipoNotaCustom } from './types'

interface Props {
  value: string; onChange: (tipo: TipoNota) => void
  customTypes: TipoNotaCustom[]; onCustomTypeAdded: (tipo: TipoNotaCustom) => void
}

export function TipoNotaSelect({ value, onChange, customTypes, onCustomTypeAdded }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  const allTipos: TipoNota[] = useMemo(() => [
    ...TIPOS_NOTA_PADRAO,
    ...customTypes.map<TipoNota>(c => ({
      value: c.key, label: c.nome + (c.cfop_padrao ? ` — CFOP ${c.cfop_padrao}` : ''),
      cfop: c.cfop_padrao, natureza_operacao: c.natureza_operacao, finalidade: c.finalidade, isCustom: true,
    })),
  ], [customTypes])

  const selected = allTipos.find(t => t.value === value) ?? allTipos[0]

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tipo = allTipos.find(t => t.value === e.target.value)
    if (tipo) onChange(tipo)
  }

  function handleCustomSave(custom: TipoNotaCustom) {
    onCustomTypeAdded(custom)
    onChange({
      value: custom.key, label: custom.nome + (custom.cfop_padrao ? ` — CFOP ${custom.cfop_padrao}` : ''),
      cfop: custom.cfop_padrao, natureza_operacao: custom.natureza_operacao, finalidade: custom.finalidade, isCustom: true,
    })
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">Tipo de nota</span>

        <div className="relative">
          <select value={value} onChange={handleChange}
            className="appearance-none bg-gray-100 border border-gray-300 hover:border-gray-400
              focus:border-blue-500 focus:ring-1 focus:ring-blue-200
              rounded-lg pl-3 pr-8 py-2 text-sm font-semibold text-gray-800
              outline-none transition-colors cursor-pointer min-w-[240px]">
            {GRUPOS_TIPO_NOTA.map(grupo => (
              <optgroup key={grupo.label} label={grupo.label}>
                {grupo.valores.map(v => {
                  const t = TIPOS_NOTA_PADRAO.find(p => p.value === v)!
                  return <option key={t.value} value={t.value}>{t.label}</option>
                })}
              </optgroup>
            ))}
            {customTypes.length > 0 && (
              <optgroup label="Tipos personalizados">
                {customTypes.map(c => (
                  <option key={c.key} value={c.key}>{c.nome}{c.cfop_padrao ? ` — CFOP ${c.cfop_padrao}` : ''}</option>
                ))}
              </optgroup>
            )}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>

        {selected.cfop && (
          <span className="bg-blue-100 border border-blue-300 rounded-md px-2.5 py-1 text-xs text-blue-800 font-semibold whitespace-nowrap">
            CFOP {selected.cfop}
          </span>
        )}

        <span className="bg-green-100 border border-green-300 rounded-md px-2.5 py-1
          text-xs text-green-800 font-medium max-w-[240px] truncate hidden sm:inline-block"
          title={selected.natureza_operacao}>
          {selected.natureza_operacao}
        </span>

        <button type="button" onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-white border border-dashed border-gray-400
            rounded-lg px-3 py-2 text-xs font-semibold text-gray-600
            hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap">
          <Plus size={13} />+ Cadastrar tipo
        </button>
      </div>

      <CadastrarTipoModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleCustomSave} />
    </>
  )
}
