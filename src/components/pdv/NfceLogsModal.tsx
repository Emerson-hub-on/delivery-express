import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { NfceInutilizarModal } from '@/components/pdv/NfceInutilizarModal'

// ─── tipos ────────────────────────────────────────────────────────────────────

type NfceLogEntry = {
  id: number
  code: string | null
  nfce_numero: number | null
  nfce_chave: string | null
  nfce_status: 'pendente' | 'rejeitado'
  nfce_motivo: string | null
  nfce_cstat: number | null
  total: number | null
  created_at: string
}

type Props = {
  companyId: string
  serie: string
  onClose: () => void
  onRetentar?: (orderIds: number[]) => void
  onToast?: (msg: string, type?: 'ok' | 'err') => void
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtChave = (c: string | null) => {
  if (!c) return '—'
  return `${c.slice(0, 4)}...${c.slice(-8)}`
}

const fmtData = (s: string) => {
  const d = new Date(s)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const toDateInputValue = (d: Date) => d.toISOString().slice(0, 10)

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  pendente:  { label: 'Pendente',  bg: '#fefce8', color: '#92400e', dot: '#d97706' },
  rejeitado: { label: 'Rejeitado', bg: '#fef2f2', color: '#991b1b', dot: '#dc2626' },
}

const C = {
  border:   '#e2e6ed',
  surface:  '#fff',
  bg:       '#fafbfc',
  txtPri:   '#1a1f2e',
  txtSec:   '#5a6272',
  txtMuted: '#9aa0ae',
  indigo:   '#6366f1',
  indigoBg: '#eef2ff',
  red:      '#dc2626',
  yellow:   '#d97706',
  green:    '#16a34a',
} as const

// ─── componente ───────────────────────────────────────────────────────────────

export function NfceLogsModal({ companyId, serie, onClose, onRetentar, onToast }: Props) {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const [entries,        setEntries]        = useState<NfceLogEntry[]>([])
  const [loading,        setLoading]        = useState(true)
  const [expanded,       setExpanded]       = useState<number | null>(null)
  const [filter,         setFilter]         = useState<'todos' | 'pendente' | 'rejeitado'>('todos')
  const [dateFrom,       setDateFrom]       = useState(toDateInputValue(sevenDaysAgo))
  const [dateTo,         setDateTo]         = useState(toDateInputValue(new Date()))
  const [selected,       setSelected]       = useState<Set<number>>(new Set())
  const [retrying,       setRetrying]       = useState(false)
  const [inutilizarOpen, setInutilizarOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())

    const fromStart = new Date(dateFrom + 'T00:00:00')
    const toEnd     = new Date(dateTo   + 'T23:59:59.999')

    const { data, error } = await supabase
      .from('orders')
      .select('id, code, nfce_numero, nfce_chave, nfce_status, nfce_motivo, nfce_cstat, total, created_at')
      .eq('company_id', companyId)
      .in('nfce_status', ['pendente', 'rejeitado'])
      .gte('created_at', fromStart.toISOString())
      .lte('created_at', toEnd.toISOString())
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) console.error('NfceLogsModal load error:', error)
    setEntries((data ?? []) as NfceLogEntry[])
    setLoading(false)
  }, [companyId, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !inutilizarOpen) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, inutilizarOpen])

  const filtered       = filter === 'todos' ? entries : entries.filter(e => e.nfce_status === filter)
  const countPendente  = entries.filter(e => e.nfce_status === 'pendente').length
  const countRejeitado = entries.filter(e => e.nfce_status === 'rejeitado').length

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(e => e.id)))
  }

  const allSelected  = filtered.length > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0 && selected.size < filtered.length

  const handleRetentarSelecionados = async () => {
    if (selected.size === 0 || !onRetentar) return
    setRetrying(true)
    try {
      await onRetentar(Array.from(selected))
    } finally {
      setRetrying(false)
      setSelected(new Set())
      load()
    }
  }

  return (
    <>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 60,
      }}>
        <div style={{
          background: C.surface, borderRadius: 16,
          width: 740, maxWidth: '97vw', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          border: `1px solid ${C.border}`, overflow: 'hidden',
        }}>

          {/* ── Cabeçalho ────────────────────────────────────────────────── */}
          <div style={{
            padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: C.bg, flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: '#fef2f2', border: '1px solid #fecaca',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>🧾</div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.txtPri, lineHeight: 1.2 }}>Logs NFC-e</p>
                <p style={{ fontSize: 11, color: C.txtMuted, lineHeight: 1.2 }}>Cupons com erro ou aguardando transmissão</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {countPendente > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#fefce8', color: '#92400e', border: '1px solid #fde68a' }}>
                  {countPendente} pendente{countPendente > 1 ? 's' : ''}
                </span>
              )}
              {countRejeitado > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                  {countRejeitado} rejeitado{countRejeitado > 1 ? 's' : ''}
                </span>
              )}

              {/* ── Botão Inutilizar ── */}
              <button
                onClick={() => setInutilizarOpen(true)}
                title="Inutilizar número(s) de NFC-e"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                  border: '1.5px solid #fde68a', background: '#fefce8',
                  fontSize: 11, fontWeight: 600, color: '#92400e',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fef08a' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fefce8' }}
              >
                <span style={{ fontSize: 13 }}>🚫</span> Inutilizar
              </button>

              <button onClick={load} title="Atualizar" style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔄</button>
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, cursor: 'pointer', fontSize: 16, color: C.txtMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
            </div>
          </div>

          {/* ── Filtros ──────────────────────────────────────────────────── */}
          <div style={{
            padding: '10px 20px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
            background: C.surface, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {(['todos', 'pendente', 'rejeitado'] as const).map(f => (
                <button key={f} onClick={() => { setFilter(f); setSelected(new Set()) }} style={{
                  padding: '5px 13px', borderRadius: 20, border: '1.5px solid',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
                  borderColor: filter === f ? C.indigo : C.border,
                  background: filter === f ? C.indigoBg : C.surface,
                  color: filter === f ? '#4338ca' : C.txtSec,
                }}>
                  {f === 'todos' ? `Todos (${entries.length})` : f === 'pendente' ? `Pendentes (${countPendente})` : `Rejeitados (${countRejeitado})`}
                </button>
              ))}
            </div>

            <div style={{ width: 1, height: 22, background: C.border, flexShrink: 0 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: C.txtMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>De</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ fontSize: 11, color: C.txtPri, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '5px 8px', outline: 'none', cursor: 'pointer' }} />
              <span style={{ fontSize: 11, color: C.txtMuted, fontWeight: 600 }}>até</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ fontSize: 11, color: C.txtPri, background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 7, padding: '5px 8px', outline: 'none', cursor: 'pointer' }} />
              {[{ label: 'Hoje', days: 0 }, { label: '7 dias', days: 7 }, { label: '30 dias', days: 30 }].map(({ label, days }) => (
                <button key={label} onClick={() => {
                  const t = new Date(); const f = new Date(t)
                  f.setDate(t.getDate() - days)
                  setDateFrom(toDateInputValue(f)); setDateTo(toDateInputValue(t))
                }} style={{ fontSize: 10, padding: '4px 9px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg, color: C.txtSec, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Barra ações em lote ───────────────────────────────────────── */}
          {filtered.length > 0 && (
            <div style={{
              padding: '8px 20px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
              background: selected.size > 0 ? '#f0f4ff' : C.surface, transition: 'background 0.2s',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox" checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected }}
                  onChange={toggleAll}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C.indigo }}
                />
                <span style={{ fontSize: 12, color: C.txtSec, fontWeight: 500 }}>
                  {allSelected ? 'Desmarcar todos' : `Selecionar todos (${filtered.length})`}
                </span>
              </label>

              {selected.size > 0 && (
                <>
                  <span style={{ fontSize: 11, color: C.indigo, fontWeight: 700 }}>
                    {selected.size} selecionado{selected.size > 1 ? 's' : ''}
                  </span>
                  {onRetentar && (
                    <button onClick={handleRetentarSelecionados} disabled={retrying} style={{
                      marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '6px 16px',
                      borderRadius: 8, border: 'none', cursor: retrying ? 'not-allowed' : 'pointer',
                      background: retrying ? '#a5b4fc' : C.indigo, color: '#fff',
                      display: 'flex', alignItems: 'center', gap: 6,
                      boxShadow: '0 2px 6px rgba(99,102,241,0.25)',
                      opacity: retrying ? 0.7 : 1, transition: 'all 0.15s',
                    }}>
                      {retrying
                        ? <><span style={{ fontSize: 13 }}>⏳</span> Enviando...</>
                        : <><span style={{ fontSize: 13 }}>🔁</span> Retentar {selected.size > 1 ? `${selected.size} cupons` : 'cupom'}</>
                      }
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Cabeçalho tabela ─────────────────────────────────────────── */}
          {!loading && filtered.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: '36px 100px 110px 1fr 96px 28px',
              padding: '6px 20px', background: '#f4f6fa',
              borderBottom: `1px solid ${C.border}`, flexShrink: 0,
            }}>
              {['', 'Pedido', 'Data/Hora', 'Chave / Motivo', 'Valor', ''].map((h, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.txtMuted, textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: i === 4 ? 'right' : 'left' }}>{h}</span>
              ))}
            </div>
          )}

          {/* ── Lista ────────────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${C.border} transparent` }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: C.txtMuted, fontSize: 13 }}>
                <div style={{ width: 18, height: 18, border: `2px solid ${C.indigo}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Carregando logs...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
                <span style={{ fontSize: 32 }}>✅</span>
                <p style={{ fontSize: 14, color: C.txtSec, fontWeight: 500 }}>Nenhum cupom com erro no período</p>
                <p style={{ fontSize: 12, color: C.txtMuted }}>Tente ampliar o intervalo de datas</p>
              </div>
            ) : (
              filtered.map((entry, idx) => {
                const st        = STATUS_LABEL[entry.nfce_status]
                const isOpen    = expanded === entry.id
                const isChecked = selected.has(entry.id)

                return (
                  <div key={entry.id} style={{
                    borderBottom: '1px solid #f1f3f7',
                    background: isChecked ? '#eff2ff' : isOpen ? '#fafbff' : idx % 2 === 0 ? C.surface : C.bg,
                    transition: 'background 0.12s',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '36px 100px 110px 1fr 96px 28px', alignItems: 'center', padding: '10px 20px', gap: 8 }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(entry.id)} onClick={e => e.stopPropagation()}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C.indigo }} />

                      <div style={{ cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : entry.id)}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: C.txtPri, fontFamily: 'monospace', margin: 0 }}>
                          #{entry.code ?? String(entry.id).padStart(6, '0')}
                        </p>
                        {entry.nfce_numero && (
                          <p style={{ fontSize: 10, color: C.txtMuted, margin: 0 }}>NFC-e {String(entry.nfce_numero).padStart(6, '0')}</p>
                        )}
                      </div>

                      <p style={{ fontSize: 11, color: C.txtSec, cursor: 'pointer', margin: 0 }} onClick={() => setExpanded(isOpen ? null : entry.id)}>
                        {fmtData(entry.created_at)}
                      </p>

                      <div style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : entry.id)}>
                        <p style={{ fontSize: 10, color: C.txtMuted, fontFamily: 'monospace', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.nfce_chave ? fmtChave(entry.nfce_chave) : '— sem chave —'}
                        </p>
                        {entry.nfce_motivo && (
                          <p style={{ fontSize: 11, color: entry.nfce_status === 'rejeitado' ? '#b91c1c' : '#92400e', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {entry.nfce_motivo}
                          </p>
                        )}
                      </div>

                      <div style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : entry.id)}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#f97316', margin: 0 }}>{fmt(entry.total)}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: st.bg, color: st.color, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, display: 'inline-block' }} />
                          {st.label}
                        </span>
                      </div>

                      <span onClick={() => setExpanded(isOpen ? null : entry.id)} style={{ color: C.txtMuted, fontSize: 11, textAlign: 'center', transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'none', cursor: 'pointer' }}>▼</span>
                    </div>

                    {isOpen && (
                      <div style={{ padding: '0 20px 14px 52px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {entry.nfce_chave && (
                          <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                            <p style={{ fontSize: 10, color: C.txtMuted, fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Chave de acesso</p>
                            <p style={{ fontSize: 11, color: C.txtPri, fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.6, margin: 0 }}>{entry.nfce_chave}</p>
                          </div>
                        )}

                        <div style={{
                          background: entry.nfce_status === 'rejeitado' ? '#fef2f2' : '#fefce8',
                          borderRadius: 8, padding: '10px 12px',
                          border: `1px solid ${entry.nfce_status === 'rejeitado' ? '#fecaca' : '#fde68a'}`,
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                        }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{entry.nfce_status === 'rejeitado' ? '❌' : '⏳'}</span>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: entry.nfce_status === 'rejeitado' ? '#991b1b' : '#92400e', marginBottom: 3 }}>
                              {entry.nfce_status === 'rejeitado'
                                ? `Erro SEFAZ${entry.nfce_cstat ? ` [cStat ${entry.nfce_cstat}]` : ''}`
                                : 'Aguardando transmissão'}
                            </p>
                            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: entry.nfce_status === 'rejeitado' ? '#b91c1c' : '#78350f' }}>
                              {entry.nfce_motivo ?? 'Sem detalhes registrados'}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {/* Inutilizar este número específico */}
                          {entry.nfce_numero && (
                            <button
                              onClick={() => setInutilizarOpen(true)}
                              style={{
                                fontSize: 11, fontWeight: 600, padding: '6px 12px',
                                borderRadius: 7, border: '1.5px solid #fde68a',
                                cursor: 'pointer', background: '#fefce8', color: '#92400e',
                                display: 'flex', alignItems: 'center', gap: 5,
                              }}
                            >
                              🚫 Inutilizar nº {entry.nfce_numero}
                            </button>
                          )}

                          {onRetentar && (
                            <button
                              onClick={() => { onRetentar([entry.id]); setSelected(new Set()); load() }}
                              style={{
                                fontSize: 12, fontWeight: 600, padding: '7px 16px',
                                borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: C.indigo, color: '#fff',
                                boxShadow: '0 2px 6px rgba(99,102,241,0.25)',
                                display: 'flex', alignItems: 'center', gap: 6,
                                marginLeft: 'auto',
                              }}
                            >
                              🔁 Retentar este cupom
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* ── Rodapé ───────────────────────────────────────────────────── */}
          <div style={{
            padding: '10px 20px', borderTop: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: C.bg, flexShrink: 0,
          }}>
            <p style={{ fontSize: 11, color: C.txtMuted }}>
              Pressione{' '}
              <kbd style={{ background: C.border, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }}>ESC</kbd>{' '}
              para fechar · {filtered.length} registro{filtered.length !== 1 ? 's' : ''} no período
            </p>
            <button onClick={onClose} style={{
              fontSize: 12, padding: '6px 16px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.surface,
              cursor: 'pointer', color: C.txtSec, fontWeight: 500,
            }}>Fechar</button>
          </div>
        </div>
      </div>

      {/* ── Modal de inutilização (sobreposto) ──────────────────────────── */}
      {inutilizarOpen && (
        <NfceInutilizarModal
          companyId={companyId}
          serie={serie}
          onClose={() => setInutilizarOpen(false)}
          onSuccess={msg => {
            setInutilizarOpen(false)
            onToast?.(msg, 'ok')
          }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}