'use client'
import { useState, useEffect, useMemo } from 'react'
import { Plus, ChevronDown, AlertCircle } from 'lucide-react'
import { CadastrarTipoModal } from './CadastrarTipoModal'
import { getTiposSaidaAgrupados, type GrupoTipos } from '@/services/cfop-saida-tipos'
import type { TipoNota, TipoNotaCustom } from './types'

interface Props {
  companyId: string
  value:     string
  onChange:  (tipo: TipoNota) => void
}

export function TipoNotaSelect({ companyId, value, onChange }: Props) {
  const [grupos, setGrupos]       = useState<GrupoTipos[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // ── Carrega tipos do banco ────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return
    loadTipos()
  }, [companyId])

  async function loadTipos() {
    try {
      setLoading(true)
      setError(null)
      const data = await getTiposSaidaAgrupados(companyId)
      setGrupos(data)
    } catch (e: any) {
      setError(e.message ?? 'Erro ao carregar tipos de nota')
    } finally {
      setLoading(false)
    }
  }

  // ── Lista plana para encontrar o tipo selecionado ─────────────────────────
  const allTipos = useMemo(
    () => grupos.flatMap(g => g.tipos),
    [grupos]
  )

  const selected = allTipos.find(t => t.value === value) ?? allTipos[0]

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tipo = allTipos.find(t => t.value === e.target.value)
    if (tipo) onChange(tipo)
  }

  // Após salvar no banco (CadastrarTipoModal persiste), recarrega a lista
  // e seleciona o novo tipo automaticamente.
  async function handleCustomSaved(novoTipo: TipoNota) {
    await loadTipos()
    onChange(novoTipo)
  }

  // ── Loading / erro ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">Tipo de nota</span>
        <span className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-400 min-w-[240px] animate-pulse">
          Carregando…
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle size={14} />
        <span className="text-xs">{error}</span>
        <button onClick={loadTipos} className="text-xs underline">Tentar novamente</button>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">Tipo de nota</span>

        {/* Seletor ─────────────────────────────────────────────────────────── */}
        <div className="relative">
          <select
            value={value}
            onChange={handleChange}
            className="appearance-none bg-gray-100 border border-gray-300 hover:border-gray-400
              focus:border-blue-500 focus:ring-1 focus:ring-blue-200
              rounded-lg pl-3 pr-8 py-2 text-sm font-semibold text-gray-800
              outline-none transition-colors cursor-pointer min-w-[240px]"
          >
            {grupos.map(grupo => (
              <optgroup key={grupo.label} label={grupo.label}>
                {grupo.tipos.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>

        {/* Badge CFOP ──────────────────────────────────────────────────────── */}
        {selected?.cfop && (
          <span className="bg-blue-100 border border-blue-300 rounded-md px-2.5 py-1 text-xs text-blue-800 font-semibold whitespace-nowrap">
            CFOP {selected.cfop}
          </span>
        )}

        {/* Badge natureza ──────────────────────────────────────────────────── */}
        {selected?.natureza_operacao && (
          <span
            className="bg-green-100 border border-green-300 rounded-md px-2.5 py-1
              text-xs text-green-800 font-medium max-w-[240px] truncate hidden sm:inline-block"
            title={selected.natureza_operacao}
          >
            {selected.natureza_operacao}
          </span>
        )}

        {/* Cadastrar tipo ──────────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-white border border-dashed border-gray-400
            rounded-lg px-3 py-2 text-xs font-semibold text-gray-600
            hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap"
        >
          <Plus size={13} />+ Cadastrar tipo
        </button>
      </div>

      <CadastrarTipoModal
        open={modalOpen}
        companyId={companyId}
        onClose={() => setModalOpen(false)}
        onSaved={handleCustomSaved}
      />
    </>
  )
}