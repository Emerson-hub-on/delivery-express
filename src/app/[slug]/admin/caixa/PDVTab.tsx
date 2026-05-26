'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { createPdvSale } from '@/services/pdv'
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
  cashRegisterId: string
  serie: string
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

// ─── estilos base ─────────────────────────────────────────────────────────────

const css = {
  // superfícies
  bg:        '#f8f9fb',
  surface:   '#ffffff',
  surfaceAlt:'#f1f3f7',
  border:    '#e2e6ed',
  borderMid: '#d0d5de',

  // texto
  txtPrimary:   '#1a1f2e',
  txtSecondary: '#5a6272',
  txtMuted:     '#9aa0ae',

  // marca / destaque
  accent:    '#f97316',
  accentBg:  'rgba(249,115,22,0.08)',
  green:     '#16a34a',
  greenBg:   'rgba(22,163,74,0.08)',
  red:       '#dc2626',
  redBg:     'rgba(220,38,38,0.08)',
  indigo:    '#6366f1',
  indigoBg:  'rgba(99,102,241,0.08)',
  yellow:    '#d97706',
  yellowBg:  'rgba(217,119,6,0.08)',
} as const

// ─── componente principal ────────────────────────────────────────────────────

export function PDVTab({ companyId, cashRegisterId, serie, onError }: PDVProps) {
  const { products, loading, getByCode } = useProducts(companyId, onError)

  // ── ALTERAÇÃO 1: estados e busca do operador ──────────────────────────────
  const [operatorId,   setOperatorId]   = useState<string | undefined>()
  const [operatorName, setOperatorName] = useState<string | undefined>()

  useEffect(() => {
    if (!companyId) return
    supabase
      .from('operators')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setOperatorId(data.id)
        setOperatorName(data.name)
      })
  }, [companyId])
  // ─────────────────────────────────────────────────────────────────────────

  const [cart, setCart]                     = useState<CartItem[]>([])
  const [qty, setQty]                       = useState(1)
  const [selectedProd, setSelectedProd]     = useState<any | null>(null)
  const [selectedCartId, setSelectedCartId] = useState<number | null>(null)
  const [search, setSearch]                 = useState('')
  const [codeInput, setCodeInput]           = useState('')
  const [toast, setToast]                   = useState<{ msg: string; type?: 'ok' | 'err' } | null>(null)

  const [discModal, setDiscModal]   = useState<'item' | 'total' | null>(null)
  const [discValue, setDiscValue]   = useState('')

  const [finalModal, setFinalModal] = useState(false)
  const [payMethod, setPayMethod]   = useState<'dinheiro' | 'pix' | 'cartao'>('dinheiro')
  const [change, setChange]         = useState('')

  const [consumer, setConsumer]               = useState<Consumer | null>(null)
  const [consumerModal, setConsumerModal]     = useState(false)
  const [consumerName, setConsumerName]       = useState('')
  const [consumerCpf, setConsumerCpf]         = useState('')
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

  const handleDescItem  = () => { if (!selectedCartId) { showToast('Selecione um item do cupom', 'err'); return }; setDiscModal('item'); setDiscValue('') }
  const handleDescTotal = () => { if (cart.length === 0) { showToast('Cupom vazio', 'err'); return }; setDiscModal('total'); setDiscValue('') }

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
      if (consumerRequired) { showToast('Nome e CPF são obrigatórios', 'err'); return }
      setConsumer(null); setConsumerModal(false); showToast('Consumidor removido'); return
    }
    if (!name) { showToast('Informe pelo menos o nome', 'err'); return }
    if (consumerRequired && !cpf) { showToast('CPF é obrigatório para esta compra', 'err'); return }
    setConsumer({ name, cpf }); setConsumerModal(false)
    if (consumerRequired) { setConsumerRequired(false); setFinalModal(true); setChange('') }
    else showToast(`Consumidor: ${name}`)
  }

  const handleFinalizar = () => {
    if (cart.length === 0) { showToast('Adicione itens ao cupom', 'err'); return }
    if (cartTotal >= LIMITE_IDENTIFICACAO && (!consumer?.name || !consumer?.cpf)) {
      showToast(`Compras acima de ${fmt(LIMITE_IDENTIFICACAO)} exigem identificação`, 'err')
      openConsumerModal(true); return
    }
    setFinalModal(true); setChange('')
  }

  // ── ALTERAÇÃO 2: operatorId e operatorName passados ao createPdvSale ──────
  const confirmVenda = async () => {
    try {
      console.log('🛒 Iniciando venda...', { companyId, cashRegisterId, serie, cart })

      const result = await createPdvSale({
        companyId,
        cashRegisterId,
        serie,
        operatorId,    // ← adicionado
        operatorName,  // ← adicionado
        items: cart.map(i => ({
          product_id:   i.id,
          product_name: i.name,
          quantity:     i.qty,
          unit_price:   i.price,
          discount:     i.discount,
        })),
        paymentMethod:   payMethod,
        amountReceived:  payMethod === 'dinheiro' && change
                           ? parseFloat(change.replace(',', '.'))
                           : undefined,
        changeAmount:    payMethod === 'dinheiro' && change
                           ? Math.max(0, parseFloat(change.replace(',', '.')) - cartTotal)
                           : undefined,
        consumerName:    consumer?.name,
        consumerCpf:     consumer?.cpf?.replace(/\D/g, ''),
      })
      // ────────────────────────────────────────────────────────────────────

      console.log('✅ Venda criada:', result)
      showToast(`Venda finalizada — ${fmt(cartTotal)}`)
      setCart([])
      setSelectedCartId(null)
      setConsumer(null)
      setFinalModal(false)
    } catch (e: any) {
      console.error('❌ Erro na venda:', e)
      showToast(e.message, 'err')
      onError(e.message)
      setFinalModal(false)
    }
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

  // ── Botões F-key ─────────────────────────────────────────────────────────────
  const fkeys = [
    { key: 'F1', label: 'Abertura',       fn: () => showToast('Abertura de caixa'),   danger: false, highlight: false },
    { key: 'F2', label: 'Fechamento',     fn: () => showToast('Fechamento de caixa'), danger: false, highlight: false },
    { key: 'F3', label: 'Desc. item',     fn: handleDescItem,                         danger: false, highlight: false },
    { key: 'F4', label: 'Desc. total',    fn: handleDescTotal,                        danger: false, highlight: false },
    { key: 'F5', label: 'Cancelar item',  fn: handleCancelarItem,                     danger: true,  highlight: false },
    { key: 'F6', label: 'Cancelar cupom', fn: handleCancelarCupom,                    danger: true,  highlight: false },
    { key: 'F7', label: 'Desfazer desc.', fn: handleDesfazer,                         danger: false, highlight: false },
    { key: 'F8', label: 'Consumidor',     fn: () => openConsumerModal(false),         danger: false, highlight: true  },
  ]

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRadius: 12, border: `1px solid ${css.border}`,
        background: css.bg, height: 'calc(100vh - 2rem)',
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: css.txtPrimary, position: 'relative',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* ── Barra F-keys ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
        borderBottom: `1px solid ${css.border}`, flexShrink: 0, overflowX: 'auto',
        background: css.surface,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginRight: 12 }}>
          <span style={{ fontSize: 18 }}>🚀</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: css.txtPrimary, letterSpacing: '-0.3px' }}>PDV</span>
        </div>

        {fkeys.map(({ key, label, fn, danger, highlight }) => (
          <button
            key={key}
            onClick={fn}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              minWidth: 62, padding: '6px 8px', borderRadius: 8,
              border: `1.5px solid ${danger ? '#fecaca' : highlight ? '#c7d2fe' : css.border}`,
              background: danger ? '#fff5f5' : highlight ? '#eef2ff' : css.surface,
              cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
              userSelect: 'none',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = danger ? '#fee2e2' : highlight ? '#e0e7ff' : css.surfaceAlt
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = danger ? '#fff5f5' : highlight ? '#eef2ff' : css.surface
            }}
          >
            <span style={{
              fontWeight: 700, fontSize: 10, letterSpacing: '0.5px',
              color: danger ? css.red : highlight ? css.indigo : css.indigo,
              marginBottom: 2,
            }}>{key}</span>
            <span style={{
              fontSize: 10, color: danger ? '#b91c1c' : highlight ? '#4338ca' : css.txtSecondary,
              textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap',
            }}>{label}</span>
            {key === 'F8' && consumer && (
              <span style={{
                position: 'absolute', top: -3, right: -3, width: 8, height: 8,
                borderRadius: '50%', background: css.green, border: `2px solid ${css.surface}`,
              }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Grid principal ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── CUPOM (esquerda) ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', width: '55%',
          borderRight: `1px solid ${css.border}`, overflow: 'hidden',
          background: css.surface,
        }}>
          {/* Cabeçalho cupom */}
          <div style={{
            flexShrink: 0, padding: '10px 16px 10px',
            borderBottom: `1px solid ${css.border}`,
            background: css.surface,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, fontFamily: 'monospace', color: css.txtSecondary,
                  background: css.surfaceAlt, padding: '3px 8px', borderRadius: 6,
                  border: `1px solid ${css.border}`, fontWeight: 600,
                }}>CUPOM #{cupomNum}</span>
                <span style={{ fontSize: 11, color: css.txtMuted }}>{dataHora}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: css.green }} />
                <span style={{ fontSize: 11, color: css.green, fontWeight: 600 }}>CAIXA ABERTO</span>
              </div>
            </div>

            {/* Faixa consumidor */}
            {consumer && (
              <div style={{
                marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: css.indigoBg, border: `1px solid #c7d2fe`, borderRadius: 8, padding: '7px 10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>👤</span>
                  <div>
                    <p style={{ fontSize: 12, color: css.indigo, fontWeight: 600, lineHeight: 1.3 }}>{consumer.name}</p>
                    {consumer.cpf && <p style={{ fontSize: 10, color: css.txtMuted, lineHeight: 1.3 }}>CPF: {consumer.cpf}</p>}
                  </div>
                </div>
                <button onClick={() => openConsumerModal(false)} style={{ fontSize: 11, color: css.indigo, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  editar
                </button>
              </div>
            )}
          </div>

          {/* Colunas */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1fr 1.5fr',
            alignItems: 'center', padding: '7px 16px',
            borderBottom: `1px solid ${css.border}`,
            background: css.surfaceAlt, flexShrink: 0,
          }}>
            {['Código', 'Descrição', 'Preço', 'Qtd', 'Total'].map((h, i) => (
              <span key={h} style={{ fontSize: 11, color: css.txtMuted, fontWeight: 600, textAlign: i >= 2 ? 'right' : 'left', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
            ))}
          </div>

          {/* Itens */}
          <div style={{ flex: 1, overflowY: 'auto', background: css.surface, scrollbarWidth: 'thin', scrollbarColor: `${css.border} transparent` }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, background: css.surface }}>
                <div style={{ opacity: 0.25 }}>
                  <svg width="48" height="60" viewBox="0 0 56 72" fill="none">
                    <rect x="4" y="0" width="48" height="64" rx="3" fill={css.border} />
                    <rect x="12" y="12" width="32" height="2" rx="1" fill={css.borderMid} />
                    <rect x="12" y="18" width="24" height="2" rx="1" fill={css.borderMid} />
                    <rect x="12" y="24" width="28" height="2" rx="1" fill={css.borderMid} />
                    <rect x="12" y="36" width="20" height="2" rx="1" fill={css.borderMid} />
                    <rect x="12" y="42" width="16" height="2" rx="1" fill={css.borderMid} />
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: css.txtSecondary, fontWeight: 500, marginBottom: 4 }}>Nenhum item adicionado</p>
                  <p style={{ fontSize: 12, color: css.txtMuted }}>Selecione produtos ou use o código/EAN</p>
                </div>
              </div>
            ) : (
              <div>
                {cart.map((item, idx) => {
                  const unitPrice = item.price * (1 - item.discount / 100)
                  const lineTotal = unitPrice * item.qty
                  const isSelected = selectedCartId === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedCartId(item.id)}
                      style={{
                        display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1fr 1.5fr',
                        alignItems: 'center', padding: '10px 16px',
                        borderBottom: `1px solid ${css.border}`,
                        background: isSelected ? '#eff6ff' : idx % 2 === 0 ? css.surface : css.bg,
                        cursor: 'pointer', transition: 'background 0.12s',
                        borderLeft: isSelected ? `3px solid ${css.indigo}` : '3px solid transparent',
                      }}
                    >
                      <span style={{ fontSize: 11, color: css.txtMuted, fontFamily: 'monospace' }}>{fmtCode(item.code)}</span>
                      <span style={{ fontSize: 13, color: css.txtPrimary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                        {item.name}
                        {item.discount > 0 && (
                          <span style={{ marginLeft: 6, fontSize: 10, background: css.accentBg, color: css.accent, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                            -{item.discount}%
                          </span>
                        )}
                      </span>
                      <span style={{ textAlign: 'right', fontSize: 12, color: css.txtSecondary }}>{fmt(unitPrice)}</span>
                      <span style={{ textAlign: 'right', fontSize: 13, color: css.txtPrimary, fontWeight: 600 }}>{item.qty}</span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <span style={{ color: css.accent, fontWeight: 700, fontSize: 13 }}>{fmt(lineTotal)}</span>
                        <button
                          onClick={e => { e.stopPropagation(); removeFromCart(item.id) }}
                          style={{ color: css.txtMuted, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
                          onMouseEnter={e => (e.currentTarget.style.color = css.red)}
                          onMouseLeave={e => (e.currentTarget.style.color = css.txtMuted)}
                        >✕</button>
                      </div>
                    </div>
                  )
                })}
                {cart.some(i => i.discount > 0) && (
                  <div style={{
                    padding: '8px 16px', background: css.greenBg,
                    borderBottom: `1px solid ${css.border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 11, color: css.txtSecondary }}>Total de descontos</span>
                    <span style={{ fontSize: 12, color: css.green, fontWeight: 600 }}>
                      - {fmt(cart.reduce((s, i) => s + (i.price * i.qty) - (i.price * (1 - i.discount / 100) * i.qty), 0))}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Aviso obrigatoriedade */}
          {cartTotal >= LIMITE_IDENTIFICACAO && !consumer && (
            <div style={{
              padding: '8px 16px', background: css.yellowBg,
              borderTop: `1px solid #fde68a`,
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            }}>
              <span style={{ fontSize: 13 }}>⚠️</span>
              <span style={{ fontSize: 11, color: css.yellow, fontWeight: 500 }}>
                Compra acima de {fmt(LIMITE_IDENTIFICACAO)} — identificação obrigatória (F8)
              </span>
            </div>
          )}

          {/* Rodapé */}
          <div style={{ flexShrink: 0, borderTop: `1px solid ${css.border}`, background: css.surface }}>
            {cart.length > 0 && (
              <div style={{
                padding: '7px 16px', borderBottom: `1px solid ${css.border}`,
                display: 'flex', gap: 16,
              }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: css.txtMuted }}>Itens:</span>
                  <span style={{ fontSize: 12, color: css.txtSecondary, fontWeight: 600 }}>{cartQty}</span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: css.txtMuted }}>Produtos:</span>
                  <span style={{ fontSize: 12, color: css.txtSecondary, fontWeight: 600 }}>{cart.length}</span>
                </div>
              </div>
            )}
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 11, color: css.txtMuted, marginBottom: 3 }}>Valor total</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: css.accent, lineHeight: 1, letterSpacing: '-0.5px' }}>{fmt(cartTotal)}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span style={{
                  fontSize: 11, color: css.txtSecondary, fontWeight: 600,
                  background: css.surfaceAlt, border: `1px solid ${css.border}`,
                  padding: '3px 10px', borderRadius: 20,
                }}>
                  {cartQty} {cartQty === 1 ? 'item' : 'itens'}
                </span>
                <button
                  onClick={handleFinalizar}
                  style={{
                    background: css.green, color: '#fff', fontSize: 13, fontWeight: 700,
                    padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(22,163,74,0.25)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#15803d'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(22,163,74,0.35)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = css.green; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(22,163,74,0.25)' }}
                >
                  ✓ Finalizar venda
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── PRODUTOS (direita) ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: css.bg }}>
          {/* Busca */}
          <div style={{ padding: '12px 12px 8px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: css.txtMuted, fontSize: 14, pointerEvents: 'none' }}>🔍</span>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome ou código..."
                style={{
                  width: '100%', background: css.surface, border: `1.5px solid ${css.border}`,
                  borderRadius: 8, padding: '8px 14px 8px 34px', fontSize: 13,
                  color: css.txtPrimary, outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = css.indigo)}
                onBlur={e => (e.target.style.borderColor = css.border)}
              />
            </div>
          </div>

{/* Grade → Tabela de produtos */}
{loading ? (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: css.txtMuted, fontSize: 13, gap: 8 }}>
    <div style={{ width: 18, height: 18, border: `2px solid ${css.indigo}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    Carregando produtos...
  </div>
) : filtered.length === 0 ? (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: css.txtMuted, fontSize: 13 }}>
    Nenhum produto encontrado
  </div>
) : (
  <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: `${css.border} transparent` }}>
    {/* Cabeçalho fixo */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: '80px 60px 48px 1fr 56px 72px',
      padding: '6px 12px',
      borderBottom: `1.5px solid ${css.border}`,
      background: css.surfaceAlt,
      position: 'sticky', top: 0, zIndex: 1,
    }}>
      {['EAN', 'Código', '', 'Descrição', 'Estoque', 'Preço'].map((h, i) => (
        <span key={i} style={{
          fontSize: 10, color: css.txtMuted, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.4px',
          textAlign: i >= 4 ? 'right' : 'left',
        }}>{h}</span>
      ))}
    </div>

    {/* Linhas */}
    {filtered.map((p, idx) => {
      const isSelected = selectedProd?.id === p.id
      const stockLabel = p.stock == null ? '∞' : p.stock <= 0 ? '0' : String(p.stock)
      const stockColor = p.stock == null ? css.txtMuted : p.stock <= 0 ? css.red : p.stock <= 5 ? css.yellow : css.green

      return (
        <div
          key={p.id}
          onClick={() => setSelectedProd(p)}
          style={{
            display: 'grid',
            gridTemplateColumns: '80px 60px 48px 1fr 56px 72px',
            alignItems: 'center',
            padding: '7px 12px',
            borderBottom: `1px solid ${css.border}`,
            background: isSelected ? css.indigoBg : idx % 2 === 0 ? css.surface : css.bg,
            borderLeft: isSelected ? `3px solid ${css.indigo}` : '3px solid transparent',
            cursor: 'pointer',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = css.surfaceAlt }}
          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? css.surface : css.bg }}
        >
          {/* EAN */}
          <span style={{ fontSize: 10, color: css.txtMuted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.ean || '—'}
          </span>

          {/* Código */}
          <span style={{ fontSize: 10, color: css.txtMuted, fontFamily: 'monospace' }}>
            #{fmtCode(p.code)}
          </span>

          {/* Imagem */}
          {p.image
            ? <img src={p.image} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, display: 'block' }}
                onError={(e: any) => { e.target.style.display = 'none' }} />
            : <div style={{ width: 36, height: 36, borderRadius: 6, background: css.surfaceAlt, border: `1px dashed ${css.borderMid}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: css.txtMuted }}>
                S/F
              </div>
          }

          {/* Descrição */}
          <span style={{ fontSize: 12, color: isSelected ? css.indigo : css.txtPrimary, fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 6, paddingRight: 8 }}>
            {p.name}
          </span>

          {/* Estoque */}
          <span style={{ fontSize: 11, color: stockColor, fontWeight: 600, textAlign: 'right' }}>
            {stockLabel}
          </span>

          {/* Preço */}
          <span style={{ fontSize: 12, color: css.accent, fontWeight: 700, textAlign: 'right' }}>
            {fmt(p.price)}
          </span>
        </div>
      )
    })}
  </div>
)}

          {/* Barra inferior: Qtd + Adicionar + Código */}
          <div style={{
            flexShrink: 0, borderTop: `1px solid ${css.border}`,
            padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
            background: css.surface,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: css.txtSecondary, width: 76, flexShrink: 0, fontWeight: 500 }}>Quantidade</span>
              <div style={{
                display: 'flex', alignItems: 'center', background: css.bg,
                border: `1.5px solid ${css.border}`, borderRadius: 8, overflow: 'hidden', flex: 1,
              }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ padding: '6px 14px', color: css.txtSecondary, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>−</button>
                <span style={{ flex: 1, textAlign: 'center', color: css.txtPrimary, fontWeight: 700, fontSize: 14 }}>{qty}</span>
                <button onClick={() => setQty(q => q + 1)} style={{ padding: '6px 14px', color: css.txtSecondary, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>+</button>
              </div>
              <button
                onClick={() => selectedProd ? addToCart(selectedProd, qty) : showToast('Selecione um produto', 'err')}
                style={{
                  background: css.accent, color: '#fff', fontSize: 12, fontWeight: 700,
                  padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(249,115,22,0.3)', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#ea6c10' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = css.accent }}
              >
                + Adicionar
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text" value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddByCode()}
                placeholder="Código / EAN…"
                style={{
                  flex: 1, background: css.bg, border: `1.5px solid ${css.border}`,
                  borderRadius: 8, padding: '7px 12px', fontSize: 12,
                  color: css.txtPrimary, outline: 'none',
                }}
                onFocus={e => (e.target.style.borderColor = css.indigo)}
                onBlur={e => (e.target.style.borderColor = css.border)}
              />
              <button
                onClick={handleAddByCode}
                style={{ fontSize: 12, color: css.txtSecondary, background: css.surfaceAlt, border: `1.5px solid ${css.border}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 500 }}
              >Buscar</button>
              <button
                onClick={() => showToast('NFC-e requer configuração fiscal')}
                style={{ fontSize: 12, color: css.indigo, background: css.indigoBg, border: `1.5px solid #c7d2fe`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
              >🧾 NFC-e</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.type === 'err' ? css.red : css.green, color: '#fff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Modal desconto ─────────────────────────────────────────────────── */}
      {discModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: css.surface, border: `1px solid ${css.border}`, borderRadius: 16, padding: 24, width: 320, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: css.txtPrimary }}>{discModal === 'item' ? 'Desconto no item' : 'Desconto no cupom'}</h2>
            <div style={{ position: 'relative' }}>
              <input
                autoFocus type="text" inputMode="decimal"
                value={discValue} onChange={e => setDiscValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyDiscount()}
                placeholder="Ex: 10"
                style={{ width: '100%', background: css.bg, border: `1.5px solid ${css.border}`, borderRadius: 8, padding: '10px 36px 10px 12px', color: css.txtPrimary, outline: 'none', fontSize: 15, boxSizing: 'border-box' }}
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: css.txtMuted, fontWeight: 600 }}>%</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDiscModal(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${css.border}`, color: css.txtSecondary, background: css.surface, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Cancelar</button>
              <button onClick={applyDiscount} style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: css.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Consumidor ───────────────────────────────────────────────── */}
      {consumerModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: css.surface, border: `1.5px solid ${consumerRequired ? '#fde68a' : css.border}`, borderRadius: 16, padding: 24, width: 360, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: css.txtPrimary, marginBottom: 4 }}>👤 Identificação do Consumidor</h2>
              <p style={{ fontSize: 11, color: consumerRequired ? css.yellow : css.txtMuted }}>
                {consumerRequired ? `⚠️ Obrigatório para compras acima de ${fmt(LIMITE_IDENTIFICACAO)}` : 'Deixe em branco para venda sem identificação'}
              </p>
            </div>
            {consumerRequired && (
              <div style={{ background: css.yellowBg, border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <p style={{ fontSize: 12, color: css.yellow, lineHeight: 1.5 }}>
                  Cupom totaliza <strong>{fmt(cartTotal)}</strong>. Nome e CPF são exigidos para valores acima de {fmt(LIMITE_IDENTIFICACAO)}.
                </p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: css.txtSecondary, fontWeight: 600 }}>Nome {consumerRequired && <span style={{ color: css.red }}>*</span>}</label>
              <input autoFocus type="text" value={consumerName} onChange={e => setConsumerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveConsumer()} placeholder="Nome completo"
                style={{ background: css.bg, border: `1.5px solid ${css.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: css.txtPrimary, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: css.txtSecondary, fontWeight: 600 }}>CPF {consumerRequired && <span style={{ color: css.red }}>*</span>}</label>
              <input type="text" inputMode="numeric" value={consumerCpf} onChange={e => setConsumerCpf(maskCpf(e.target.value))} onKeyDown={e => e.key === 'Enter' && saveConsumer()} placeholder="000.000.000-00"
                style={{ background: css.bg, border: `1.5px solid ${css.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: css.txtPrimary, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!consumerRequired && (
                <button onClick={() => setConsumerModal(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${css.border}`, color: css.txtSecondary, background: css.surface, cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              )}
              <button onClick={saveConsumer} style={{ flex: 2, padding: '10px 0', borderRadius: 8, background: css.indigo, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                {consumerRequired ? '✓ Salvar e finalizar' : 'Confirmar'}
              </button>
            </div>
            {consumer && !consumerRequired && (
              <button onClick={() => { setConsumer(null); setConsumerModal(false); showToast('Consumidor removido') }}
                style={{ background: 'none', border: 'none', color: css.red, fontSize: 11, cursor: 'pointer', textAlign: 'center', textDecoration: 'underline' }}>
                Remover identificação do cupom
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Finalizar venda ──────────────────────────────────────────── */}
      {finalModal && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: css.surface, border: `1px solid ${css.border}`, borderRadius: 16, padding: 24, width: 400, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: css.txtPrimary }}>Finalizar venda</h2>

            <div style={{ background: css.surfaceAlt, borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${css.border}` }}>
              <span style={{ color: css.txtSecondary, fontSize: 13, fontWeight: 500 }}>Total</span>
              <span style={{ color: css.accent, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>{fmt(cartTotal)}</span>
            </div>

            {consumer && (
              <div style={{ background: css.indigoBg, border: '1px solid #c7d2fe', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>👤</span>
                <div>
                  <p style={{ fontSize: 12, color: css.indigo, fontWeight: 600 }}>{consumer.name}</p>
                  {consumer.cpf && <p style={{ fontSize: 10, color: css.txtMuted }}>CPF: {consumer.cpf}</p>}
                </div>
              </div>
            )}

            <div>
              <p style={{ fontSize: 11, color: css.txtSecondary, fontWeight: 600, marginBottom: 8 }}>Forma de pagamento</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {(['dinheiro', 'pix', 'cartao'] as const).map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    style={{
                      padding: '10px 0', borderRadius: 8,
                      border: `1.5px solid ${payMethod === m ? css.indigo : css.border}`,
                      background: payMethod === m ? css.indigoBg : css.surface,
                      color: payMethod === m ? css.indigo : css.txtSecondary,
                      cursor: 'pointer', fontSize: 13, fontWeight: payMethod === m ? 600 : 400,
                      transition: 'all 0.15s',
                    }}>
                    {m === 'dinheiro' ? '💵 Dinheiro' : m === 'pix' ? '⚡ Pix' : '💳 Cartão'}
                  </button>
                ))}
              </div>
            </div>

            {payMethod === 'dinheiro' && (
              <div>
                <p style={{ fontSize: 11, color: css.txtSecondary, fontWeight: 600, marginBottom: 6 }}>Valor recebido (para troco)</p>
                <input type="text" inputMode="decimal" value={change} onChange={e => setChange(e.target.value)} placeholder="0,00"
                  style={{ width: '100%', background: css.bg, border: `1.5px solid ${css.border}`, borderRadius: 8, padding: '10px 12px', color: css.txtPrimary, outline: 'none', fontSize: 14, boxSizing: 'border-box' }} />
                {change && !isNaN(parseFloat(change.replace(',', '.'))) && (
                  <p style={{ fontSize: 12, color: css.green, marginTop: 6, fontWeight: 600 }}>
                    Troco: {fmt(Math.max(0, parseFloat(change.replace(',', '.')) - cartTotal))}
                  </p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button onClick={() => setFinalModal(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${css.border}`, color: css.txtSecondary, background: css.surface, cursor: 'pointer', fontSize: 13 }}>Voltar</button>
              <button
                onClick={confirmVenda}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: css.green, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px rgba(22,163,74,0.25)' }}
              >✓ Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
