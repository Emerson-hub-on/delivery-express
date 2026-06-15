'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { VincularItensCard } from './VincularItensCard'
import { NfEntradaDetalhe } from './NfEntradaDetalhe'
import {
  type NfEntrada,
  STATUS_LABEL,
  STATUS_COLOR,
} from './types'

interface Props {
  companyId: string
  onError: (msg: string) => void
}

function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}

function fmtCnpj(v: string) {
  return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function NfEntradaTab({ companyId, onError }: Props) {
  const [notas, setNotas]         = useState<NfEntrada[]>([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ importados: number; erros: number } | null>(null)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<NfEntrada['status'] | 'todas'>('todas')
  const [cfg, setCfg]             = useState<{ cpf?: string | null } | null>(null)
  const [notasParaVincular, setNotasParaVincular] = useState<NfEntrada[]>([])
  const [cardsDescartados, setCardsDescartados]   = useState<Set<string>>(new Set())
  const [notaDetalhe, setNotaDetalhe] = useState<NfEntrada | null>(null)

  const xmlInputRef = useRef<HTMLInputElement>(null)

  // ── Config ─────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('fiscal_configs')
      .select('cpf')
      .eq('company_id', companyId)
      .single()
      .then(({ data }) => setCfg(data))
  }, [companyId])

  // ── Carregamento de notas ──────────────────────────────────
  const loadNotas = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('nf_entrada')
        .select(`
          id,
          company_id,
          chave,
          numero,
          serie,
          emitente_razao,
          emitente_cnpj,
          valor_total,
          data_emissao,
          status,
          xml_url,
          created_at,
          itens_convertidos,
          requer_revisao,
          finalidade
        `)
        .eq('company_id', companyId)
        .order('data_emissao', { ascending: false })

      if (error) throw error

      const lista = data ?? []
      setNotas(lista)

      // Detecta notas pendentes com itens sem vínculo na tabela relacional
      if (lista.length > 0) {
        const ids = lista
          .filter(n => n.status === 'pendente')
          .map(n => n.id)
          .filter(Boolean) as string[]

        if (ids.length > 0) {
          const { data: itensPendentes } = await supabase
            .from('nf_entrada_itens')
            .select('nf_entrada_id')
            .in('nf_entrada_id', ids)
            .is('produto_id', null)

          const idsComPendentes = new Set(
            (itensPendentes ?? []).map((i: any) => i.nf_entrada_id)
          )

          const notasParaCard = lista.filter(n => idsComPendentes.has(n.id))

          if (notasParaCard.length > 0) {
            setNotasParaVincular(prev => {
              const mapa = new Map(prev.map(n => [n.chave, n]))
              notasParaCard.forEach(n => mapa.set(n.chave, n))
              return Array.from(mapa.values())
            })
            setCardsDescartados(prev => {
              const next = new Set(prev)
              notasParaCard.forEach(n => next.delete(n.chave))
              return next
            })
          }
        }
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro interno')
    } finally {
      setLoading(false)
    }
  }, [companyId, onError])

  useEffect(() => { loadNotas() }, [loadNotas])

  // ── Sync SEFAZ ─────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/fiscal/nf-entrada/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Erro ao consultar SEFAZ')
      }
      await loadNotas()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao consultar SEFAZ')
    } finally {
      setSyncing(false)
    }
  }

  // ── Importar XML ───────────────────────────────────────────
  const handleImportXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    setImporting(true)
    setImportResult(null)
    let importados = 0
    let erros = 0

    for (const file of files) {
      try {
        const xmlContent = await file.text()
        const res = await fetch('/api/fiscal/nf-entrada/import-xml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, xmlContent }),
        })
        if (!res.ok) { erros++; continue }
        importados++
      } catch {
        erros++
      }
    }

    if (xmlInputRef.current) xmlInputRef.current.value = ''
    setImportResult({ importados, erros })
    if (erros > 0 && importados === 0) {
      onError(`Nenhuma nota importada. ${erros} arquivo(s) com erro.`)
    }

    // loadNotas já detecta notas com itens pendentes e monta os cards
    await loadNotas()
    setImporting(false)
  }

  // ── Handlers de vinculação ─────────────────────────────────
  const handleDismissCard = (chave: string) =>
    setCardsDescartados(prev => new Set([...prev, chave]))

  const handleConfirmado = (chave: string) => {
    setCardsDescartados(prev => new Set([...prev, chave]))
    loadNotas()
  }

  const cardsVisiveis = notasParaVincular.filter(n => !cardsDescartados.has(n.chave))

  // ── Detalhe: updated / deleted ─────────────────────────────
  const handleNotaUpdated = (updated: NfEntrada) => {
    setNotas(prev => prev.map(n => n.chave === updated.chave ? updated : n))
    setNotaDetalhe(updated)
  }

  const handleNotaDeleted = (chave: string) => {
    setNotas(prev => prev.filter(n => n.chave !== chave))
    setNotaDetalhe(null)
  }

  // ── Filtros ────────────────────────────────────────────────
  const filtered = notas.filter(n => {
    const matchStatus = statusFilter === 'todas' || n.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      n.emitente_razao.toLowerCase().includes(q) ||
      n.emitente_cnpj.includes(q) ||
      n.numero.includes(q) ||
      n.chave.includes(q)
    return matchStatus && matchSearch
  })

  const totalValor = filtered.reduce((s, n) => s + n.valor_total, 0)

  // ── Vista de detalhe ───────────────────────────────────────
  if (notaDetalhe) {
    return (
      <NfEntradaDetalhe
        nota={notaDetalhe}
        companyId={companyId}
        onBack={() => setNotaDetalhe(null)}
        onUpdated={handleNotaUpdated}
        onDeleted={handleNotaDeleted}
        onError={onError}
      />
    )
  }

  // ── Vista de lista ─────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Cabeçalho */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Entrada de Nota Fiscal</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Notas fiscais recebidas (NF-e) destinadas à empresa
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {cfg?.cpf && (
            <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full px-3 py-1 self-start sm:self-auto">
              🧪 Modo teste — consultando por CPF
            </span>
          )}
          <div className="flex gap-2 sm:ml-auto">
            <label className={`flex-1 sm:flex-none flex items-center justify-center gap-2 border border-gray-200
              text-gray-600 bg-white hover:bg-gray-50 text-sm px-4 py-2 rounded-lg transition-colors
              cursor-pointer select-none ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
              {importing
                ? <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : '📂'
              }
              {importing ? 'Importando…' : 'Importar XML'}
              <input ref={xmlInputRef} type="file" accept=".xml" multiple className="hidden" onChange={handleImportXml} />
            </label>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-orange-500
                hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {syncing
                ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : '🔄'
              }
              {syncing ? 'Consultando…' : 'Consultar SEFAZ'}
            </button>
          </div>
        </div>
      </div>

      {/* Cards de vinculação */}
      {cardsVisiveis.map(nota => (
        <VincularItensCard
          key={nota.chave}
          companyId={companyId}
          nota={nota}
          onConfirmado={() => handleConfirmado(nota.chave)}
          onDismiss={() => handleDismissCard(nota.chave)}
          onError={onError}
        />
      ))}

      {/* Resultado da importação */}
      {importResult && (
        <div className={`flex items-start sm:items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm
          ${importResult.erros > 0 && importResult.importados === 0
            ? 'bg-red-50 border border-red-100 text-red-700'
            : importResult.erros > 0
            ? 'bg-yellow-50 border border-yellow-100 text-yellow-700'
            : 'bg-green-50 border border-green-100 text-green-700'
          }`}>
          <span>
            {importResult.importados > 0 && (
              <>{importResult.importados} nota{importResult.importados !== 1 ? 's' : ''} importada{importResult.importados !== 1 ? 's' : ''} com sucesso{importResult.erros > 0 ? ' — ' : '.'}</>
            )}
            {importResult.erros > 0 && (
              <>{importResult.erros} arquivo{importResult.erros !== 1 ? 's' : ''} com erro.</>
            )}
          </span>
          <button onClick={() => setImportResult(null)} className="text-xs opacity-60 hover:opacity-100 shrink-0">✕</button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Buscar por emitente, CNPJ, número…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value as NfEntrada['status'] | 'todas')}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
        >
          <option value="todas">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="confirmada">Confirmada</option>
          <option value="cancelada">Cancelada</option>
          <option value="recusada">Recusada</option>
        </select>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: 'Total encontradas', value: notas.length,                                        color: 'text-gray-700'  },
          { label: 'Pendentes',         value: notas.filter(n => n.status === 'pendente').length,   color: 'text-yellow-600' },
          { label: 'Confirmadas',       value: notas.filter(n => n.status === 'confirmada').length, color: 'text-green-600'  },
          { label: 'Valor filtrado',    value: `R$ ${fmtMoney(totalValor)}`,                        color: 'text-blue-600'   },
        ] as const).map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400">{card.label}</p>
            <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16
          flex flex-col items-center gap-3 text-gray-400">
          <span className="text-4xl">📥</span>
          <p className="text-sm font-medium">Nenhuma nota encontrada</p>
          <p className="text-xs text-center px-4">
            Clique em "Consultar SEFAZ" para buscar notas destinadas à empresa,
            ou em "Importar XML" para carregar arquivos manualmente
          </p>
        </div>
      ) : (
        <>
          {/* Tabela desktop */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['NF / Série', 'Emitente', 'Emissão', 'Valor', 'Status', 'Ações'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide
                        ${i >= 3 ? 'text-center' : 'text-left'} ${i === 3 ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(nota => (
                    <tr
                      key={nota.chave}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setNotaDetalhe(nota)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">Nº {nota.numero} / {nota.serie}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[10rem]" title={nota.chave}>
                          {nota.chave}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 truncate max-w-[12rem]">{nota.emitente_razao}</p>
                        <p className="text-xs text-gray-400">{fmtCnpj(nota.emitente_cnpj)}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {fmtDate(nota.data_emissao)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">
                        R$ {fmtMoney(nota.valor_total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[nota.status]}`}>
                          {STATUS_LABEL[nota.status]}
                        </span>
                        {nota.requer_revisao && (
                          <span className="ml-1 text-[10px] text-orange-600">⚠</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setNotaDetalhe(nota)}
                          className="text-xs px-3 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                          Ver detalhes →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-50 px-4 py-2.5 text-xs text-gray-400">
              {filtered.length} nota{filtered.length !== 1 ? 's' : ''} exibida{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Cards mobile */}
          <div className="md:hidden space-y-3">
            {filtered.map(nota => (
              <button
                key={nota.chave}
                onClick={() => setNotaDetalhe(nota)}
                className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">Nº {nota.numero} / {nota.serie}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">{nota.chave}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[nota.status]}`}>
                    {STATUS_LABEL[nota.status]}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-700 font-medium truncate">{nota.emitente_razao}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtCnpj(nota.emitente_cnpj)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">{fmtDate(nota.data_emissao)}</span>
                  <span className="font-semibold text-gray-800 text-sm">R$ {fmtMoney(nota.valor_total)}</span>
                </div>
              </button>
            ))}
            <p className="text-xs text-gray-400 text-center pb-2">
              {filtered.length} nota{filtered.length !== 1 ? 's' : ''} exibida{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        </>
      )}
    </div>
  )
}