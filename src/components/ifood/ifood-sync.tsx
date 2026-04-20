'use client'
// components/ifood/ifood-sync.tsx
//
// Fluxo:
//  1. Usuário clica "Sincronizar" → API retorna preview com preços iFood vs sistema
//  2. Itens "updated" aparecem com checkbox para o usuário escolher quais atualizar
//  3. Botão "Atualizar selecionados" confirma o upsert no banco
//  4. Itens "created" são criados automaticamente (sem necessidade de confirmação)

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface SyncResult {
  ifood_id: string
  name: string
  action: 'created' | 'updated' | 'skipped'
  reason?: string
  // Dados para preview de diferença
  ifood_price?:   number
  current_price?: number
  ifood_name?:    string
  current_name?:  string
  ifood_image?:   string
  current_image?: string
}

interface SyncSummary {
  created: number
  updated: number
  skipped: number
  total:   number
}

interface SyncResponse {
  message: string
  summary: SyncSummary
  results: SyncResult[]
  error?:  string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (v?: number) =>
  v != null ? `R$ ${v.toFixed(2).replace('.', ',')}` : '—'

const ACTION_LABEL: Record<string, string> = {
  created: 'Novo',
  updated: 'Atualizado',
  skipped: 'Ignorado',
}

// ── Componente ─────────────────────────────────────────────────────────────────

export function IfoodSync() {
  const [loading, setLoading]       = useState(false)
  const [applying, setApplying]     = useState(false)
  const [response, setResponse]     = useState<SyncResponse | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [filter, setFilter]         = useState<'all' | 'created' | 'updated' | 'skipped'>('all')

  // IDs dos "updated" selecionados para confirmar atualização
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applied, setApplied]   = useState(false)

  // ── Sincronizar (preview) ──────────────────────────────────────────────────

  const handleSync = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)
    setSelected(new Set())
    setApplied(false)
    setFilter('all')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Você precisa estar logado para sincronizar.')

      const res = await fetch('/api/ifood/sync-catalog', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ previewOnly: true }), // não salva "updated" ainda
      })

      const json: SyncResponse = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)

      setResponse(json)

      // Pré-seleciona todos os "updated" por padrão
      const updatedIds = new Set(
        json.results.filter(r => r.action === 'updated').map(r => r.ifood_id)
      )
      setSelected(updatedIds)
    } catch (e: any) {
      setError(e.message || 'Erro desconhecido.')
    } finally {
      setLoading(false)
    }
  }

  // ── Aplicar atualizações selecionadas ──────────────────────────────────────

  const handleApply = async () => {
    if (!response || selected.size === 0) return
    setApplying(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada.')

      const res = await fetch('/api/ifood/sync-catalog', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          previewOnly: false,
          applyIds: Array.from(selected), // só atualiza os selecionados
        }),
      })

      const json: SyncResponse = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)

      setResponse(json)
      setApplied(true)
      setSelected(new Set())
    } catch (e: any) {
      setError(e.message || 'Erro desconhecido.')
    } finally {
      setApplying(false)
    }
  }

  // ── Checkbox helpers ───────────────────────────────────────────────────────

  const updatedResults = response?.results.filter(r => r.action === 'updated') ?? []

  const toggleOne = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = () => {
    if (selected.size === updatedResults.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(updatedResults.map(r => r.ifood_id)))
    }
  }

  // ── Filtragem ──────────────────────────────────────────────────────────────

  const filtered = response?.results.filter(r =>
    filter === 'all' ? true : r.action === filter
  ) ?? []

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-xl">
          🛵
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Sincronizar Cardápio iFood</h2>
          <p className="text-xs text-gray-500">Importa e atualiza produtos do seu catálogo iFood</p>
        </div>
      </div>

      {/* Botão sincronizar */}
      <button
        onClick={handleSync}
        disabled={loading || applying}
        className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="animate-spin text-base">⟳</span>
            Buscando cardápio…
          </>
        ) : (
          <>🔄 Sincronizar agora</>
        )}
      </button>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-xs text-red-600">❌ {error}</p>
        </div>
      )}

      {/* ── Resultado ─────────────────────────────────────────────────────── */}
      {response && (
        <div className="space-y-4">

          {/* Mensagem de status */}
          {applied ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <p className="text-xs text-green-700 font-medium">✅ {response.message}</p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <p className="text-xs text-blue-700 font-medium">
                👀 Prévia carregada. Revise os itens abaixo e confirme o que deseja atualizar.
              </p>
            </div>
          )}

          {/* Pills resumo */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'created', label: 'Novos',      value: response.summary.created, color: 'text-green-600',  bg: 'bg-green-50 border-green-200'  },
              { key: 'updated', label: 'Atualizados', value: response.summary.updated, color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200'    },
              { key: 'skipped', label: 'Ignorados',  value: response.summary.skipped, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setFilter(filter === s.key as any ? 'all' : s.key as any)}
                className={`border rounded-xl p-3 text-center transition-all ${s.bg} ${filter === s.key ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
              >
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </button>
            ))}
          </div>

          {/* Barra de ação para "updated" — só aparece se há itens updated e não aplicado ainda */}
          {!applied && updatedResults.length > 0 && (filter === 'all' || filter === 'updated') && (
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                {/* Marcar todos */}
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    selected.size === updatedResults.length
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : selected.size > 0
                      ? 'bg-blue-200 border-blue-300'
                      : 'border-gray-300'
                  }`}>
                    {selected.size === updatedResults.length && (
                      <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {selected.size > 0 && selected.size < updatedResults.length && (
                      <div className="w-2 h-0.5 bg-blue-500 rounded" />
                    )}
                  </div>
                  {selected.size === updatedResults.length ? 'Desmarcar todos' : 'Marcar todos'}
                </button>

                <span className="text-xs text-gray-400">
                  {selected.size} de {updatedResults.length} selecionado{selected.size !== 1 ? 's' : ''}
                </span>
              </div>

              <button
                onClick={handleApply}
                disabled={applying || selected.size === 0}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {applying ? (
                  <><span className="animate-spin">⟳</span> Atualizando…</>
                ) : (
                  <>💾 Atualizar {selected.size > 0 ? `(${selected.size})` : ''}</>
                )}
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(['all', 'created', 'updated', 'skipped'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-all ${
                  filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'all' ? `Todos (${response.summary.total})` : ACTION_LABEL[f]}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Nenhum item nesta categoria.</p>
            ) : (
              filtered.map((r, i) => {
                const isUpdated  = r.action === 'updated'
                const isSelected = selected.has(r.ifood_id)
                const hasPrice   = r.ifood_price != null
                const priceDiff  = hasPrice && r.current_price != null && r.ifood_price !== r.current_price
                const nameDiff   = r.ifood_name && r.current_name && r.ifood_name !== r.current_name

                return (
                  <div
                    key={i}
                    onClick={() => isUpdated && !applied ? toggleOne(r.ifood_id) : undefined}
                    className={`border rounded-xl px-3 py-3 transition-all ${
                      isUpdated && !applied ? 'cursor-pointer' : ''
                    } ${
                      isUpdated && isSelected && !applied
                        ? 'bg-blue-50 border-blue-300'
                        : r.action === 'created'
                        ? 'bg-green-50/60 border-green-200'
                        : r.action === 'skipped'
                        ? 'bg-yellow-50/60 border-yellow-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox para "updated" */}
                      {isUpdated && !applied && (
                        <div className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
                        }`}>
                          {isSelected && (
                            <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                      )}

                      {/* Ícone para não-updated */}
                      {(!isUpdated || applied) && (
                        <span className="text-base mt-0.5 shrink-0">
                          {r.action === 'created' ? '✨' : r.action === 'updated' ? '✅' : '⚠️'}
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        {/* Nome */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">{r.name}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            r.action === 'created' ? 'bg-green-100 text-green-700'
                            : r.action === 'updated' ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {ACTION_LABEL[r.action]}
                          </span>
                        </div>

                        {/* Comparação nome */}
                        {nameDiff && (
                          <div className="mt-1.5 flex items-center gap-2 text-xs flex-wrap">
                            <span className="text-gray-400">Nome:</span>
                            <span className="line-through text-red-400">{r.current_name}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-green-600 font-medium">{r.ifood_name}</span>
                          </div>
                        )}

                        {/* Comparação preço */}
                        {isUpdated && hasPrice && (
                          <div className="mt-1.5 flex items-center gap-2 text-xs flex-wrap">
                            <span className="text-gray-400">Preço iFood:</span>
                            <span className={`font-semibold ${priceDiff ? 'text-orange-600' : 'text-gray-700'}`}>
                              {fmt(r.ifood_price)}
                            </span>
                            {r.current_price != null && (
                              <>
                                <span className="text-gray-300">|</span>
                                <span className="text-gray-400">Sistema:</span>
                                <span className={`font-medium ${priceDiff ? 'text-red-400 line-through' : 'text-gray-600'}`}>
                                  {fmt(r.current_price)}
                                </span>
                                {priceDiff && (
                                  <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                                    Divergência
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* Preço para criados */}
                        {r.action === 'created' && r.ifood_price != null && (
                          <p className="text-xs text-gray-500 mt-1">
                            Preço: <span className="font-medium text-gray-700">{fmt(r.ifood_price)}</span>
                          </p>
                        )}

                        {/* Motivo do skip */}
                        {r.reason && (
                          <p className="text-xs text-yellow-600 mt-1">{r.reason}</p>
                        )}

                        {/* ID */}
                        <p className="text-[10px] text-gray-300 font-mono mt-1 truncate">{r.ifood_id}</p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
