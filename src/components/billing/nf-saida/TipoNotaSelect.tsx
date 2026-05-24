'use client'
import { useState, useMemo } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { TIPOS_NOTA_PADRAO, GRUPOS_TIPO_NOTA } from './constants'
import { CadastrarTipoModal } from './CadastrarTipoModal'
import type { TipoNota, TipoNotaCustom } from './types'

interface Props {
  value: string
  onChange: (tipo: TipoNota) => void
  /** Tipos personalizados persistidos — passe do state do pai */
  customTypes: TipoNotaCustom[]
  onCustomTypeAdded: (tipo: TipoNotaCustom) => void
}

export function TipoNotaSelect({ value, onChange, customTypes, onCustomTypeAdded }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  /** Todos os tipos: padrão + custom */
  const allTipos: TipoNota[] = useMemo(() => [
    ...TIPOS_NOTA_PADRAO,
    ...customTypes.map<TipoNota>(c => ({
      value: c.key,
      label: c.nome + (c.cfop_padrao ? ` — CFOP ${c.cfop_padrao}` : ''),
      cfop: c.cfop_padrao,
      natureza_operacao: c.natureza_operacao,
      finalidade: c.finalidade,
      isCustom: true,
    })),
  ], [customTypes])

  const selected = allTipos.find(t => t.value === value) ?? allTipos[0]

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tipo = allTipos.find(t => t.value === e.target.value)
    if (tipo) onChange(tipo)
  }

  function handleCustomSave(custom: TipoNotaCustom) {
    onCustomTypeAdded(custom)
    // Seleciona automaticamente o tipo recém-criado
    onChange({
      value: custom.key,
      label: custom.nome + (custom.cfop_padrao ? ` — CFOP ${custom.cfop_padrao}` : ''),
      cfop: custom.cfop_padrao,
      natureza_operacao: custom.natureza_operacao,
      finalidade: custom.finalidade,
      isCustom: true,
    })
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] text-[#7a7f86] whitespace-nowrap">Tipo de nota</span>

        {/* Dropdown */}
        <div className="relative">
          <select
            value={value}
            onChange={handleChange}
            className="appearance-none bg-[#22262b] border border-[#3a3d42] focus:border-[#4a7ab5]
              rounded-lg pl-3 pr-8 py-2 text-[13px] font-medium text-[#e2e4e6]
              outline-none transition-colors cursor-pointer min-w-[240px]"
          >
            {/* Grupos padrão */}
            {GRUPOS_TIPO_NOTA.map(grupo => (
              <optgroup key={grupo.label} label={grupo.label}>
                {grupo.valores.map(v => {
                  const t = TIPOS_NOTA_PADRAO.find(p => p.value === v)!
                  return <option key={t.value} value={t.value}>{t.label}</option>
                })}
              </optgroup>
            ))}

            {/* Tipos personalizados */}
            {customTypes.length > 0 && (
              <optgroup label="Tipos personalizados">
                {customTypes.map(c => (
                  <option key={c.key} value={c.key}>
                    {c.nome}{c.cfop_padrao ? ` — CFOP ${c.cfop_padrao}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7a7f86] pointer-events-none"
          />
        </div>

        {/* Tag CFOP */}
        {selected.cfop && (
          <span className="bg-[#1e3a5a] border border-[#2a4f75] rounded px-2.5 py-1
            text-[11px] text-[#6c9fd4] whitespace-nowrap">
            CFOP {selected.cfop}
          </span>
        )}

        {/* Tag natureza (truncada) */}
        <span className="bg-[#24302e] border border-[#2d4a45] rounded px-2.5 py-1
          text-[11px] text-[#5aaa90] max-w-[220px] truncate hidden sm:inline-block"
          title={selected.natureza_operacao}
        >
          {selected.natureza_operacao}
        </span>

        {/* Botão cadastrar */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-[#22262b] border border-dashed border-[#4a7ab5]
            rounded-lg px-3 py-2 text-[12px] text-[#6c8ebf] hover:bg-[#263040]
            hover:border-[#6c8ebf] transition-colors whitespace-nowrap"
        >
          <Plus size={13} />
          Cadastrar tipo
        </button>
      </div>

      <CadastrarTipoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCustomSave}
      />
    </>
  )
}
