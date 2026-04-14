'use client'
// components/ifood/ifood-sync.tsx
//
// Painel de sincronização do catálogo iFood → Supabase products.
// Coloque este componente na aba "iFood Sync" do seu painel de Relatórios.

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface SyncResult {
  ifood_id: string
  name: string
  action: 'created' | 'updated' | 'skipped'
  reason?: string
}

interface SyncSummary {
  created: number
  updated: number
  skipped: number
  total: number
}

interface SyncResponse {
  message: string
  summary: SyncSummary
  results: SyncResult[]
  error?: string
}

const ACTION_CONFIG = {
  created: { label: 'Criado',    color: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/20',  icon: '✨' },
  updated: { label: 'Atualizado', color: 'text-blue-400',  bg: 'bg-blue-400/10 border-blue-400/20',   icon: '🔄' },
  skipped: { label: 'Ignorado',  color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', icon: '⚠️' },
}

export function IfoodSync() {
  const [loading, setLoading]       = useState(false)
  const [response, setResponse]     = useState<SyncResponse | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [filter, setFilter]         = useState<'all' | 'created' | 'updated' | 'skipped'>('all')
  const [merchantId, setMerchantId] = useState('')

  const handleSync = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      // Pega o token do usuário logado para autenticar na API route
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Você precisa estar logado para sincronizar.')

      const body: Record<string, string> = {}
      if (merchantId.trim()) body.merchantId = merchantId.trim()

      const res = await fetch('/api/ifood/sync-catalog', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      const json: SyncResponse = await res.json()

      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)

      setResponse(json)
    } catch (e: any) {
      setError(e.message || 'Erro desconhecido.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = response?.results.filter(r =>
    filter === 'all' ? true : r.action === filter
  ) ?? []

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

      {/* Merchant ID opcional */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Merchant ID <span className="normal-case font-normal text-gray-400">(opcional se configurado no .env)</span>
          </label>
          <input
            value={merchantId}
            onChange={e => setMerchantId(e.target.value)}
            placeholder="Ex: a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all font-mono"
          />
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <p className="text-xs text-orange-700">
            <strong>Como funciona:</strong> Busca todos os itens do seu catálogo ativo no iFood.
            Produtos já existentes (pelo ID ou nome) são <strong>atualizados</strong> (preço, imagem, disponibilidade).
            Produtos novos são <strong>cadastrados</strong> automaticamente na categoria "iFood".
          </p>
        </div>

        <button
          onClick={handleSync}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin text-base">⟳</span>
              Sincronizando…
            </>
          ) : (
            <>🔄 Sincronizar agora</>
          )}
        </button>
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-xs text-red-600">❌ {error}</p>
        </div>
      )}

      {/* Resultado */}
      {response && (
        <div className="space-y-4">
          {/* Mensagem */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-xs text-green-700 font-medium">✅ {response.message}</p>
          </div>

          {/* Pills de resumo */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'created', label: 'Criados',     value: response.summary.created, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
              { key: 'updated', label: 'Atualizados', value: response.summary.updated, color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-200' },
              { key: 'skipped', label: 'Ignorados',   value: response.summary.skipped, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setFilter(filter === s.key as any ? 'all' : s.key as any)}
                className={`border rounded-xl p-3 text-center transition-all ${s.bg} ${
                  filter === s.key ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                }`}
              >
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </button>
            ))}
          </div>

          {/* Filtros de ação */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {(['all', 'created', 'updated', 'skipped'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-all ${
                  filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f === 'all' ? `Todos (${response.summary.total})` : ACTION_CONFIG[f].label}
              </button>
            ))}
          </div>

          {/* Lista de resultados */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nenhum item nesta categoria.</p>
            ) : (
              filtered.map((r, i) => {
                const cfg = ACTION_CONFIG[r.action]
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 border rounded-xl px-3 py-2.5 ${cfg.bg}`}
                  >
                    <span className="text-base mt-0.5 shrink-0">{cfg.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                        {r.ifood_id && (
                          <span className="text-[10px] text-gray-400 font-mono truncate">
                            ID: {r.ifood_id}
                          </span>
                        )}
                      </div>
                      {r.reason && (
                        <p className="text-xs text-yellow-600 mt-0.5">{r.reason}</p>
                      )}
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
