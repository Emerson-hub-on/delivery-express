'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface NfEntrada {
  id?: string
  chave: string
  numero: string
  serie: string
  emitente_razao: string
  emitente_cnpj: string
  valor_total: number
  data_emissao: string
  status: 'pendente' | 'confirmada' | 'cancelada' | 'recusada'
  xml_url?: string | null
  created_at?: string
}

interface Props {
  companyId: string
  onError: (msg: string) => void
}

const STATUS_LABEL: Record<NfEntrada['status'], string> = {
  pendente:   'Pendente',
  confirmada: 'Confirmada',
  cancelada:  'Cancelada',
  recusada:   'Recusada',
}

const STATUS_COLOR: Record<NfEntrada['status'], string> = {
  pendente:   'bg-yellow-100 text-yellow-700',
  confirmada: 'bg-green-100 text-green-700',
  cancelada:  'bg-red-100 text-red-700',
  recusada:   'bg-gray-100 text-gray-500',
}

export function NfEntradaTab({ companyId, onError }: Props) {
  const [notas, setNotas]           = useState<NfEntrada[]>([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState<NfEntrada['status'] | 'todas'>('todas')

  // ── Carrega notas salvas no banco ──────────────────────────
  const loadNotas = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('nf_entrada')
        .select('*')
        .eq('company_id', companyId)
        .order('data_emissao', { ascending: false })
      if (error) throw error
      setNotas(data ?? [])
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { loadNotas() }, [loadNotas])

  // ── Consulta SEFAZ / salva novas notas ────────────────────
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
    } catch (e: any) {
      onError(e.message)
    } finally {
      setSyncing(false)
    }
  }

  // ── Manifestar ciência / confirmação ──────────────────────
  const handleManifestar = async (chave: string, evento: 'ciencia' | 'confirmacao' | 'recusa') => {
    try {
      const res = await fetch('/api/fiscal/nf-entrada/manifestar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, chave, evento }),
      })
      if (!res.ok) throw new Error('Erro ao manifestar')
      await loadNotas()
    } catch (e: any) {
      onError(e.message)
    }
  }

  // ── Filtros ───────────────────────────────────────────────
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

  return (
    <div className="space-y-5">

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Entrada de Nota Fiscal</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Notas fiscais recebidas (NF-e / NFC-e) destinadas à empresa
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white
            text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
        >
          {syncing
            ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : '🔄'
          }
          {syncing ? 'Consultando SEFAZ…' : 'Consultar SEFAZ'}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Buscar por emitente, CNPJ, número ou chave…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value as any)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200"
        >
          <option value="todas">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="confirmada">Confirmada</option>
          <option value="cancelada">Cancelada</option>
          <option value="recusada">Recusada</option>
        </select>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: 'Total encontradas', value: notas.length,                                             color: 'text-gray-700' },
          { label: 'Pendentes',         value: notas.filter(n => n.status === 'pendente').length,        color: 'text-yellow-600' },
          { label: 'Confirmadas',       value: notas.filter(n => n.status === 'confirmada').length,      color: 'text-green-600' },
          { label: 'Valor filtrado',    value: `R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'text-blue-600' },
        ] as const).map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400">{card.label}</p>
            <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16
          flex flex-col items-center gap-3 text-gray-400">
          <span className="text-4xl">📥</span>
          <p className="text-sm font-medium">Nenhuma nota encontrada</p>
          <p className="text-xs">Clique em "Consultar SEFAZ" para buscar notas destinadas à empresa</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">NF / Série</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Emitente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Emissão</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(nota => (
                  <tr key={nota.chave} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">Nº {nota.numero} / {nota.serie}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[160px]" title={nota.chave}>
                        {nota.chave}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-[200px]">{nota.emitente_razao}</p>
                      <p className="text-xs text-gray-400">{nota.emitente_cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(nota.data_emissao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">
                      R$ {nota.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[nota.status]}`}>
                        {STATUS_LABEL[nota.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                        {nota.status === 'pendente' && (
                        <>
                            <button
                            onClick={() => handleManifestar(nota.chave, 'ciencia')}
                            title="Ciência da operação"
                            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            >
                            Ciência
                            </button>
                            <button
                            onClick={() => handleManifestar(nota.chave, 'confirmacao')}
                            title="Confirmar recebimento"
                            className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                            >
                            Confirmar
                            </button>
                            <button
                            onClick={() => handleManifestar(nota.chave, 'recusa')}
                            title="Recusar nota"
                            className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >
                            Recusar
                            </button>
                        </>
                        )}
                        {nota.xml_url && (
                        <a
                            href={nota.xml_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                            XML
                        </a>
                        )}
                    </div>
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
      )}
    </div>
  )
}