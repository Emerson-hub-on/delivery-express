'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { cancelarVendaPdv } from '@/services/pdv'

type Venda = {
  id: number
  code: string
  created_at: string
  total: number
  status: string
  cupom_cancelado: boolean
  consumer_name: string | null
  payment_method: string | null
  nfce_status: string | null
  nfce_numero: number | null
  operator_name: string | null
  order_items: { product_name: string; quantity: number; unit_price: number }[]
}

type Props = {
  companyId: string
  cashRegisterId: string
  onClose: () => void
  onCancelado: (msg: string) => void
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const PAY_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão',
}

export function CancelarVendaModal({ companyId, cashRegisterId, onClose, onCancelado }: Props) {
  const hoje = new Date().toISOString().slice(0, 10)

  const [dateFrom, setDateFrom]   = useState(hoje)
  const [dateTo, setDateTo]       = useState(hoje)
  const [search, setSearch]       = useState('')
  const [vendas, setVendas]       = useState<Venda[]>([])
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState<Venda | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const buscar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
        let query = supabase
        .from('orders')
        .select(`
            id, code, created_at, total, status, cupom_cancelado,
            consumer_name, payment_method, nfce_status, nfce_numero, operator_name,
            order_items ( product_name, quantity, unit_price )
        `)
        .eq('company_id', companyId)
        .eq('order_type', 'pdv')
        .eq('cash_register_id', cashRegisterId)
        .order('created_at', { ascending: false })
        .limit(50)

        if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
        if (dateTo)   query = query.lte('created_at', `${dateTo}T23:59:59`)
        if (search.trim()) query = query.ilike('code', `%${search.trim()}%`)

        const { data, error: err } = await query
        if (err) throw new Error(err.message)
        setVendas((data ?? []) as Venda[])
    } catch (e: any) {
        setError(e.message)
    } finally {
        setLoading(false)
    }
}, [companyId, cashRegisterId, dateFrom, dateTo, search])

  useEffect(() => { buscar() }, [buscar])

  const handleCancelar = async () => {
    if (!selected) return
    setCancelling(true)
    setError(null)
    try {
      await cancelarVendaPdv(selected.id)
      onCancelado(`Venda #${selected.code} cancelada e estoque estornado`)
      onClose()
    } catch (e: any) {
      setError(e.message)
      setCancelling(false)
    }
  }

  const statusBadge = (v: Venda) => {
    if (v.cupom_cancelado || v.status === 'cancelled') {
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold whitespace-nowrap">Cancelada</span>
    }
    if (v.nfce_status === 'emitido') {
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold whitespace-nowrap">NFC-e emitida</span>
    }
    if (v.nfce_status === 'rejeitado') {
      return <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold whitespace-nowrap">NFC-e rejeitada</span>
    }
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold whitespace-nowrap">Sem NFC-e</span>
  }

  const podeCancel = selected && !selected.cupom_cancelado && selected.status !== 'cancelled'

  return (
    <div className="absolute inset-0 bg-black/45 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">

        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">Cancelar Venda</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Selecione a venda que deseja cancelar</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 border-none cursor-pointer text-slate-500 text-base transition-colors">✕</button>
        </div>

        {/* filtros */}
        <div className="px-6 py-3 border-b border-slate-200 shrink-0 flex flex-wrap gap-3 items-end bg-slate-50">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-500 font-semibold">Data inicial</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-white border-[1.5px] border-slate-200 focus:border-indigo-400 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-900 outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-500 font-semibold">Data final</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-white border-[1.5px] border-slate-200 focus:border-indigo-400 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-900 outline-none" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-[11px] text-slate-500 font-semibold">Número da venda</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar()} placeholder="Ex: 000142"
              className="bg-white border-[1.5px] border-slate-200 focus:border-indigo-400 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-900 outline-none" />
          </div>
          <button onClick={buscar} disabled={loading}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-[12px] font-semibold px-4 py-1.5 rounded-lg border-none cursor-pointer transition-colors whitespace-nowrap">
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {/* lista */}
        <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-400 text-[13px]">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Carregando vendas...
            </div>
          )}

          {!loading && vendas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="text-3xl">🗃️</span>
              <p className="text-[13px] text-slate-400">Nenhuma venda encontrada</p>
            </div>
          )}

          {!loading && vendas.map((v, idx) => {
            const isSel = selected?.id === v.id
            const isCancelled = v.cupom_cancelado || v.status === 'cancelled'
            return (
              <div key={v.id} onClick={() => !isCancelled && setSelected(isSel ? null : v)}
                className={`px-6 py-3.5 border-b border-slate-200 transition-colors border-l-[3px]
                  ${isCancelled ? 'opacity-50 cursor-not-allowed'
                    : isSel ? 'bg-indigo-50 border-l-indigo-500 cursor-pointer'
                    : `border-l-transparent cursor-pointer ${idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'}`}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[13px] font-bold text-slate-900">#{v.code}</span>
                      {statusBadge(v)}
                      {v.nfce_numero && (
                        <span className="text-[10px] text-slate-400">NFC-e nº {String(v.nfce_numero).padStart(6, '0')}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mb-1">{fmtDt(v.created_at)}{v.operator_name ? ` · ${v.operator_name}` : ''}</p>
                    {v.consumer_name && (
                      <p className="text-[11px] text-slate-500">👤 {v.consumer_name}</p>
                    )}
                    {/* itens resumidos */}
                    {Array.isArray(v.order_items) && v.order_items.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {v.order_items.slice(0, 3).map((it, i) => (
                        <span key={i} className="text-[10px] text-slate-400">
                            {it.quantity}× {it.product_name}
                        </span>
                        ))}
                        {v.order_items.length > 3 && <span className="text-[10px] text-slate-400">+{v.order_items.length - 3} itens</span>}
                    </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-bold text-orange-500">{fmt(v.total ?? 0)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{PAY_LABEL[v.payment_method ?? ''] ?? v.payment_method ?? '—'}</p>
                    {isSel && !isCancelled && (
                      <div className="mt-1.5 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center ml-auto">
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* erro */}
        {error && (
          <div className="px-6 py-2 bg-red-50 border-t border-red-200 shrink-0">
            <p className="text-[12px] text-red-600">⚠️ {error}</p>
          </div>
        )}

        {/* footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between gap-3">
          <div className="text-[12px] text-slate-400">
            {selected && !confirming
              ? <span>Venda <strong className="text-slate-700">#{selected.code}</strong> selecionada — {fmt(selected.total ?? 0)}</span>
              : `${vendas.length} ${vendas.length === 1 ? 'venda encontrada' : 'vendas encontradas'}`
            }
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-500 bg-white text-[13px] cursor-pointer hover:bg-slate-50 transition-colors">Fechar</button>
            <button
              onClick={() => setConfirming(true)}
              disabled={!podeCancel}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-[13px] font-semibold border-none cursor-pointer transition-colors">
              Cancelar venda selecionada
            </button>
          </div>
        </div>
      </div>

      {/* ── Confirm modal ── */}
      {confirming && selected && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[80]">
          <div className="bg-white rounded-2xl p-6 w-[400px] shadow-2xl border border-slate-200 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-xl">⚠️</div>
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Confirmar cancelamento</h3>
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  Você está cancelando a venda <strong className="text-slate-700">#{selected.code}</strong> de <strong className="text-slate-700">{fmt(selected.total ?? 0)}</strong>.
                  O estoque dos itens vendidos será restaurado automaticamente.
                </p>
              </div>
            </div>

            {/* itens da venda */}
            {Array.isArray(selected.order_items) && selected.order_items.length > 0 && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-200 bg-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Itens que terão estoque estornado</span>
                </div>
                {selected.order_items.map((it, i) => (
                <div key={i} className={`flex justify-between px-4 py-2 text-[12px] ${i > 0 ? 'border-t border-slate-200' : ''}`}>
                    <span className="text-slate-700">{it.quantity}× {it.product_name}</span>
                    <span className="text-slate-500">{fmt((it.unit_price ?? 0) * it.quantity)}</span>
                </div>
                ))}
            </div>
            )}

            {selected.nfce_status === 'emitido' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                <span className="text-base shrink-0">⚠️</span>
                <p className="text-[12px] text-amber-700 leading-relaxed">
                  Esta venda possui NFC-e emitida. O cancelamento da venda <strong>não cancela automaticamente o documento fiscal</strong> na SEFAZ — faça isso manualmente pelo módulo de NFC-e se necessário.
                </p>
              </div>
            )}

            {error && <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⚠️ {error}</p>}

            <div className="flex gap-2">
              <button onClick={() => { setConfirming(false); setError(null) }}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 text-[13px] cursor-pointer hover:bg-slate-50 transition-colors disabled:opacity-50">
                Voltar
              </button>
              <button onClick={handleCancelar} disabled={cancelling}
                className="flex-[2] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white border-none text-[13px] font-bold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {cancelling && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {cancelling ? 'Cancelando...' : '✓ Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}