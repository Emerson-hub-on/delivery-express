'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ─── tipos locais ────────────────────────────────────────────────────────────

type CartItem = {
  id: number
  code: number
  name: string
  price: number
  image: string
  qty: number
  discount: number
}

type Consumer = {
  name: string
  cpf: string
}

type PDVProps = {
  companyId: string
  onError: (msg: string) => void
}

// ─── utilitários ─────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtCode = (c: number) => String(c).padStart(4, '0')

const LIMITE_IDENTIFICACAO = 500

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

// ─── hook de produtos ─────────────────────────────────────────────────────────

function useProducts(companyId: string, onError: (m: string) => void) {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) return
    setLoading(true)
    supabase
      .from('products')
      .select('id, code, name, price, image, category, ean, active, stock')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) { onError(error.message); return }
        setProducts(data ?? [])
        setLoading(false)
      })
  }, [companyId, onError])

  const getByCode = useCallback(
    async (code: string): Promise<any | null> => {
      const { data } = await supabase
        .from('products')
        .select('id, code, name, price, image, category, ean, active')
        .eq('company_id', companyId)
        .or(`code.eq.${Number(code)},ean.eq.${code}`)
        .eq('active', true)
        .limit(1)
        .single()
      return data ?? null
    },
    [companyId]
  )

  return { products, loading, getByCode }
}

// ─── componente principal ────────────────────────────────────────────────────

export function PDVTab({ companyId, onError }: PDVProps) {
  const { products, loading, getByCode } = useProducts(companyId, onError)

  const [cart, setCart] = useState<CartItem[]>([])
  const [qty, setQty] = useState(1)
  const [selectedProd, setSelectedProd] = useState<any | null>(null)
  const [selectedCartId, setSelectedCartId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [toast, setToast] = useState<{ msg: string; type?: 'ok' | 'err' } | null>(null)

  const [discModal, setDiscModal] = useState<'item' | 'total' | null>(null)
  const [discValue, setDiscValue] = useState('')

  const [finalModal, setFinalModal] = useState(false)
  const [payMethod, setPayMethod] = useState<'dinheiro' | 'pix' | 'cartao'>('dinheiro')
  const [change, setChange] = useState('')

  // ── Consumidor ──────────────────────────────────────────────────────────────
  const [consumer, setConsumer] = useState<Consumer | null>(null)
  const [consumerModal, setConsumerModal] = useState(false)
  const [consumerName, setConsumerName] = useState('')
  const [consumerCpf, setConsumerCpf] = useState('')
  const [consumerRequired, setConsumerRequired] = useState(false)

  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filtered = search
    ? products.filter(
        p =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          String(p.code).includes(search) ||
          (p.ean && p.ean.includes(search))
      )
    : products

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2800)
  }

  const addToCart = (product: any, q: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + q } : i)
      return [...prev, { id: product.id, code: product.code, name: product.name, price: product.price, image: product.image, qty: q, discount: 0 }]
    })
    showToast(`${product.name} adicionado`)
  }

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(i => i.id !== id))
    if (selectedCartId === id) setSelectedCartId(null)
  }

  const cartTotal = cart.reduce((s, i) => s + i.price * (1 - i.discount / 100) * i.qty, 0)
  const cartQty   = cart.reduce((s, i) => s + i.qty, 0)

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleDescItem = () => {
    if (!selectedCartId) { showToast('Selecione um item do cupom', 'err'); return }
    setDiscModal('item'); setDiscValue('')
  }

  const handleDescTotal = () => {
    if (cart.length === 0) { showToast('Cupom vazio', 'err'); return }
    setDiscModal('total'); setDiscValue('')
  }

  const applyDiscount = () => {
    const n = parseFloat(discValue.replace(',', '.'))
    if (isNaN(n) || n < 0 || n > 100) { showToast('Desconto inválido (0–100%)', 'err'); return }
    if (discModal === 'item' && selectedCartId) {
      setCart(prev => prev.map(i => i.id === selectedCartId ? { ...i, discount: n } : i))
      showToast(`Desconto de ${n}% aplicado no item`)
    } else if (discModal === 'total') {
      setCart(prev => prev.map(i => ({ ...i, discount: n })))
      showToast(`Desconto de ${n}% aplicado no cupom`)
    }
    setDiscModal(null)
  }

  const handleDesfazer      = () => { setCart(prev => prev.map(i => ({ ...i, discount: 0 }))); showToast('Descontos removidos') }
  const handleCancelarItem  = () => { if (!selectedCartId) { showToast('Selecione um item do cupom', 'err'); return }; removeFromCart(selectedCartId); showToast('Item removido') }
  const handleCancelarCupom = () => { if (cart.length === 0) return; setCart([]); setSelectedCartId(null); setConsumer(null); showToast('Cupom cancelado') }

  // ── F8 — Consumidor ─────────────────────────────────────────────────────────

  const openConsumerModal = (required = false) => {
    setConsumerName(consumer?.name ?? '')
    setConsumerCpf(consumer?.cpf ?? '')
    setConsumerRequired(required)
    setConsumerModal(true)
  }

  const saveConsumer = () => {
    const name = consumerName.trim()
    const cpf  = consumerCpf.trim()

    if (!name && !cpf) {
      if (consumerRequired) {
        showToast('Nome e CPF são obrigatórios', 'err')
        return
      }
      setConsumer(null)
      setConsumerModal(false)
      showToast('Consumidor removido')
      return
    }

    if (!name) { showToast('Informe pelo menos o nome', 'err'); return }
    if (consumerRequired && !cpf) { showToast('CPF é obrigatório para esta compra', 'err'); return }

    setConsumer({ name, cpf })
    setConsumerModal(false)

    if (consumerRequired) {
      setConsumerRequired(false)
      setFinalModal(true)
      setChange('')
    } else {
      showToast(`Consumidor: ${name}`)
    }
  }

  // ── Finalizar ───────────────────────────────────────────────────────────────

  const handleFinalizar = () => {
    if (cart.length === 0) { showToast('Adicione itens ao cupom', 'err'); return }

    if (cartTotal >= LIMITE_IDENTIFICACAO && (!consumer?.name || !consumer?.cpf)) {
      showToast(`Compras acima de ${fmt(LIMITE_IDENTIFICACAO)} exigem identificação`, 'err')
      openConsumerModal(true)
      return
    }

    setFinalModal(true)
    setChange('')
  }

  const confirmVenda = () => {
    showToast(`Venda finalizada — ${fmt(cartTotal)}`)
    setCart([])
    setSelectedCartId(null)
    setConsumer(null)
    setFinalModal(false)
  }

  const handleAddByCode = async () => {
    if (!codeInput.trim()) return
    const p = await getByCode(codeInput.trim())
    if (!p) { showToast('Produto não encontrado', 'err'); return }
    addToCart(p, qty); setCodeInput('')
  }

  const cupomNum = '000142'
  const now      = new Date()
  const dataHora = now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border border-[#1a3a5c] text-white relative"
      style={{ height: 'calc(100vh - 2rem)', background: '#0d1b2a' }}
    >
      {/* ── Barra F-keys ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a3a5c] shrink-0 overflow-x-auto" style={{ background: '#071220' }}>
        <div className="flex items-center gap-2 mr-auto">
          <span className="text-orange-400 text-sm font-semibold whitespace-nowrap">🚀 PDV</span>
        </div>
        {[
          { key: 'F1', label: 'Abertura',       fn: () => showToast('Abertura de caixa'),   danger: false, highlight: false },
          { key: 'F2', label: 'Fechamento',     fn: () => showToast('Fechamento de caixa'), danger: false, highlight: false },
          { key: 'F3', label: 'Desc. item',     fn: handleDescItem,                         danger: false, highlight: false },
          { key: 'F4', label: 'Desc. total',    fn: handleDescTotal,                        danger: false, highlight: false },
          { key: 'F5', label: 'Cancelar item',  fn: handleCancelarItem,                     danger: true,  highlight: false },
          { key: 'F6', label: 'Cancelar cupom', fn: handleCancelarCupom,                    danger: true,  highlight: false },
          { key: 'F7', label: 'Desfazer desc.', fn: handleDesfazer,                         danger: false, highlight: false },
          { key: 'F8', label: 'Consumidor',     fn: () => openConsumerModal(false),         danger: false, highlight: true  },
        ].map(({ key, label, fn, danger, highlight }) => (
          <button
            key={key}
            onClick={fn}
            className={`flex flex-col items-center min-w-14.5 px-2 py-1.5 rounded-lg border text-[10px] transition-colors relative
              ${danger
                ? 'border-red-900/60 hover:bg-red-950/60 text-red-400'
                : highlight
                  ? 'border-indigo-500/70 hover:bg-indigo-950/60 text-indigo-300'
                  : 'border-[#1a3a5c] hover:bg-[#1a3a5c] text-slate-400'}`}
          >
            <span className={`font-semibold ${danger ? 'text-red-400' : highlight ? 'text-indigo-300' : 'text-indigo-400'}`}>{key}</span>
            <span className="text-center leading-tight mt-0.5">{label}</span>
            {key === 'F8' && consumer && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: '#4ade80', border: '1.5px solid #071220' }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Grid principal ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── CUPOM (esquerda) ─────────────────────────────────────────── */}
        <div className="flex flex-col border-r border-[#1a3a5c] overflow-hidden" style={{ width: '55%', background: '#0d1b2a' }}>

          {/* Cabeçalho cupom */}
          <div className="shrink-0 px-4 py-3 border-b border-[#1a3a5c]" style={{ background: '#091521' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500 bg-[#0f1e2e] px-2 py-1 rounded border border-[#1a3a5c]">CUPOM #{cupomNum}</span>
                <span className="text-[10px] text-slate-600">{dataHora}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-green-500 font-medium">CAIXA ABERTO</span>
              </div>
            </div>

            {/* Faixa consumidor */}
            {consumer && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '6px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>👤</span>
                  <div>
                    <p style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600, lineHeight: 1.2 }}>{consumer.name}</p>
                    {consumer.cpf && <p style={{ fontSize: 10, color: '#64748b', lineHeight: 1.2 }}>CPF: {consumer.cpf}</p>}
                  </div>
                </div>
                <button onClick={() => openConsumerModal(false)} style={{ fontSize: 10, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  editar
                </button>
              </div>
            )}
          </div>

          {/* Colunas */}
          <div className="grid items-center px-4 py-2 border-b border-[#1a3a5c] text-[11px] text-slate-500 font-medium shrink-0" style={{ gridTemplateColumns: '2fr 3fr 1fr 1fr 1.5fr', background: '#071220' }}>
            <span>Código</span><span>Descrição</span>
            <span className="text-right">Preço</span>
            <span className="text-right">Qtd</span>
            <span className="text-right">Total</span>
          </div>

          {/* Itens */}
          <div className="flex-1 overflow-y-auto" style={{ background: '#0d1b2a', scrollbarWidth: 'thin', scrollbarColor: '#1a3a5c transparent' }}>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3" style={{ background: '#0d1b2a' }}>
                <div className="flex flex-col items-center gap-2 opacity-30">
                  <svg width="56" height="72" viewBox="0 0 56 72" fill="none">
                    <rect x="4" y="0" width="48" height="64" rx="3" fill="#1a3a5c" />
                    <path d="M4 64 L10 58 L16 64 L22 58 L28 64 L34 58 L40 64 L46 58 L52 64 V72 H4 V64Z" fill="#1a3a5c" />
                    <rect x="12" y="12" width="32" height="2" rx="1" fill="#2a5a8c" />
                    <rect x="12" y="18" width="24" height="2" rx="1" fill="#2a5a8c" />
                    <rect x="12" y="24" width="28" height="2" rx="1" fill="#2a5a8c" />
                    <rect x="12" y="36" width="20" height="2" rx="1" fill="#2a5a8c" />
                    <rect x="12" y="42" width="16" height="2" rx="1" fill="#2a5a8c" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-slate-600 text-sm font-medium">Nenhum item adicionado</p>
                  <p className="text-slate-700 text-[11px] mt-0.5">Selecione produtos ou use o código/EAN</p>
                </div>
              </div>
            ) : (
              <div style={{ background: '#0d1b2a' }}>
                {cart.map((item, idx) => {
                  const unitPrice = item.price * (1 - item.discount / 100)
                  const lineTotal = unitPrice * item.qty
                  const isSelected = selectedCartId === item.id
                  return (
                    <div key={item.id} onClick={() => setSelectedCartId(item.id)} className="cursor-pointer transition-colors"
                      style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1fr 1.5fr', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid rgba(26,58,92,0.5)', background: isSelected ? '#0f2a3e' : idx % 2 === 0 ? '#0d1b2a' : '#0c1825' }}>
                      <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{fmtCode(item.code)}</span>
                      <span style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                        {item.name}
                        {item.discount > 0 && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(194,65,12,0.2)', color: '#fb923c', padding: '2px 6px', borderRadius: 4 }}>-{item.discount}%</span>}
                      </span>
                      <span style={{ textAlign: 'right', fontSize: 12, color: '#94a3b8' }}>{fmt(unitPrice)}</span>
                      <span style={{ textAlign: 'right', fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{item.qty}</span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <span style={{ color: '#fb923c', fontWeight: 600, fontSize: 13 }}>{fmt(lineTotal)}</span>
                        <button onClick={e => { e.stopPropagation(); removeFromCart(item.id) }}
                          style={{ color: '#475569', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 3 }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>✕</button>
                      </div>
                    </div>
                  )
                })}
                {cart.some(i => i.discount > 0) && (
                  <div style={{ padding: '8px 16px', background: '#091521', borderBottom: '1px solid rgba(26,58,92,0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Descontos aplicados</span>
                    <span style={{ fontSize: 12, color: '#4ade80' }}>- {fmt(cart.reduce((s, i) => s + (i.price * i.qty) - (i.price * (1 - i.discount / 100) * i.qty), 0))}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Aviso obrigatoriedade */}
          {cartTotal >= LIMITE_IDENTIFICACAO && !consumer && (
            <div style={{ padding: '8px 16px', background: 'rgba(234,179,8,0.07)', borderTop: '1px solid rgba(234,179,8,0.2)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <span style={{ fontSize: 11, color: '#fbbf24' }}>
                Compra acima de {fmt(LIMITE_IDENTIFICACAO)} — identificação do consumidor obrigatória (F8)
              </span>
            </div>
          )}

          {/* Rodapé */}
          <div className="shrink-0 border-t border-[#1a3a5c]" style={{ background: '#071220' }}>
            {cart.length > 0 && (
              <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(26,58,92,0.3)', display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#475569' }}>Itens:</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{cartQty}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#475569' }}>Produtos:</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{cart.length}</span>
                </div>
              </div>
            )}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>Valor total</p>
                <p style={{ fontSize: 28, fontWeight: 700, color: '#fb923c', lineHeight: 1 }}>{fmt(cartTotal)}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#64748b', background: '#1a3a5c', padding: '4px 12px', borderRadius: 6 }}>
                  {cartQty} {cartQty === 1 ? 'item' : 'itens'}
                </span>
                <button onClick={handleFinalizar}
                  style={{ background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#22c55e')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#16a34a')}>
                  ✓ Finalizar venda
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── PRODUTOS (direita) ────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ background: '#091521' }}>
          <div style={{ padding: '12px 12px 8px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 14 }}>🔍</span>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou código..."
                style={{ width: '100%', background: '#0f1e2e', border: '1px solid #1a3a5c', borderRadius: 8, padding: '8px 16px 8px 36px', fontSize: 13, color: '#e2e8f0', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center" style={{ color: '#475569', fontSize: 13 }}>
              <div style={{ width: 20, height: 20, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 8 }} />
              Carregando produtos...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex items-center justify-center" style={{ color: '#374151', fontSize: 13 }}>Nenhum produto encontrado</div>
          ) : (
            <div className="flex-1 overflow-y-auto" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12, alignContent: 'start', scrollbarWidth: 'thin', scrollbarColor: '#1a3a5c transparent' }}>
              {filtered.map(p => {
                const isSelected = selectedProd?.id === p.id
                return (
                  <button key={p.id} onClick={() => setSelectedProd(p)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 10, border: isSelected ? '1px solid #6366f1' : '1px solid #1a3a5c', background: isSelected ? '#0f2240' : '#0f1e2e', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    {p.image
                      ? <img src={p.image} alt={p.name} style={{ width: '100%', height: 56, objectFit: 'cover', borderRadius: 6 }} onError={(e: any) => { e.target.style.display = 'none' }} />
                      : <div style={{ width: '100%', height: 56, borderRadius: 6, background: '#0d1b2a', border: '1px dashed #1a3a5c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#334155' }}>Sem Foto</div>
                    }
                    <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#fb923c', fontSize: 13, fontWeight: 700 }}>{fmt(p.price)}</span>
                      <span style={{ fontSize: 10, color: '#334155' }}>#{fmtCode(p.code)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="shrink-0 border-t border-[#1a3a5c] p-3 flex flex-col gap-2" style={{ background: '#071220' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#475569', width: 80, flexShrink: 0 }}>Quantidade</span>
              <div style={{ display: 'flex', alignItems: 'center', background: '#0f1e2e', border: '1px solid #1a3a5c', borderRadius: 8, overflow: 'hidden', flex: 1 }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ padding: '6px 14px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>−</button>
                <span style={{ flex: 1, textAlign: 'center', color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>{qty}</span>
                <button onClick={() => setQty(q => q + 1)} style={{ padding: '6px 14px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>+</button>
              </div>
              <button onClick={() => selectedProd ? addToCart(selectedProd, qty) : showToast('Selecione um produto', 'err')}
                style={{ background: '#f97316', color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                + Adicionar
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="text" value={codeInput} onChange={e => setCodeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddByCode()}
                placeholder="Código / EAN…" style={{ flex: 1, background: '#0f1e2e', border: '1px solid #1a3a5c', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#e2e8f0', outline: 'none' }} />
              <button onClick={handleAddByCode} style={{ fontSize: 11, color: '#94a3b8', background: '#0f1e2e', border: '1px solid #1a3a5c', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>Buscar</button>
              <button onClick={() => showToast('NFC-e requer configuração fiscal')} style={{ fontSize: 11, color: '#60a5fa', background: '#0a1520', border: '1px solid #1a3a5c', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>🧾 NFC-e</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 50, padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 500, background: toast.type === 'err' ? '#dc2626' : '#f97316', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}

      {/* ── Modal desconto ────────────────────────────────────────────────── */}
      {discModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#0d1b2a', border: '1px solid #1a3a5c', borderRadius: 16, padding: 24, width: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{discModal === 'item' ? 'Desconto no item' : 'Desconto no cupom'}</h2>
            <div style={{ position: 'relative' }}>
              <input autoFocus type="text" inputMode="decimal" value={discValue} onChange={e => setDiscValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyDiscount()} placeholder="Ex: 10"
                style={{ width: '100%', background: '#0f1e2e', border: '1px solid #1a3a5c', borderRadius: 8, padding: '10px 36px 10px 12px', color: '#e2e8f0', outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }}>%</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDiscModal(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #1a3a5c', color: '#94a3b8', background: 'none', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={applyDiscount} style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: '#f97316', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal F8 — Consumidor ─────────────────────────────────────────── */}
      {consumerModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#0d1b2a', border: `1px solid ${consumerRequired ? 'rgba(234,179,8,0.45)' : '#1a3a5c'}`, borderRadius: 16, padding: 24, width: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Header */}
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>👤 Identificação do Consumidor</h2>
              {consumerRequired
                ? <p style={{ fontSize: 11, color: '#fbbf24' }}>⚠️ Obrigatório para compras acima de {fmt(LIMITE_IDENTIFICACAO)}</p>
                : <p style={{ fontSize: 11, color: '#475569' }}>Deixe em branco para venda sem identificação</p>
              }
            </div>

            {/* Aviso de obrigatoriedade */}
            {consumerRequired && (
              <div style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16, lineHeight: 1.2 }}>⚠️</span>
                <p style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.5 }}>
                  O cupom totaliza <strong>{fmt(cartTotal)}</strong>. Nome e CPF são exigidos pela legislação para valores acima de {fmt(LIMITE_IDENTIFICACAO)}.
                </p>
              </div>
            )}

            {/* Nome */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                Nome {consumerRequired && <span style={{ color: '#f87171' }}>*</span>}
              </label>
              <input
                autoFocus
                type="text"
                value={consumerName}
                onChange={e => setConsumerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveConsumer()}
                placeholder="Nome completo do consumidor"
                style={{ background: '#0f1e2e', border: '1px solid #1a3a5c', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#e2e8f0', outline: 'none', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {/* CPF */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                CPF {consumerRequired && <span style={{ color: '#f87171' }}>*</span>}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={consumerCpf}
                onChange={e => setConsumerCpf(maskCpf(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && saveConsumer()}
                placeholder="000.000.000-00"
                style={{ background: '#0f1e2e', border: '1px solid #1a3a5c', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#e2e8f0', outline: 'none', width: '100%', boxSizing: 'border-box', letterSpacing: '0.04em' }}
              />
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: 8 }}>
              {!consumerRequired && (
                <button onClick={() => setConsumerModal(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #1a3a5c', color: '#94a3b8', background: 'none', cursor: 'pointer', fontSize: 13 }}>
                  Cancelar
                </button>
              )}
              <button onClick={saveConsumer} style={{ flex: 2, padding: '10px 0', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {consumerRequired ? '✓ Salvar e finalizar' : 'Confirmar'}
              </button>
            </div>

            {/* Remover */}
            {consumer && !consumerRequired && (
              <button onClick={() => { setConsumer(null); setConsumerModal(false); showToast('Consumidor removido') }}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', textAlign: 'center', textDecoration: 'underline' }}>
                Remover identificação do cupom
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Modal finalizar venda ─────────────────────────────────────────── */}
      {finalModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#0d1b2a', border: '1px solid #1a3a5c', borderRadius: 16, padding: 24, width: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>Finalizar venda</h2>

            <div style={{ background: '#071220', borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: 13 }}>Total</span>
              <span style={{ color: '#fb923c', fontSize: 22, fontWeight: 700 }}>{fmt(cartTotal)}</span>
            </div>

            {consumer && (
              <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>👤</span>
                <div>
                  <p style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600 }}>{consumer.name}</p>
                  {consumer.cpf && <p style={{ fontSize: 10, color: '#64748b' }}>CPF: {consumer.cpf}</p>}
                </div>
              </div>
            )}

            <div>
              <p style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>Forma de pagamento</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {(['dinheiro', 'pix', 'cartao'] as const).map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    style={{ padding: '10px 0', borderRadius: 8, border: payMethod === m ? '1px solid #6366f1' : '1px solid #1a3a5c', background: payMethod === m ? 'rgba(99,102,241,0.12)' : 'none', color: payMethod === m ? '#a5b4fc' : '#64748b', cursor: 'pointer', fontSize: 13 }}>
                    {m === 'dinheiro' ? '💵 Dinheiro' : m === 'pix' ? '⚡ Pix' : '💳 Cartão'}
                  </button>
                ))}
              </div>
            </div>

            {payMethod === 'dinheiro' && (
              <div>
                <p style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>Valor recebido (para troco)</p>
                <input type="text" inputMode="decimal" value={change} onChange={e => setChange(e.target.value)} placeholder="0,00"
                  style={{ width: '100%', background: '#0f1e2e', border: '1px solid #1a3a5c', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
                {change && !isNaN(parseFloat(change.replace(',', '.'))) && (
                  <p style={{ fontSize: 12, color: '#4ade80', marginTop: 6 }}>Troco: {fmt(Math.max(0, parseFloat(change.replace(',', '.')) - cartTotal))}</p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button onClick={() => setFinalModal(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #1a3a5c', color: '#94a3b8', background: 'none', cursor: 'pointer', fontSize: 13 }}>Voltar</button>
              <button onClick={confirmVenda} style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>✓ Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}