'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { createPdvSale, finalizarNfce, saveNfceXml } from '@/services/pdv'
import { emitirNfce } from '@/services/nfce-transmissao'
import { NfceLogsModal } from '@/components/pdv/NfceLogsModal'

// ─── tipos locais ────────────────────────────────────────────────────────────

type CartItem = {
  id: number
  code: number
  name: string
  price: number
  image: string
  qty: number
  discount: number
  variant_label?: string
  variant_id?: number | null
  size_value?: string | null
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
  onCloseCash?: () => void   // ← adicionar
  onLogout?: () => void      // ← adicionar
  operatorName?: string      // ← adicionar
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
  const [customerSearch,   setCustomerSearch]   = useState('')
  const [customerResults,  setCustomerResults]  = useState<any[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)
  const [consumerMode,     setConsumerMode]     = useState<'search' | 'manual'>('search')

  const searchCustomers = useCallback(async (term: string) => {
    setCustomerSearch(term)
    if (!term.trim()) { setCustomerResults([]); return }
    setCustomerSearching(true)
    try {
      const digits = term.replace(/\D/g, '')
      const { data } = await supabase
        .from('customers')
        .select('id, code, name, cpf, cnpj, phone, pessoa_tipo')
        .eq('company_id', companyId)
        .or(
          digits.length >= 3
            ? `cpf.ilike.%${digits}%,cnpj.ilike.%${digits}%,code.eq.${Number(digits) || 0},name.ilike.%${term.trim()}%`
            : `name.ilike.%${term.trim()}%,code.eq.${Number(digits) || 0}`
        )
        .limit(6)
      setCustomerResults(data ?? [])
    } finally {
      setCustomerSearching(false)
    }
  }, [companyId])

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

export function PDVTab({ companyId, cashRegisterId, serie, onError, onCloseCash, onLogout, operatorName }: PDVProps) {

  const { products, loading, getByCode } = useProducts(companyId, onError)

  // ── ALTERAÇÃO 1: estados e busca do operador ──────────────────────────────
  const [operatorId,   setOperatorId]   = useState<string | undefined>()
  const [customerSearch,   setCustomerSearch]   = useState('')
  const [customerResults,  setCustomerResults]  = useState<any[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)
  const [consumerMode,     setConsumerMode]     = useState<'search' | 'manual'>('search')
  const [nfceModal,  setNfceModal]  = useState(false)
  const [saleResult, setSaleResult] = useState<{ orderId: number; nfceNumero: number; serie: string } | null>(null)
  const [nfceLoading, setNfceLoading] = useState<'normal' | 'contingencia' | null>(null)
  const [logsModal, setLogsModal] = useState(false)
  const [variantModal, setVariantModal] = useState<{
    product: any
    qty: number
    variants: any[]
  } | null>(null)
  const [variantLoading, setVariantLoading] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null)
  const [selectedSize, setSelectedSize]       = useState<string | null>(null)
  const searchCustomers = useCallback(async (term: string) => {


    setCustomerSearch(term)
    if (!term.trim()) { setCustomerResults([]); return }
    setCustomerSearching(true)
    try {
      const digits = term.replace(/\D/g, '')
      const { data } = await supabase
        .from('customers')
        .select('id, code, name, cpf, cnpj, phone, pessoa_tipo')
        .eq('company_id', companyId)
        .or(
          digits.length >= 3
            ? `cpf.ilike.%${digits}%,cnpj.ilike.%${digits}%,code.eq.${Number(digits) || 0},name.ilike.%${term.trim()}%`
            : `name.ilike.%${term.trim()}%,code.eq.${Number(digits) || 0}`
        )
        .limit(6)
      setCustomerResults(data ?? [])
    } finally {
      setCustomerSearching(false)
    }
  }, [companyId])
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

const addToCart = (
  product: any,
  q: number,
  variantLabel?: string,
  variantId?: number,
  sizeValue?: string | null
) => {
  setCart(prev => {
    // Chave única: produto + variante (cor/tamanho)
    const key = variantLabel ? `${product.id}__${variantLabel}` : String(product.id)
    const existing = prev.find(i => (i.variant_label
      ? `${i.id}__${i.variant_label}`
      : String(i.id)) === key)

    if (existing) return prev.map(i => {
      const iKey = i.variant_label ? `${i.id}__${i.variant_label}` : String(i.id)
      return iKey === key ? { ...i, qty: i.qty + q } : i
    })
    return [...prev, {
      id: product.id, code: product.code, name: product.name,
      price: product.price, image: product.image,
      qty: q, discount: 0,
      variant_label: variantLabel,
      variant_id: variantId ?? null,
      size_value: sizeValue ?? null,
    }]
  })
  const label = variantLabel ? ` (${variantLabel})` : ''
  showToast(`${product.name}${label} adicionado`)
}

const checkAndAddToCart = async (product: any, q: number) => {
  setVariantLoading(true)
  try {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, color_id, sizes, stock, active, color:product_colors(id, name, hex_code)')
      .eq('product_id', product.id)
      .eq('active', true)

    if (!variants || variants.length === 0) {
      // Sem variantes — adiciona direto
      addToCart(product, q)
    } else {
      // Tem variantes — abre modal
      setSelectedVariant(null)
      setSelectedSize(null)
      setVariantModal({ product, qty: q, variants })
    }
  } finally {
    setVariantLoading(false)
  }
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
    setConsumerMode('search')    // ← adicionar
    setCustomerSearch('')        // ← adicionar
    setCustomerResults([])
    
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
    const result = await createPdvSale({
      companyId,
      cashRegisterId,
      serie,
      operatorId,
      operatorName,
      items: cart.map(i => ({
        product_id:   i.id,
        product_name: i.name,
        quantity:     i.qty,
        unit_price:   i.price,
        discount:     i.discount,
        variant_id:   i.variant_id ?? null,
        size_value:   i.size_value ?? null,
      })),
      paymentMethod:  payMethod,
      amountReceived: payMethod === 'dinheiro' && change
                        ? parseFloat(change.replace(',', '.'))
                        : undefined,
      changeAmount:   payMethod === 'dinheiro' && change
                        ? Math.max(0, parseFloat(change.replace(',', '.')) - cartTotal)
                        : undefined,
      consumerName: consumer?.name,
      consumerCpf:  consumer?.cpf?.replace(/\D/g, ''),
    })

    setSaleResult({ orderId: result.orderId, nfceNumero: result.nfceNumero, serie: result.serie })
    setFinalModal(false)
    setNfceModal(true)   // ← abre card de emissão
  } catch (e: any) {
    showToast(e.message, 'err')
    onError(e.message)
    setFinalModal(false)
  }
}
const handleEmitirNfce = async (tipo: 'normal' | 'contingencia') => {
  if (!saleResult) return
  setNfceLoading(tipo)

  try {
    const nfceItems = cart.map((item, idx) => ({
      order:        idx + 1,
      product_id:   item.id,
      product_name: item.name,
      variant_label:  item.variant_label ?? undefined,
      ean:          null,
      quantity:     item.qty,
      unit_price:   item.price,
      discount:     item.discount,
      ncm:          '99999999',
      cfop:         '5102',
      cst:          '400',
      unit:         'UN',
    }))

    const troco = payMethod === 'dinheiro' && change
      ? Math.max(0, parseFloat(change.replace(',', '.')) - cartTotal)
      : 0

    const result = await emitirNfce({
      companyId,
      orderId:       saleResult.orderId,
      nfceNumero:    saleResult.nfceNumero,
      serie:         saleResult.serie,
      items:         nfceItems,
      paymentMethod: payMethod,
      total:         cartTotal,
      troco,
      consumer:      consumer?.cpf ? { name: consumer.name, cpf: consumer.cpf } : null,
      contingencia:  tipo === 'contingencia',
    })

    if (result.ok) {
      const msg = tipo === 'contingencia'
        ? 'Salva em contingência — transmita quando houver conexão'
        : `NFC-e autorizada! Chave: ${result.chaveAcesso?.slice(-8)}`
      showToast(msg, 'ok')
    } else {
      // Rejeição SEFAZ — salva no banco em vez de exibir toast
      const motivo = result.cStat
        ? `[cStat ${result.cStat}] ${result.xMotivo}`
        : result.error ?? 'Erro desconhecido'

      await supabase
        .from('orders')
        .update({
          nfce_status: 'rejeitado',
          nfce_motivo: motivo,
          nfce_cstat:  result.cStat ?? null,
        })
        .eq('id', saleResult.orderId)

      showToast('NFC-e rejeitada — consulte F9 para detalhes', 'err')
    }

  } catch (e: any) {
    // Erro na edge function (ex: certificado não configurado) — salva no banco
    await supabase
      .from('orders')
      .update({
        nfce_status: 'rejeitado',
        nfce_motivo: e.message ?? 'Erro desconhecido na transmissão',
        nfce_cstat:  null,
      })
      .eq('id', saleResult.orderId)

    showToast('Erro ao emitir NFC-e — consulte F9 para detalhes', 'err')

  } finally {
    setNfceLoading(null)
    setNfceModal(false)
    setSaleResult(null)
    setCart([])
    setSelectedCartId(null)
    setConsumer(null)
  }
}

const handlePularNfce = () => {
  setNfceModal(false)
  setSaleResult(null)
  setCart([])
  setSelectedCartId(null)
  setConsumer(null)
  showToast(`Venda finalizada — ${fmt(cartTotal)}`)
}
const handleAddByCode = async () => {
  if (!codeInput.trim()) return
  const p = await getByCode(codeInput.trim())
  if (!p) { showToast('Produto não encontrado', 'err'); return }
  await checkAndAddToCart(p, qty)
  setCodeInput('')
}
const handleConfirmVariant = () => {
  if (!variantModal) return
  const { product, qty } = variantModal

  const colorName = selectedVariant?.color?.name ?? null
  const sizeName  = selectedSize ?? null
  const label     = [colorName, sizeName].filter(Boolean).join(' / ')

  addToCart(product, qty, label || undefined, selectedVariant?.id, sizeName)
  setVariantModal(null)
}

  const cupomNum = '000142'
  const now      = new Date()
  const dataHora = now.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // ── Botões F-key ─────────────────────────────────────────────────────────────
const fkeys = [
  { key: 'F1', label: 'Desc. item',     fn: handleDescItem,                         danger: false, highlight: false },
  { key: 'F2', label: 'Desc. total',    fn: handleDescTotal,                        danger: false, highlight: false },
  { key: 'F3', label: 'Cancelar item',  fn: handleCancelarItem,                     danger: true,  highlight: false },
  { key: 'F4', label: 'Cancelar cupom', fn: handleCancelarCupom,                    danger: true,  highlight: false },
  { key: 'F5', label: 'Desfazer desc.', fn: handleDesfazer,                         danger: false, highlight: false },
  { key: 'F6', label: 'Consumidor',     fn: () => openConsumerModal(false),         danger: false, highlight: true  },
  { key: 'F7', label: 'Logs NFC-e',     fn: () => setLogsModal(true),              danger: false, highlight: false },
]

// Coloca logo após os outros useEffects, antes do return
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'F1') { e.preventDefault(); handleDescItem() }
    else if (e.key === 'F2') { e.preventDefault(); handleDescTotal() }
    else if (e.key === 'F3') { e.preventDefault(); handleCancelarItem() }
    else if (e.key === 'F4') { e.preventDefault(); handleCancelarCupom() }
    else if (e.key === 'F5') { e.preventDefault(); handleDesfazer() }
    else if (e.key === 'F6') { e.preventDefault(); openConsumerModal(false) }
    else if (e.key === 'F7') { e.preventDefault(); setLogsModal(true) }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [cart, selectedCartId, consumer])

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

  {/* Botões F1–F9 */}
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
        color: danger ? css.red : css.indigo,
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

  {/* ── Espaçador + grupo operador (FORA do map) ── */}
  <div style={{ flex: 1 }} />

  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
    {operatorName && (
      <span style={{
        fontSize: 11, color: css.txtMuted,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        👤 {operatorName}
      </span>
    )}
    {onCloseCash && (
      <button
        onClick={onCloseCash}
        style={{
          fontSize: 11, color: '#f97316',
          background: 'rgba(249,115,22,0.08)',
          border: '1px solid rgba(249,115,22,0.2)',
          borderRadius: 8, padding: '5px 12px',
          cursor: 'pointer', fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        Fechar caixa
      </button>
    )}
    {onLogout && (
      <button
        onClick={onLogout}
        style={{
          fontSize: 11, color: '#ef4444',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8, padding: '5px 12px',
          cursor: 'pointer', fontWeight: 600,
        }}
      >
        Sair
      </button>
    )}
  </div>

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
                disabled={variantLoading}
                onClick={() => selectedProd
                  ? checkAndAddToCart(selectedProd, qty)
                  : showToast('Selecione um produto', 'err')
                }
                style={{
                  background: css.accent,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: variantLoading ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(249,115,22,0.3)',
                  transition: 'all 0.15s',
                  opacity: variantLoading ? 0.7 : 1,
                }}
                onMouseEnter={e => {
                  if (!variantLoading)
                    (e.currentTarget as HTMLElement).style.background = '#ea6c10'
                }}
                onMouseLeave={e => {
                  if (!variantLoading)
                    (e.currentTarget as HTMLElement).style.background = css.accent
                }}
              >
                {variantLoading ? 'Carregando...' : '+ Adicionar'}
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

{consumerModal && (
  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
    <div style={{ background: css.surface, border: `1.5px solid ${consumerRequired ? '#fde68a' : css.border}`, borderRadius: 16, padding: 24, width: 400, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>

      {/* Cabeçalho */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: css.txtPrimary, marginBottom: 4 }}>👤 Identificação do Consumidor</h2>
        <p style={{ fontSize: 11, color: consumerRequired ? css.yellow : css.txtMuted }}>
          {consumerRequired ? `⚠️ Obrigatório para compras acima de ${fmt(LIMITE_IDENTIFICACAO)}` : 'Busque um cliente cadastrado ou informe manualmente'}
        </p>
      </div>

      {/* Aviso valor */}
      {consumerRequired && (
        <div style={{ background: css.yellowBg, border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <p style={{ fontSize: 12, color: css.yellow, lineHeight: 1.5 }}>
            Cupom totaliza <strong>{fmt(cartTotal)}</strong>. Identificação exigida acima de {fmt(LIMITE_IDENTIFICACAO)}.
          </p>
        </div>
      )}

      {/* Abas: busca / manual */}
      <div style={{ display: 'flex', gap: 4, background: css.surfaceAlt, borderRadius: 8, padding: 3 }}>
        {(['search', 'manual'] as const).map(mode => (
          <button key={mode} onClick={() => setConsumerMode(mode)}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
              background: consumerMode === mode ? css.surface : 'transparent',
              color: consumerMode === mode ? css.txtPrimary : css.txtMuted,
              boxShadow: consumerMode === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>
            {mode === 'search' ? '🔍 Buscar cadastrado' : '✏️ Informar manualmente'}
          </button>
        ))}
      </div>

      {/* ── Modo busca ── */}
      {consumerMode === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <input
              autoFocus
              type="text"
              value={customerSearch}
              onChange={e => searchCustomers(e.target.value)}
              placeholder="Nome, CPF, CNPJ ou código interno..."
              style={{
                width: '100%', background: css.bg, border: `1.5px solid ${css.border}`,
                borderRadius: 8, padding: '9px 36px 9px 12px', fontSize: 13,
                color: css.txtPrimary, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {customerSearching && (
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke={css.txtMuted} strokeWidth="4" opacity="0.25"/>
                  <path fill={css.txtMuted} opacity="0.75" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </span>
            )}
          </div>

          {/* Resultados */}
          {customerResults.length > 0 && (
            <div style={{ border: `1px solid ${css.border}`, borderRadius: 8, overflow: 'hidden' }}>
              {customerResults.map((c, idx) => (
                <div
                  key={c.id}
                  onClick={() => {
                    const name = c.razao_social ?? c.name
                    const cpf  = c.cpf ?? c.cnpj ?? ''
                    setConsumer({ name, cpf })
                    setConsumerModal(false)
                    if (consumerRequired) { setConsumerRequired(false); setFinalModal(true); setChange('') }
                    else showToast(`Consumidor: ${name}`)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', cursor: 'pointer', transition: 'background 0.12s',
                    background: idx % 2 === 0 ? css.surface : css.bg,
                    borderTop: idx > 0 ? `1px solid ${css.border}` : 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = css.indigoBg}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? css.surface : css.bg}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <p style={{ fontSize: 13, color: css.txtPrimary, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </p>
                    <p style={{ fontSize: 11, color: css.txtMuted, margin: 0 }}>
                      {c.cpf ? `CPF: ${c.cpf}` : c.cnpj ? `CNPJ: ${c.cnpj}` : 'Sem documento'}
                      {' · '}cod. {String(c.code).padStart(4, '0')}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, color: css.indigo, background: css.indigoBg, padding: '2px 8px', borderRadius: 20, marginLeft: 8, flexShrink: 0, fontWeight: 600 }}>
                    {c.pessoa_tipo === 'juridica' ? 'PJ' : 'PF'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {customerSearch && !customerSearching && customerResults.length === 0 && (
            <p style={{ fontSize: 12, color: css.txtMuted, textAlign: 'center', padding: '8px 0' }}>
              Nenhum cliente encontrado —{' '}
              <button onClick={() => setConsumerMode('manual')} style={{ background: 'none', border: 'none', color: css.indigo, cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}>
                informar manualmente
              </button>
            </p>
          )}
        </div>
      )}

      {/* ── Modo manual ── */}
      {consumerMode === 'manual' && (
        <>
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
        </>
      )}

      {/* Botão cancelar (modo busca sem obrigatoriedade) */}
      {consumerMode === 'search' && !consumerRequired && (
        <button onClick={() => setConsumerModal(false)}
          style={{ padding: '9px 0', borderRadius: 8, border: `1px solid ${css.border}`, color: css.txtSecondary, background: css.surface, cursor: 'pointer', fontSize: 13 }}>
          Cancelar
        </button>
      )}

      {/* Remover identificação */}
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
                    {m === 'dinheiro' ? 'Dinheiro' : m === 'pix' ? 'Pix' : 'Cartão'}
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
      {/* ── Modal NFC-e ──────────────────────────────────────────────── */}
{nfceModal && saleResult && (
  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
    <div style={{ background: css.surface, borderRadius: 18, padding: 28, width: 420, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: `1px solid ${css.border}` }}>

      {/* Ícone + título */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: css.txtPrimary, marginBottom: 6 }}>
          Deseja emitir o cupom fiscal?
        </h2>
        <p style={{ fontSize: 12, color: css.txtMuted, lineHeight: 1.6 }}>
          NFC-e nº <strong style={{ color: css.txtSecondary }}>{String(saleResult.nfceNumero).padStart(6, '0')}</strong>
          {' '}· Série <strong style={{ color: css.txtSecondary }}>{saleResult.serie}</strong>
        </p>
      </div>

      {/* Resumo da venda */}
      <div style={{ background: css.surfaceAlt, borderRadius: 10, padding: '12px 16px', border: `1px solid ${css.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: css.txtSecondary }}>Total da venda</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: css.accent }}>{fmt(cartTotal)}</span>
      </div>

      {/* Botões principais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Emitir NFC-e */}
        <button
          onClick={() => handleEmitirNfce('normal')}
          disabled={nfceLoading !== null}
          style={{
            padding: '14px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: nfceLoading === 'normal' ? '#15803d' : css.green,
            color: '#fff', fontSize: 13, fontWeight: 700,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            opacity: nfceLoading !== null && nfceLoading !== 'normal' ? 0.5 : 1,
            transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
          }}
        >
          {nfceLoading === 'normal'
            ? <span style={{ fontSize: 16 }}>...</span>
            : <span style={{ fontSize: 20 }}>S</span>
          }
          <span>Emitir NFC-e</span>
          <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.85 }}>Online · SEFAZ</span>
        </button>

        {/* Contingência */}
        <button
          onClick={() => handleEmitirNfce('contingencia')}
          disabled={nfceLoading !== null}
          style={{
            padding: '14px 10px', borderRadius: 10,
            border: `1.5px solid ${css.yellow}`,
            cursor: 'pointer', background: css.yellowBg,
            color: css.yellow, fontSize: 13, fontWeight: 700,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            opacity: nfceLoading !== null && nfceLoading !== 'contingencia' ? 0.5 : 1,
            transition: 'all 0.15s',
          }}
        >
          {nfceLoading === 'contingencia'
            ? <span style={{ fontSize: 16 }}>...</span>
            : <span style={{ fontSize: 20 }}>N</span>
          }
          <span>Contingência</span>
          <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.85 }}>Offline · sincronizar depois</span>
        </button>
      </div>

      {/* Pular */}
      <button
        onClick={handlePularNfce}
        disabled={nfceLoading !== null}
        style={{
          background: 'none', border: 'none', color: css.txtMuted,
          fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
          textAlign: 'center', padding: '4px 0',
        }}
      >
        Não emitir agora
      </button>
    </div>
  </div>
)}
{logsModal && (
  <NfceLogsModal
    companyId={companyId}
    serie={serie} 
    onClose={() => setLogsModal(false)}
    onRetentar={async (orderIds) => {
      showToast(
        orderIds.length === 1
          ? 'Reemitindo cupom...'
          : `Reemitindo ${orderIds.length} cupons...`
      )

      let success = 0
      let fail    = 0

      for (const orderId of orderIds) {
        try {
          // 1. Busca os dados completos do pedido no banco
          const { data: order, error } = await supabase
            .from('orders')
            .select('id, nfce_numero, nfce_serie, items, total, payment_method, amount_received, change, consumer_name, cpf_cnpj_consumidor')
            .eq('id', orderId)
            .single()

          if (error || !order) {
            console.error(`Pedido ${orderId} não encontrado:`, error)
            fail++
            continue
          }

          // 2. Reconstrói os itens fiscais a partir do jsonb salvo
          const nfceItems = (order.items as any[]).map((item: any, idx: number) => ({
            order:        idx + 1,
            product_id:   item.product_id,
            product_name: item.product_name,
            ean:          item.ean ?? null,
            quantity:     item.quantity,
            unit_price:   item.unit_price,
            discount:     item.discount ?? 0,
            ncm:          item.ncm   ?? '99999999',
            cfop:         item.cfop  ?? '5102',
            cst:          item.cst   ?? '400',
            unit:         item.unit  ?? 'UN',
          }))

          // 3. Reconstrói troco
          const totalNum    = Number(order.total ?? 0)
          const receivedNum = Number(order.amount_received ?? 0)
          const troco       = order.payment_method === 'dinheiro' && receivedNum > totalNum
            ? receivedNum - totalNum
            : 0

          // 4. Chama a transmissão
          const result = await emitirNfce({
            companyId,
            orderId:       order.id,
            nfceNumero:    order.nfce_numero,
            serie:         order.nfce_serie ?? serie,
            items:         nfceItems,
            paymentMethod: order.payment_method as any,
            total:         totalNum,
            troco,
            consumer:      order.cpf_cnpj_consumidor
              ? { name: order.consumer_name ?? '', cpf: order.cpf_cnpj_consumidor }
              : null,
            contingencia: false,
          })

          if (result.ok) {
            success++
          } else {
            // Persiste o novo motivo de rejeição
            const motivo = result.cStat
              ? `[cStat ${result.cStat}] ${result.xMotivo}`
              : result.error ?? 'Erro desconhecido'

            await supabase
              .from('orders')
              .update({ nfce_status: 'rejeitado', nfce_motivo: motivo, nfce_cstat: result.cStat ?? null })
              .eq('id', orderId)

            fail++
          }

        } catch (err: any) {
          // Persiste erro de exceção (ex: certificado)
          await supabase
            .from('orders')
            .update({ nfce_status: 'rejeitado', nfce_motivo: err.message ?? 'Erro desconhecido', nfce_cstat: null })
            .eq('id', orderId)

          fail++
        }
      }

      // 5. Toast com resumo
      if (fail === 0) {
        showToast(success === 1 ? 'NFC-e reemitida com sucesso' : `${success} NFC-e emitidas com sucesso`, 'ok')
      } else if (success === 0) {
        showToast(fail === 1 ? 'Falha ao reemitir — consulte F9' : `${fail} falhas — consulte F9`, 'err')
      } else {
        showToast(`${success} ok · ${fail} com falha — consulte F9`, 'err')
      }
    }}
  />
)}

{/* ── Modal de variantes ──────────────────────────────────── */}
{variantModal && (
  <div style={{
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 60, padding: 16,
  }}>
    <div style={{
      background: css.surface, borderRadius: 18, width: '100%', maxWidth: 420,
      maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      boxShadow: '0 12px 40px rgba(0,0,0,0.18)', overflow: 'hidden',
      border: `1px solid ${css.border}`,
    }}>

      {/* Imagem */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={selectedVariant?.image ?? variantModal.product.image}
          alt={variantModal.product.name}
          style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
          onError={(e: any) => { e.target.style.display = 'none' }}
        />
        <button
          onClick={() => setVariantModal(null)}
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 16, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>

      {/* Conteúdo scrollável */}
      <div style={{ overflowY: 'auto', flex: 1 }}>

        {/* Nome + preço */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${css.border}` }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: css.txtPrimary, margin: 0 }}>
            {variantModal.product.name}
          </p>
          <p style={{ fontSize: 13, color: css.accent, fontWeight: 700, marginTop: 4 }}>
            {fmt(variantModal.product.price)}
          </p>
        </div>

        {/* Seletor de cor */}
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${css.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: css.txtPrimary }}>Cor</span>
            <span style={{ fontSize: 11, color: css.red, fontWeight: 600 }}>Obrigatório</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {variantModal.variants.map((v: any) => {
              const color = v.color
              const isSelected = selectedVariant?.id === v.id
              const outOfStock = v.sizes?.length
                ? v.sizes.every((s: any) => s.stock !== null && s.stock <= 0)
                : v.stock !== null && v.stock !== undefined && v.stock <= 0

              return (
                <button
                  key={v.id}
                  disabled={outOfStock}
                  onClick={() => { setSelectedVariant(v); setSelectedSize(null) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 10, cursor: outOfStock ? 'not-allowed' : 'pointer',
                    border: `2px solid ${isSelected ? css.txtPrimary : outOfStock ? '#f0f0f0' : css.border}`,
                    background: isSelected ? css.txtPrimary : outOfStock ? '#fafafa' : css.surface,
                    color: isSelected ? '#fff' : outOfStock ? css.txtMuted : css.txtPrimary,
                    fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                    textDecoration: outOfStock ? 'line-through' : 'none',
                    opacity: outOfStock ? 0.5 : 1,
                  }}
                >
                  {color?.hex_code && (
                    <span style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: color.hex_code, flexShrink: 0,
                      border: `1px solid ${isSelected ? 'rgba(255,255,255,0.4)' : css.border}`,
                    }} />
                  )}
                  {color?.name}
                </button>
              )
            })}
          </div>
          {!selectedVariant && (
            <p style={{ fontSize: 11, color: css.red, marginTop: 8 }}>
              Selecione uma cor para continuar
            </p>
          )}
        </div>

        {/* Seletor de tamanho */}
        {selectedVariant && (selectedVariant.sizes?.length > 0) && (
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${css.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: css.txtPrimary }}>Tamanho</span>
              <span style={{ fontSize: 11, color: css.red, fontWeight: 600 }}>Obrigatório</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedVariant.sizes.map((s: any) => {
                const outOfStock = s.stock !== null && s.stock <= 0
                const isSelected = selectedSize === s.value
                return (
                  <button
                    key={s.value}
                    disabled={outOfStock}
                    onClick={() => setSelectedSize(s.value)}
                    style={{
                      padding: '7px 14px', borderRadius: 10,
                      border: `2px solid ${isSelected ? css.txtPrimary : outOfStock ? '#f0f0f0' : css.border}`,
                      background: isSelected ? css.txtPrimary : outOfStock ? '#fafafa' : css.surface,
                      color: isSelected ? '#fff' : outOfStock ? css.txtMuted : css.txtPrimary,
                      fontSize: 12, fontWeight: 600, cursor: outOfStock ? 'not-allowed' : 'pointer',
                      textDecoration: outOfStock ? 'line-through' : 'none',
                      opacity: outOfStock ? 0.5 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    {s.value}
                    {s.stock !== null && s.stock > 0 && (
                      <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.6 }}>
                        ({s.stock})
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {!selectedSize && (
              <p style={{ fontSize: 11, color: css.red, marginTop: 8 }}>
                Selecione um tamanho para continuar
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        flexShrink: 0, padding: '14px 20px',
        borderTop: `1px solid ${css.border}`, background: css.surface,
        display: 'flex', gap: 10,
      }}>
        <button
          onClick={() => setVariantModal(null)}
          style={{
            flex: 1, padding: '11px 0', borderRadius: 10,
            border: `1px solid ${css.border}`, background: css.surface,
            color: css.txtSecondary, fontSize: 13, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirmVariant}
          disabled={
            !selectedVariant ||
            (selectedVariant.sizes?.length > 0 && !selectedSize)
          }
          style={{
            flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
            background: (!selectedVariant || (selectedVariant.sizes?.length > 0 && !selectedSize))
              ? css.border : css.green,
            color: (!selectedVariant || (selectedVariant.sizes?.length > 0 && !selectedSize))
              ? css.txtMuted : '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          + Adicionar ao cupom · {fmt(variantModal.product.price)}
        </button>
      </div>
    </div>
  </div>
)}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}