'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { CashRegister } from '@/types/cash-register'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDuration(openAt: string, closeAt?: string) {
  const start = new Date(openAt).getTime()
  const end   = closeAt ? new Date(closeAt).getTime() : Date.now()
  const mins  = Math.floor((end - start) / 60000)
  const h     = Math.floor(mins / 60)
  const m     = mins % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

type SessionWithOrders = CashRegister & {
  orderCount: number
  paymentBreakdown: { method: string; total: number; count: number }[]
}

export function CashHistoryView() {
  const [sessions, setSessions]   = useState<SessionWithOrders[]>([])
  const [loading,  setLoading]    = useState(true)
  const [error,    setError]      = useState<string | null>(null)
  const [expanded, setExpanded]   = useState<string | null>(null)

  // Filtros
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => { load() }, [dateFrom, dateTo])

const load = async () => {
  setLoading(true)
  setError(null)
  try {
    // ── busca company_id do usuário autenticado ──────────────────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Não autenticado')

    const { data: company, error: coErr } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .single()
    if (coErr || !company) throw new Error('Empresa não encontrada')

    // ── busca caixas filtrados pela empresa ──────────────────────────
    const { data: registers, error: regErr } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('company_id', company.id)          // ← adicionar
      .gte('opening_at', `${dateFrom}T00:00:00`)
      .lte('opening_at', `${dateTo}T23:59:59`)
      .order('opening_at', { ascending: false })

    if (regErr) throw regErr
    if (!registers?.length) { setSessions([]); return }

      // Busca pedidos de todos os caixas de uma vez
      const registerIds = registers.map(r => r.id)
      const { data: orders } = await supabase
        .from('orders')
        .select('cash_register_id, total, payment_method, status')
        .in('cash_register_id', registerIds)
        .neq('status', 'cancelled')

      // Agrega por caixa
      const enriched: SessionWithOrders[] = registers.map(reg => {
        const regOrders = (orders ?? []).filter(o => o.cash_register_id === reg.id)

        const paymentBreakdown: Record<string, { total: number; count: number }> = {}
        regOrders.forEach(o => {
          const m = o.payment_method ?? 'outro'
          if (!paymentBreakdown[m]) paymentBreakdown[m] = { total: 0, count: 0 }
          paymentBreakdown[m].total += Number(o.total ?? 0)
          paymentBreakdown[m].count += 1
        })

        return {
          ...reg,
          orderCount: regOrders.length,
          paymentBreakdown: Object.entries(paymentBreakdown).map(([method, v]) => ({
            method, ...v,
          })).sort((a, b) => b.total - a.total),
        }
      })

      setSessions(enriched)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Totais agregados do período
  const totals = useMemo(() => ({
    totalSales:   sessions.reduce((s, r) => s + (r.total_sales ?? 0), 0),
    totalOrders:  sessions.reduce((s, r) => s + r.orderCount, 0),
    totalSessions: sessions.length,
    closedSessions: sessions.filter(r => r.status === 'closed').length,
  }), [sessions])

  const PAYMENT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    dinheiro: { label: 'Dinheiro',        icon: '💵', color: 'text-green-600' },
    pix:      { label: 'Pix',             icon: '💠', color: 'text-blue-600'  },
    cartao:   { label: 'Cartão',          icon: '💳', color: 'text-purple-600'},
    credito:  { label: 'Crédito',         icon: '💳', color: 'text-purple-600'},
    debito:   { label: 'Débito',          icon: '💳', color: 'text-indigo-600'},
    outro:    { label: 'Outros',          icon: '🔹', color: 'text-gray-500'  },
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-10">

      {/* Filtros de data */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
          <span className="text-xs text-gray-400 font-medium">De</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-sm text-gray-700 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
          <span className="text-xs text-gray-400 font-medium">Até</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-sm text-gray-700 focus:outline-none"
          />
        </div>
        <button
          onClick={load}
          className="text-sm px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition-colors font-medium"
        >
          Filtrar
        </button>
      </div>

      {/* Cards de resumo */}
      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total de Vendas',  value: fmtBRL(totals.totalSales),             color: 'bg-green-50 border-green-100',  text: 'text-green-700' },
            { label: 'Pedidos',          value: String(totals.totalOrders),             color: 'bg-blue-50 border-blue-100',    text: 'text-blue-700'  },
            { label: 'Turnos',           value: String(totals.totalSessions),           color: 'bg-gray-50 border-gray-200',    text: 'text-gray-700'  },
            { label: 'Turnos fechados',  value: String(totals.closedSessions),          color: 'bg-orange-50 border-orange-100',text: 'text-orange-700'},
          ].map(c => (
            <div key={c.label} className={`border rounded-2xl p-4 text-center ${c.color}`}>
              <p className={`text-xs font-medium mb-1 ${c.text} opacity-70`}>{c.label}</p>
              <p className={`text-lg font-bold ${c.text}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Carregando histórico...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          <p className="text-3xl mb-3">📋</p>
          <p>Nenhum turno encontrado no período.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map(session => {
            const isOpen     = session.status === 'open'
            const isExpanded = expanded === session.id

            return (
              <div
                key={session.id}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all"
              >
                {/* Linha principal — clicável */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : session.id)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />

                  {/* Operador + data */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">{session.operator_name}</p>
                      {isOpen && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          ABERTO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {fmtDateTime(session.opening_at)}
                      {session.closing_at && ` → ${fmtDateTime(session.closing_at)}`}
                      {' · '}
                      {fmtDuration(session.opening_at, session.closing_at ?? undefined)}
                    </p>
                  </div>

                  {/* Vendas + pedidos */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{fmtBRL(session.total_sales ?? 0)}</p>
                    <p className="text-xs text-gray-400">{session.orderCount} pedidos</p>
                  </div>

                  {/* Chevron */}
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2"
                    className={`text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Detalhe expandido */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4 flex flex-col gap-4">

                    {/* Grid de info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Abertura (fundo)',   value: fmtBRL(session.opening_amount) },
                        { label: 'Fechamento (contado)', value: session.closing_amount != null ? fmtBRL(session.closing_amount) : '—' },
                        { label: 'Op. abertura',       value: session.operator_name },
                        { label: 'Op. fechamento',     value: session.closing_operator_name ?? '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] text-gray-400 font-medium mb-1">{label}</p>
                          <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Cancelamentos */}
                    {(session.total_cancelled ?? 0) > 0 && (
                      <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                        <span className="text-sm text-red-600 font-medium">Total cancelado</span>
                        <span className="text-sm font-bold text-red-600">{fmtBRL(session.total_cancelled ?? 0)}</span>
                      </div>
                    )}

                    {/* Breakdown por pagamento */}
                    {session.paymentBreakdown.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          Por forma de pagamento
                        </p>
                        <div className="flex flex-col gap-2">
                          {session.paymentBreakdown.map(p => {
                            const meta = PAYMENT_LABELS[p.method] ?? PAYMENT_LABELS.outro
                            const pct  = (session.total_sales ?? 0) > 0
                              ? ((p.total / (session.total_sales ?? 1)) * 100).toFixed(0)
                              : '0'
                            return (
                              <div key={p.method} className="flex items-center gap-3">
                                <span className="text-base w-5">{meta.icon}</span>
                                <div className="flex-1">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-xs text-gray-600 font-medium">{meta.label}</span>
                                    <span className="text-xs text-gray-400">{p.count} transações · {pct}%</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div
                                      className="bg-gray-400 h-1.5 rounded-full"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                                <span className={`text-sm font-bold w-24 text-right ${meta.color}`}>
                                  {fmtBRL(p.total)}
                                </span>
                              </div>
                            )
                          })}
                          <div className="flex justify-between pt-2 border-t border-gray-100 mt-1">
                            <span className="text-sm font-semibold text-gray-600">Total</span>
                            <span className="text-sm font-bold text-gray-900">{fmtBRL(session.total_sales ?? 0)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-2">Nenhuma venda neste turno.</p>
                    )}

                    {/* Observações */}
                    {(session.opening_notes || session.closing_notes) && (
                      <div className="flex flex-col gap-2">
                        {session.opening_notes && (
                          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-semibold text-blue-500 mb-1">OBS. ABERTURA</p>
                            <p className="text-xs text-blue-700">{session.opening_notes}</p>
                          </div>
                        )}
                        {session.closing_notes && (
                          <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                            <p className="text-[10px] font-semibold text-orange-500 mb-1">OBS. FECHAMENTO</p>
                            <p className="text-xs text-orange-700">{session.closing_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}