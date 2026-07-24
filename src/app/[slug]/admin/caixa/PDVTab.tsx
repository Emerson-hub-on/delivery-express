'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { createPdvSale } from '@/services/pdv'
import { emitirNfce } from '@/services/nfce-transmissao'
import { NfceLogsModal } from '@/components/pdv/NfceLogsModal'
import { CancelarVendaModal } from '@/components/pdv/CancelarVendaModal'

// ─── tipos ───────────────────────────────────────────────────────────────────

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

type Consumer = { name: string; cpf: string }

type PDVProps = {
  companyId: string
  cashRegisterId: string
  serie: string
  onError: (msg: string) => void
  onCloseCash?: () => void
  onLogout?: () => void
  operatorName?: string
}

// ─── utils ───────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

  const fetchProducts = useCallback((opts?: { silent?: boolean }) => {
    if (!companyId) return
    if (!opts?.silent) setLoading(true)
    supabase
      .from('products')
      .select('id, code, name, price, image, category, ean, active, stock, sizes')
      .eq('company_id', companyId).eq('active', true).order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) { onError(error.message); return }
        setProducts(data ?? [])
        setLoading(false)
      })
  }, [companyId, onError])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const getByCode = useCallback(async (code: string): Promise<any | null> => {
    const { data } = await supabase
      .from('products')
      .select('id, code, name, price, image, category, ean, active, stock, sizes')
      .eq('company_id', companyId)
      .or(`code.eq.${Number(code)},ean.eq.${code}`)
      .eq('active', true).limit(1).single()
    return data ?? null
  }, [companyId])

  return { products, loading, getByCode, refetch: fetchProducts }
}

// ─── componente ──────────────────────────────────────────────────────────────

export function PDVTab({ companyId, cashRegisterId, serie, onError, onCloseCash, onLogout, operatorName }: PDVProps) {
    const { products, loading, getByCode, refetch: refetchProducts } = useProducts(companyId, onError)

  // operator
  const [operatorId, setOperatorId] = useState<string | undefined>()
  // fiscal config — verifica se a empresa tem certificado configurado
  const [fiscalConfigured, setFiscalConfigured] = useState<boolean | null>(null)
  useEffect(() => {
    if (!companyId) return
    supabase
      .from('fiscal_configs')
      .select('cert_pfx_base64, cert_senha, cert_cpf_pfx_base64, cert_cpf_senha')
      .eq('company_id', companyId)
      .maybeSingle()
      .then(({ data }) => {
        const configured = !!(
          (data?.cert_pfx_base64 && data?.cert_senha) ||
          (data?.cert_cpf_pfx_base64 && data?.cert_cpf_senha)
        )
        setFiscalConfigured(configured)
      })
  }, [companyId])

  useEffect(() => {
    if (!companyId) return
    supabase.from('operators').select('id').eq('company_id', companyId).eq('active', true).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setOperatorId(data.id) })
  }, [companyId])

  // cart
  const [cart, setCart]                     = useState<CartItem[]>([])
  const [qty, setQty]                       = useState(1)
  const [selectedProd, setSelectedProd]     = useState<any | null>(null)
  const [selectedCartId, setSelectedCartId] = useState<number | null>(null)
  const [search, setSearch]                 = useState('')
  const [codeInput, setCodeInput]           = useState('')

  // toast
  const [toast, setToast]   = useState<{ msg: string; type?: 'ok' | 'err' } | null>(null)
  const toastRef             = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2800)
  }

  // discount
  const [discModal, setDiscModal] = useState<'item' | 'total' | null>(null)
  const [discValue, setDiscValue] = useState('')

  // finalize
  const [finalModal, setFinalModal] = useState(false)
  const [payMethod, setPayMethod]   = useState<'dinheiro' | 'pix' | 'cartao'>('dinheiro')
  const [change, setChange]         = useState('')

  // consumer
  const [consumer, setConsumer]                   = useState<Consumer | null>(null)
  const [consumerModal, setConsumerModal]         = useState(false)
  const [consumerName, setConsumerName]           = useState('')
  const [consumerCpf, setConsumerCpf]             = useState('')
  const [consumerRequired, setConsumerRequired]   = useState(false)
  const [consumerMode, setConsumerMode]           = useState<'search' | 'manual'>('search')
  const [customerSearch, setCustomerSearch]       = useState('')
  const [customerResults, setCustomerResults]     = useState<any[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)

  // nfce
  const [nfceModal, setNfceModal]   = useState(false)
  const [saleResult, setSaleResult] = useState<{ orderId: number; nfceNumero: number; serie: string } | null>(null)
  const [nfceLoading, setNfceLoading] = useState<'normal' | 'contingencia' | null>(null)
  const [logsModal, setLogsModal]   = useState(false)

  // variant modal (cor + tamanho)
  const [variantModal, setVariantModal]   = useState<{ product: any; qty: number; variants: any[] } | null>(null)
  const [variantLoading, setVariantLoading] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null)
  const [selectedSize, setSelectedSize]       = useState<string | null>(null)

  // size-only modal (tamanho sem cor)
  const [sizeModal, setSizeModal]           = useState<{ product: any; qty: number; sizes: any[] } | null>(null)
  const [selectedSizeOnly, setSelectedSizeOnly] = useState<string | null>(null)
  const [cancelVendaModal, setCancelVendaModal] = useState(false)

  // ── computed ──────────────────────────────────────────────────────────────
  const filtered = search
    ? products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        String(p.code).includes(search) ||
        (p.ean && p.ean.includes(search)))
    : products

  const cartTotal = cart.reduce((s, i) => s + i.price * (1 - i.discount / 100) * i.qty, 0)
  const cartQty   = cart.reduce((s, i) => s + i.qty, 0)
  const dataHora  = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // ── customer search ───────────────────────────────────────────────────────
  const searchCustomers = useCallback(async (term: string) => {
    setCustomerSearch(term)
    if (!term.trim()) { setCustomerResults([]); return }
    setCustomerSearching(true)
    try {
      const digits = term.replace(/\D/g, '')
      const { data } = await supabase.from('customers')
        .select('id, code, name, cpf, cnpj, phone, pessoa_tipo')
        .eq('company_id', companyId)
        .or(digits.length >= 3
          ? `cpf.ilike.%${digits}%,cnpj.ilike.%${digits}%,code.eq.${Number(digits) || 0},name.ilike.%${term.trim()}%`
          : `name.ilike.%${term.trim()}%,code.eq.${Number(digits) || 0}`)
        .limit(6)
      setCustomerResults(data ?? [])
    } finally { setCustomerSearching(false) }
  }, [companyId])

  // ── cart ─────────────────────────────────────────────────────────────────
  const addToCart = (product: any, q: number, variantLabel?: string, variantId?: number | null, sizeVal?: string | null) => {
    setCart(prev => {
      const key = variantLabel ? `${product.id}__${variantLabel}` : String(product.id)
      const existing = prev.find(i => (i.variant_label ? `${i.id}__${i.variant_label}` : String(i.id)) === key)
      if (existing) return prev.map(i => {
        const iKey = i.variant_label ? `${i.id}__${i.variant_label}` : String(i.id)
        return iKey === key ? { ...i, qty: i.qty + q } : i
      })
      return [...prev, { id: product.id, code: product.code, name: product.name, price: product.price, image: product.image, qty: q, discount: 0, variant_label: variantLabel, variant_id: variantId ?? null, size_value: sizeVal ?? null }]
    })
    showToast(`${product.name}${variantLabel ? ` (${variantLabel})` : ''} adicionado`)
  }

  const checkAndAddToCart = async (product: any, q: number) => {
    setVariantLoading(true)
    try {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('id, color_id, sizes, stock, active, color:product_colors(id, name, hex_code)')
        .eq('product_id', product.id).eq('active', true)

      if (variants && variants.length > 0) {
        setSelectedVariant(null); setSelectedSize(null)
        setVariantModal({ product, qty: q, variants })
      } else if (Array.isArray(product.sizes) && product.sizes.length > 0) {
        // produto com tamanhos mas sem cor → modal simples
        setSelectedSizeOnly(null)
        setSizeModal({ product, qty: q, sizes: product.sizes })
      } else {
        addToCart(product, q)
      }
    } finally { setVariantLoading(false) }
  }

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(i => i.id !== id))
    if (selectedCartId === id) setSelectedCartId(null)
  }

  // ── discount ──────────────────────────────────────────────────────────────
  const handleDescItem  = () => { if (!selectedCartId) { showToast('Selecione um item do cupom', 'err'); return }; setDiscModal('item'); setDiscValue('') }
  const handleDescTotal = () => { if (cart.length === 0) { showToast('Cupom vazio', 'err'); return }; setDiscModal('total'); setDiscValue('') }
  const applyDiscount = () => {
    const n = parseFloat(discValue.replace(',', '.'))
    if (isNaN(n) || n < 0 || n > 100) { showToast('Desconto inválido (0–100%)', 'err'); return }
    if (discModal === 'item' && selectedCartId) setCart(prev => prev.map(i => i.id === selectedCartId ? { ...i, discount: n } : i))
    else if (discModal === 'total') setCart(prev => prev.map(i => ({ ...i, discount: n })))
    showToast(`Desconto de ${n}% aplicado`); setDiscModal(null)
  }

  const handleDesfazer     = () => { setCart(prev => prev.map(i => ({ ...i, discount: 0 }))); showToast('Descontos removidos') }
  const handleCancelarItem = () => { if (!selectedCartId) { showToast('Selecione um item', 'err'); return }; removeFromCart(selectedCartId); showToast('Item removido') }
  const handleCancelarCupom = () => { if (cart.length === 0) return; setCart([]); setSelectedCartId(null); setConsumer(null); showToast('Cupom cancelado') }

  // ── consumer ─────────────────────────────────────────────────────────────
  const openConsumerModal = (required = false) => {
    setConsumerName(consumer?.name ?? ''); setConsumerCpf(consumer?.cpf ?? '')
    setConsumerRequired(required); setConsumerModal(true)
    setConsumerMode('search'); setCustomerSearch(''); setCustomerResults([])
  }
  const saveConsumer = () => {
    const name = consumerName.trim(); const cpf = consumerCpf.trim()
    if (!name && !cpf) { if (consumerRequired) { showToast('Nome e CPF são obrigatórios', 'err'); return }; setConsumer(null); setConsumerModal(false); showToast('Consumidor removido'); return }
    if (!name) { showToast('Informe pelo menos o nome', 'err'); return }
    if (consumerRequired && !cpf) { showToast('CPF é obrigatório para esta compra', 'err'); return }
    setConsumer({ name, cpf }); setConsumerModal(false)
    if (consumerRequired) { setConsumerRequired(false); setFinalModal(true); setChange('') }
    else showToast(`Consumidor: ${name}`)
  }

  // ── finalize ─────────────────────────────────────────────────────────────
  const handleFinalizar = () => {
    if (cart.length === 0) { showToast('Adicione itens ao cupom', 'err'); return }
    if (cartTotal >= LIMITE_IDENTIFICACAO && (!consumer?.name || !consumer?.cpf)) {
      showToast(`Compras acima de ${fmt(LIMITE_IDENTIFICACAO)} exigem identificação`, 'err')
      openConsumerModal(true); return
    }
    setFinalModal(true); setChange('')
  }

const confirmVenda = async () => {
    try {
      const result = await createPdvSale({
        companyId, cashRegisterId, serie, operatorId, operatorName,
        items: cart.map(i => ({
          product_id: i.id, product_name: i.name,
          quantity: i.qty, unit_price: i.price, discount: i.discount,
          variant_id: i.variant_id ?? null, size_value: i.size_value ?? null,
        })),
        paymentMethod: payMethod,
        amountReceived: payMethod === 'dinheiro' && change ? parseFloat(change.replace(',', '.')) : undefined,
        changeAmount:   payMethod === 'dinheiro' && change ? Math.max(0, parseFloat(change.replace(',', '.')) - cartTotal) : undefined,
        consumerName: consumer?.name, consumerCpf: consumer?.cpf?.replace(/\D/g, ''),
      })
      setFinalModal(false)
      refetchProducts({ silent: true })

      if (fiscalConfigured) {
        setSaleResult({ orderId: result.orderId, nfceNumero: result.nfceNumero, serie: result.serie })
        setNfceModal(true)
      } else {
        // empresa sem certificado configurado → não emite NFC-e, finaliza direto
        const total = cartTotal
        setCart([]); setSelectedCartId(null); setConsumer(null)
        showToast(`Venda finalizada — ${fmt(total)}`)
      }
    } catch (e: any) {
      showToast(e.message, 'err'); onError(e.message); setFinalModal(false)
    }
  }

  const handleEmitirNfce = async (tipo: 'normal' | 'contingencia') => {
    if (!saleResult) return
    setNfceLoading(tipo)
    try {
      const nfceItems = cart.map((item, idx) => ({
        order: idx + 1, product_id: item.id, product_name: item.name,
        variant_label: item.variant_label ?? undefined, ean: null,
        quantity: item.qty, unit_price: item.price, discount: item.discount,
        ncm: '99999999', cfop: '5102', cst: '400', unit: 'UN',
      }))
      const troco = payMethod === 'dinheiro' && change ? Math.max(0, parseFloat(change.replace(',', '.')) - cartTotal) : 0
      const result = await emitirNfce({
        companyId, orderId: saleResult.orderId, nfceNumero: saleResult.nfceNumero, serie: saleResult.serie,
        items: nfceItems, paymentMethod: payMethod, total: cartTotal, troco,
        consumer: consumer?.cpf ? { name: consumer.name, cpf: consumer.cpf } : null,
        contingencia: tipo === 'contingencia',
      })
      if (result.ok) {
        showToast(tipo === 'contingencia' ? 'Salva em contingência' : `NFC-e autorizada! Chave: ${result.chaveAcesso?.slice(-8)}`, 'ok')
      } else {
        const motivo = result.cStat ? `[cStat ${result.cStat}] ${result.xMotivo}` : result.error ?? 'Erro desconhecido'
        await supabase.from('orders').update({ nfce_status: 'rejeitado', nfce_motivo: motivo, nfce_cstat: result.cStat ?? null }).eq('id', saleResult.orderId)
        showToast('NFC-e rejeitada — consulte F9 para detalhes', 'err')
      }
    } catch (e: any) {
      await supabase.from('orders').update({ nfce_status: 'rejeitado', nfce_motivo: e.message ?? 'Erro desconhecido', nfce_cstat: null }).eq('id', saleResult.orderId)
      showToast('Erro ao emitir NFC-e — consulte F9', 'err')
    } finally {
      setNfceLoading(null); setNfceModal(false); setSaleResult(null)
      setCart([]); setSelectedCartId(null); setConsumer(null)
    }
  }

  const handlePularNfce = () => {
    const total = cartTotal // captura antes de limpar
    setNfceModal(false); setSaleResult(null)
    setCart([]); setSelectedCartId(null); setConsumer(null)
    showToast(`Venda finalizada — ${fmt(total)}`)
  }

  const handleAddByCode = async () => {
    if (!codeInput.trim()) return
    const p = await getByCode(codeInput.trim())
    if (!p) { showToast('Produto não encontrado', 'err'); return }
    await checkAndAddToCart(p, qty); setCodeInput('')
  }

  const handleConfirmVariant = () => {
    if (!variantModal) return
    const label = [selectedVariant?.color?.name, selectedSize].filter(Boolean).join(' / ')
    addToCart(variantModal.product, variantModal.qty, label || undefined, selectedVariant?.id, selectedSize)
    setVariantModal(null)
  }

  const handleConfirmSizeOnly = () => {
    if (!sizeModal || !selectedSizeOnly) return
    addToCart(sizeModal.product, sizeModal.qty, selectedSizeOnly, null, selectedSizeOnly)
    setSizeModal(null)
  }

  // ── F-keys ────────────────────────────────────────────────────────────────
  const fkeys = [
    { key: 'F1', label: 'Desc. item',     fn: handleDescItem,            danger: false, highlight: false },
    { key: 'F2', label: 'Desc. total',    fn: handleDescTotal,           danger: false, highlight: false },
    { key: 'F3', label: 'Cancelar item',  fn: handleCancelarItem,        danger: true,  highlight: false },
    { key: 'F4', label: 'Cancelar cupom', fn: handleCancelarCupom,       danger: true,  highlight: false },
    { key: 'F5', label: 'Desfazer desc.', fn: handleDesfazer,            danger: false, highlight: false },
    { key: 'F6', label: 'Consumidor',     fn: () => openConsumerModal(), danger: false, highlight: true  },
    { key: 'F7', label: 'Logs NFC-e',     fn: () => setLogsModal(true),  danger: false, highlight: false },
    { key: 'F8', label: 'Cancelar venda', fn: () => setCancelVendaModal(true), danger: true,  highlight: false },
  ]

  useEffect(() => {
    const map: Record<string, () => void> = {
      F1: handleDescItem, F2: handleDescTotal, F3: handleCancelarItem,
      F4: handleCancelarCupom, F5: handleDesfazer,
      F6: () => openConsumerModal(), F7: () => setLogsModal(true),
      F8: () => setCancelVendaModal(true),
    }
    const handler = (e: KeyboardEvent) => { if (map[e.key]) { e.preventDefault(); map[e.key]() } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cart, selectedCartId, consumer])

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 h-[calc(100vh-2rem)] relative shadow-sm text-slate-900">

      {/* ── F-keys bar ── */}
      <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-slate-200 bg-white shrink-0 overflow-x-auto">
        {fkeys.map(({ key, label, fn, danger, highlight }) => (
          <button key={key} onClick={fn}
            className={`flex flex-col items-center min-w-14.5 px-2 py-1.5 rounded-lg border transition-all select-none relative cursor-pointer
              ${danger   ? 'border-red-200    bg-red-50    hover:bg-red-100'
              : highlight ? 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100'
              :             'border-slate-200  bg-white     hover:bg-slate-100'}`}>
            <span className={`font-bold text-[10px] tracking-wide mb-0.5 ${danger ? 'text-red-600' : 'text-indigo-500'}`}>{key}</span>
            <span className={`text-[10px] text-center leading-tight whitespace-nowrap ${danger ? 'text-red-700' : highlight ? 'text-indigo-700' : 'text-slate-500'}`}>{label}</span>
            {key === 'F6' && consumer && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-600 border-2 border-white" />}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2 shrink-0">
          {operatorName && <span className="text-[11px] text-slate-400 flex items-center gap-1">👤 {operatorName}</span>}
          {onCloseCash && (
            <button onClick={onCloseCash} className="text-[11px] text-orange-500 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1 cursor-pointer font-semibold whitespace-nowrap hover:bg-orange-100 transition-colors">Fechar caixa</button>
          )}
          {onLogout && (
            <button onClick={onLogout} className="text-[11px] text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-1 cursor-pointer font-semibold hover:bg-red-100 transition-colors">Sair</button>
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── CUPOM (esq) ── */}
        <div className="flex flex-col w-[55%] border-r border-slate-200 overflow-hidden bg-white">

          {/* header cupom */}
          <div className="shrink-0 px-4 py-2.5 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 font-semibold">CUPOM</span>
                <span className="text-[11px] text-slate-400">{dataHora}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
                <span className="text-[11px] text-green-600 font-semibold">CAIXA ABERTO</span>
              </div>
            </div>
            {consumer && (
              <div className="mt-2 flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span>👤</span>
                  <div>
                    <p className="text-xs text-indigo-600 font-semibold leading-tight">{consumer.name}</p>
                    {consumer.cpf && <p className="text-[10px] text-slate-400 leading-tight">CPF: {consumer.cpf}</p>}
                  </div>
                </div>
                <button onClick={() => openConsumerModal()} className="text-[11px] text-indigo-500 underline bg-transparent border-none cursor-pointer">editar</button>
              </div>
            )}
          </div>

          {/* colunas */}
          <div className="shrink-0 px-4 py-1.5 border-b border-slate-200 bg-slate-100"
            style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1fr 1.5fr', alignItems: 'center' }}>
            {['Código', 'Descrição', 'Preço', 'Qtd', 'Total'].map((h, i) => (
              <span key={h} className={`text-[11px] text-slate-400 font-semibold uppercase tracking-wide ${i >= 2 ? 'text-right' : ''}`}>{h}</span>
            ))}
          </div>

          {/* itens */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="opacity-20">
                  <svg width="48" height="60" viewBox="0 0 56 72" fill="none">
                    <rect x="4" y="0" width="48" height="64" rx="3" fill="#e2e6ed"/>
                    <rect x="12" y="12" width="32" height="2" rx="1" fill="#d0d5de"/>
                    <rect x="12" y="18" width="24" height="2" rx="1" fill="#d0d5de"/>
                    <rect x="12" y="24" width="28" height="2" rx="1" fill="#d0d5de"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-500 font-medium mb-1">Nenhum item adicionado</p>
                  <p className="text-xs text-slate-400">Selecione produtos ou use o código/EAN</p>
                </div>
              </div>
            ) : (
              <>
                {cart.map((item, idx) => {
                  const unitPrice = item.price * (1 - item.discount / 100)
                  const isSelected = selectedCartId === item.id
                  return (
                    <div key={`${item.id}-${item.variant_label ?? ''}`}
                      onClick={() => setSelectedCartId(item.id)}
                      style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1fr 1.5fr', alignItems: 'center' }}
                      className={`px-4 py-2.5 border-b border-slate-200 cursor-pointer transition-colors border-l-[3px]
                        ${isSelected ? 'bg-blue-50 border-l-indigo-500' : `border-l-transparent ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}`}>
                      <span className="text-[11px] text-slate-400 font-mono">{fmtCode(item.code)}</span>
                      <div className="pr-2 min-w-0">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{item.name}</p>
                        {item.variant_label && <p className="text-[10px] text-slate-400 truncate">{item.variant_label}</p>}
                        {item.discount > 0 && <span className="text-[10px] bg-orange-50 text-orange-500 px-1.5 rounded font-semibold">-{item.discount}%</span>}
                      </div>
                      <span className="text-right text-[12px] text-slate-500">{fmt(unitPrice)}</span>
                      <span className="text-right text-[13px] text-slate-900 font-semibold">{item.qty}</span>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-orange-500 font-bold text-[13px]">{fmt(unitPrice * item.qty)}</span>
                        <button onClick={e => { e.stopPropagation(); removeFromCart(item.id) }}
                          className="text-slate-400 hover:text-red-600 text-xs px-1 py-0.5 rounded bg-transparent border-none cursor-pointer transition-colors">✕</button>
                      </div>
                    </div>
                  )
                })}
                {cart.some(i => i.discount > 0) && (
                  <div className="px-4 py-2 bg-green-50 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-[11px] text-slate-500">Total de descontos</span>
                    <span className="text-[12px] text-green-600 font-semibold">
                      - {fmt(cart.reduce((s, i) => s + (i.price * i.qty) - (i.price * (1 - i.discount / 100) * i.qty), 0))}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* aviso */}
          {cartTotal >= LIMITE_IDENTIFICACAO && !consumer && (
            <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2 shrink-0">
              <span>⚠️</span>
              <span className="text-[11px] text-amber-600 font-medium">
                Compra acima de {fmt(LIMITE_IDENTIFICACAO)} — identificação obrigatória (F6)
              </span>
            </div>
          )}

          {/* footer cupom */}
          <div className="shrink-0 border-t border-slate-200 bg-white">
            {cart.length > 0 && (
              <div className="px-4 py-1.5 border-b border-slate-200 flex gap-4">
                <span className="text-[11px] text-slate-400">Itens: <span className="text-slate-600 font-semibold">{cartQty}</span></span>
                <span className="text-[11px] text-slate-400">Produtos: <span className="text-slate-600 font-semibold">{cart.length}</span></span>
              </div>
            )}
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Valor total</p>
                <p className="text-[28px] font-extrabold text-orange-500 leading-none tracking-tight">{fmt(cartTotal)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-[11px] text-slate-600 font-semibold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                  {cartQty} {cartQty === 1 ? 'item' : 'itens'}
                </span>
                <button onClick={handleFinalizar}
                  className="bg-green-600 hover:bg-green-700 text-white text-[13px] font-bold px-5 py-2.5 rounded-lg border-none cursor-pointer shadow-md transition-all">
                  ✓ Finalizar venda
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── PRODUTOS (dir) ── */}
        <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">
          <div className="px-3 pt-3 pb-2 shrink-0">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou código..."
                className="w-full bg-white border-[1.5px] border-slate-200 focus:border-indigo-400 rounded-lg py-2 pl-8 pr-3 text-[13px] text-slate-900 outline-none transition-colors box-border" />
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px] gap-2">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Carregando produtos...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px]">Nenhum produto encontrado</div>
          ) : (
            <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
              <div className="px-3 py-1.5 border-b-[1.5px] border-slate-200 bg-slate-100 sticky top-0 z-10"
                style={{ display: 'grid', gridTemplateColumns: '80px 60px 48px 1fr 56px 72px' }}>
                {['EAN', 'Código', '', 'Descrição', 'Estoque', 'Preço'].map((h, i) => (
                  <span key={i} className={`text-[10px] text-slate-400 font-bold uppercase tracking-wide ${i >= 4 ? 'text-right' : ''}`}>{h}</span>
                ))}
              </div>
              {filtered.map((p, idx) => {
                const isSelected = selectedProd?.id === p.id
                const stockLabel = p.stock == null ? '∞' : p.stock <= 0 ? '0' : String(p.stock)
                const stockCls = p.stock == null ? 'text-slate-400' : p.stock <= 0 ? 'text-red-600' : p.stock <= 5 ? 'text-amber-600' : 'text-green-600'
                return (
                  <div key={p.id} onClick={() => setSelectedProd(p)}
                    style={{ display: 'grid', gridTemplateColumns: '80px 60px 48px 1fr 56px 72px', alignItems: 'center' }}
                    className={`px-3 py-1.5 border-b border-slate-200 cursor-pointer transition-colors border-l-[3px]
                      ${isSelected ? 'bg-indigo-50 border-l-indigo-500' : `border-l-transparent ${idx % 2 === 0 ? 'bg-white hover:bg-slate-100' : 'bg-slate-50 hover:bg-slate-100'}`}`}>
                    <span className="text-[10px] text-slate-400 font-mono truncate">{p.ean || '—'}</span>
                    <span className="text-[10px] text-slate-400 font-mono">#{fmtCode(p.code)}</span>
                    {p.image
                      ? <img src={p.image} alt="" className="w-9 h-9 object-cover rounded-md" onError={(e: any) => { e.target.style.display = 'none' }} />
                      : <div className="w-9 h-9 rounded-md bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-400">S/F</div>
                    }
                    <span className={`text-[12px] pl-1.5 pr-2 truncate ${isSelected ? 'text-indigo-500 font-semibold' : 'text-slate-900'}`}>{p.name}</span>
                    <span className={`text-[11px] font-semibold text-right ${stockCls}`}>{stockLabel}</span>
                    <span className="text-[12px] text-orange-500 font-bold text-right">{fmt(p.price)}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* bottom bar */}
          <div className="shrink-0 border-t border-slate-200 px-3 py-2.5 flex flex-col gap-2 bg-white">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 w-[76px] shrink-0 font-medium">Quantidade</span>
              <div className="flex items-center bg-slate-50 border-[1.5px] border-slate-200 rounded-lg overflow-hidden flex-1">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3.5 py-1.5 text-slate-500 text-lg bg-transparent border-none cursor-pointer leading-none">−</button>
                <span className="flex-1 text-center text-slate-900 font-bold text-sm">{qty}</span>
                <button onClick={() => setQty(q => q + 1)} className="px-3.5 py-1.5 text-slate-500 text-lg bg-transparent border-none cursor-pointer leading-none">+</button>
              </div>
              <button disabled={variantLoading}
                onClick={() => selectedProd ? checkAndAddToCart(selectedProd, qty) : showToast('Selecione um produto', 'err')}
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-70 disabled:cursor-not-allowed text-white text-xs font-bold px-3.5 py-2 rounded-lg border-none cursor-pointer whitespace-nowrap shadow-sm transition-all">
                {variantLoading ? 'Carregando...' : '+ Adicionar'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input type="text" value={codeInput} onChange={e => setCodeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddByCode()} placeholder="Código / EAN…"
                className="flex-1 bg-slate-50 border-[1.5px] border-slate-200 focus:border-indigo-400 rounded-lg py-1.5 px-3 text-[12px] text-slate-900 outline-none transition-colors" />
              <button onClick={handleAddByCode} className="text-[12px] text-slate-500 bg-slate-100 border-[1.5px] border-slate-200 rounded-lg px-3.5 py-1.5 cursor-pointer font-medium hover:bg-slate-200 transition-colors">Buscar</button>
              <button onClick={() => showToast('NFC-e requer configuração fiscal')} className="text-[12px] text-indigo-500 bg-indigo-50 border-[1.5px] border-indigo-200 rounded-lg py-1.5 px-3 cursor-pointer whitespace-nowrap font-semibold hover:bg-indigo-100 transition-colors">🧾 NFC-e</button>
            </div>
          </div>
        </div>
      </div>

{/* ── Toast ── */}
      {toast && (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white shadow-xl whitespace-nowrap
          ${toast.type === 'err' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Modal desconto ── */}
      {discModal && (
        <div className="absolute inset-0 bg-black/35 flex items-center justify-center z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-2xl">
            <h2 className="text-base font-bold text-slate-900">{discModal === 'item' ? 'Desconto no item' : 'Desconto no cupom'}</h2>
            <div className="relative">
              <input autoFocus type="text" inputMode="decimal" value={discValue} onChange={e => setDiscValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyDiscount()} placeholder="Ex: 10"
                className="w-full bg-slate-50 border-[1.5px] border-slate-200 rounded-lg py-2.5 pl-3 pr-9 text-slate-900 outline-none text-[15px] box-border" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">%</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDiscModal(null)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-500 bg-white cursor-pointer text-[13px] hover:bg-slate-50">Cancelar</button>
              <button onClick={applyDiscount} className="flex-1 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white border-none cursor-pointer text-[13px] font-bold">Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal consumidor ── */}
      {consumerModal && (
        <div className="absolute inset-0 bg-black/35 flex items-center justify-center z-50">
          <div className={`bg-white rounded-2xl p-6 w-[400px] flex flex-col gap-4 shadow-2xl border-[1.5px] ${consumerRequired ? 'border-amber-300' : 'border-slate-200'}`}>
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1">👤 Identificação do Consumidor</h2>
              <p className={`text-[11px] ${consumerRequired ? 'text-amber-600' : 'text-slate-400'}`}>
                {consumerRequired ? `⚠️ Obrigatório para compras acima de ${fmt(LIMITE_IDENTIFICACAO)}` : 'Busque um cliente cadastrado ou informe manualmente'}
              </p>
            </div>
            {consumerRequired && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                <span>⚠️</span>
                <p className="text-[12px] text-amber-600 leading-relaxed">Cupom totaliza <strong>{fmt(cartTotal)}</strong>. Identificação exigida acima de {fmt(LIMITE_IDENTIFICACAO)}.</p>
              </div>
            )}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              {(['search', 'manual'] as const).map(mode => (
                <button key={mode} onClick={() => setConsumerMode(mode)}
                  className={`flex-1 py-1.5 rounded-md text-[12px] font-semibold border-none cursor-pointer transition-all
                    ${consumerMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-slate-400'}`}>
                  {mode === 'search' ? '🔍 Buscar cadastrado' : '✏️ Informar manualmente'}
                </button>
              ))}
            </div>

            {consumerMode === 'search' && (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <input autoFocus type="text" value={customerSearch} onChange={e => searchCustomers(e.target.value)}
                    placeholder="Nome, CPF, CNPJ ou código interno..."
                    className="w-full bg-slate-50 border-[1.5px] border-slate-200 rounded-lg py-2.5 px-3 text-[13px] text-slate-900 outline-none box-border" />
                  {customerSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />}
                </div>
                {customerResults.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    {customerResults.map((c, idx) => (
                      <div key={c.id}
                        onClick={() => {
                          const name = c.razao_social ?? c.name; const cpf = c.cpf ?? c.cnpj ?? ''
                          setConsumer({ name, cpf }); setConsumerModal(false)
                          if (consumerRequired) { setConsumerRequired(false); setFinalModal(true); setChange('') }
                          else showToast(`Consumidor: ${name}`)
                        }}
                        className={`flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-indigo-50 transition-colors
                          ${idx > 0 ? 'border-t border-slate-200' : ''} ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                        <div className="min-w-0">
                          <p className="text-[13px] text-slate-900 font-semibold truncate">{c.name}</p>
                          <p className="text-[11px] text-slate-400">{c.cpf ? `CPF: ${c.cpf}` : c.cnpj ? `CNPJ: ${c.cnpj}` : 'Sem documento'} · cod. {String(c.code).padStart(4, '0')}</p>
                        </div>
                        <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full ml-2 shrink-0 font-semibold">{c.pessoa_tipo === 'juridica' ? 'PJ' : 'PF'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {customerSearch && !customerSearching && customerResults.length === 0 && (
                  <p className="text-[12px] text-slate-400 text-center py-2">
                    Nenhum cliente encontrado —{' '}
                    <button onClick={() => setConsumerMode('manual')} className="bg-transparent border-none text-indigo-500 cursor-pointer text-[12px] underline p-0">informar manualmente</button>
                  </p>
                )}
                {!consumerRequired && (
                  <button onClick={() => setConsumerModal(false)} className="py-2.5 rounded-lg border border-slate-200 text-slate-500 bg-white cursor-pointer text-[13px] hover:bg-slate-50">Cancelar</button>
                )}
              </div>
            )}

            {consumerMode === 'manual' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-500 font-semibold">Nome {consumerRequired && <span className="text-red-600">*</span>}</label>
                  <input autoFocus type="text" value={consumerName} onChange={e => setConsumerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveConsumer()} placeholder="Nome completo"
                    className="bg-slate-50 border-[1.5px] border-slate-200 rounded-lg py-2.5 px-3 text-[13px] text-slate-900 outline-none w-full box-border" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-500 font-semibold">CPF {consumerRequired && <span className="text-red-600">*</span>}</label>
                  <input type="text" inputMode="numeric" value={consumerCpf} onChange={e => setConsumerCpf(maskCpf(e.target.value))} onKeyDown={e => e.key === 'Enter' && saveConsumer()} placeholder="000.000.000-00"
                    className="bg-slate-50 border-[1.5px] border-slate-200 rounded-lg py-2.5 px-3 text-[13px] text-slate-900 outline-none w-full box-border" />
                </div>
                <div className="flex gap-2">
                  {!consumerRequired && <button onClick={() => setConsumerModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-500 bg-white cursor-pointer text-[13px]">Cancelar</button>}
                  <button onClick={saveConsumer} className="flex-[2] py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white border-none cursor-pointer text-[13px] font-bold">
                    {consumerRequired ? '✓ Salvar e finalizar' : 'Confirmar'}
                  </button>
                </div>
              </>
            )}

            {consumer && !consumerRequired && (
              <button onClick={() => { setConsumer(null); setConsumerModal(false); showToast('Consumidor removido') }}
                className="bg-transparent border-none text-red-500 text-[11px] cursor-pointer text-center underline">
                Remover identificação do cupom
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Modal finalizar ── */}
      {finalModal && (
        <div className="absolute inset-0 bg-black/35 flex items-center justify-center z-50">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-100 flex flex-col gap-4 shadow-2xl">
            <h2 className="text-base font-bold text-slate-900">Finalizar venda</h2>
            <div className="bg-slate-100 rounded-xl px-4 py-3 flex justify-between items-center border border-slate-200">
              <span className="text-slate-500 text-[13px] font-medium">Total</span>
              <span className="text-orange-500 text-2xl font-extrabold tracking-tight">{fmt(cartTotal)}</span>
            </div>
            {consumer && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span>👤</span>
                <div>
                  <p className="text-[12px] text-indigo-600 font-semibold">{consumer.name}</p>
                  {consumer.cpf && <p className="text-[10px] text-slate-400">CPF: {consumer.cpf}</p>}
                </div>
              </div>
            )}
            <div>
              <p className="text-[11px] text-slate-500 font-semibold mb-2">Forma de pagamento</p>
              <div className="grid grid-cols-3 gap-2">
                {(['dinheiro', 'pix', 'cartao'] as const).map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    className={`py-2.5 rounded-lg border-[1.5px] cursor-pointer text-[13px] transition-all
                      ${payMethod === m ? 'border-indigo-400 bg-indigo-50 text-indigo-600 font-semibold' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                    {m === 'dinheiro' ? 'Dinheiro' : m === 'pix' ? 'Pix' : 'Cartão'}
                  </button>
                ))}
              </div>
            </div>
            {payMethod === 'dinheiro' && (
              <div>
                <p className="text-[11px] text-slate-500 font-semibold mb-1.5">Valor recebido (para troco)</p>
                <input type="text" inputMode="decimal" value={change} onChange={e => setChange(e.target.value)} placeholder="0,00"
                  className="w-full bg-slate-50 border-[1.5px] border-slate-200 rounded-lg py-2.5 px-3 text-slate-900 outline-none text-[14px] box-border" />
                {change && !isNaN(parseFloat(change.replace(',', '.'))) && (
                  <p className="text-[12px] text-green-600 mt-1.5 font-semibold">Troco: {fmt(Math.max(0, parseFloat(change.replace(',', '.')) - cartTotal))}</p>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setFinalModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-500 bg-white cursor-pointer text-[13px] hover:bg-slate-50">Voltar</button>
              <button onClick={confirmVenda} className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white border-none cursor-pointer text-[13px] font-bold shadow-md">✓ Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal NFC-e ── */}
      {nfceModal && saleResult && (
        <div className="absolute inset-0 bg-black/45 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-[18px] p-7 w-[420px] flex flex-col gap-5 shadow-2xl border border-slate-200">
            <div className="text-center">
              <h2 className="text-[17px] font-bold text-slate-900 mb-1.5">Deseja emitir o cupom fiscal?</h2>
              <p className="text-[12px] text-slate-400 leading-relaxed">
                NFC-e nº <strong className="text-slate-600">{String(saleResult.nfceNumero).padStart(6, '0')}</strong>{' '}· Série <strong className="text-slate-600">{saleResult.serie}</strong>
              </p>
            </div>
            <div className="bg-slate-100 rounded-xl px-4 py-3 border border-slate-200 flex justify-between items-center">
              <span className="text-[13px] text-slate-500">Total da venda</span>
              <span className="text-xl font-extrabold text-orange-500">{fmt(cartTotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => handleEmitirNfce('normal')} disabled={nfceLoading !== null}
                className="py-3.5 rounded-xl border-none cursor-pointer bg-green-600 hover:bg-green-700 text-white text-[13px] font-bold flex flex-col items-center gap-1.5 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="text-xl">{nfceLoading === 'normal' ? '...' : 'S'}</span>
                <span>Emitir NFC-e</span>
                <span className="text-[10px] font-normal opacity-85">Online · SEFAZ</span>
              </button>
              <button onClick={() => handleEmitirNfce('contingencia')} disabled={nfceLoading !== null}
                className="py-3.5 rounded-xl border-[1.5px] border-amber-400 cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-600 text-[13px] font-bold flex flex-col items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="text-xl">{nfceLoading === 'contingencia' ? '...' : 'N'}</span>
                <span>Contingência</span>
                <span className="text-[10px] font-normal opacity-85">Offline · sincronizar depois</span>
              </button>
            </div>
            <button onClick={handlePularNfce} disabled={nfceLoading !== null}
              className="bg-transparent border-none text-slate-400 hover:text-slate-600 text-[12px] cursor-pointer underline text-center py-1 transition-colors">
              Não emitir agora
            </button>
          </div>
        </div>
      )}

      {/* ── Logs ── */}
      {logsModal && (
        <NfceLogsModal companyId={companyId} serie={serie} onClose={() => setLogsModal(false)}
          onRetentar={async (orderIds) => {
            showToast(orderIds.length === 1 ? 'Reemitindo cupom...' : `Reemitindo ${orderIds.length} cupons...`)
            let success = 0; let fail = 0
            for (const orderId of orderIds) {
              try {
                const { data: order, error } = await supabase.from('orders')
                  .select('id, nfce_numero, nfce_serie, items, total, payment_method, amount_received, change, consumer_name, cpf_cnpj_consumidor')
                  .eq('id', orderId).single()
                if (error || !order) { fail++; continue }
                const nfceItems = (order.items as any[]).map((item: any, idx: number) => ({
                  order: idx + 1, product_id: item.product_id, product_name: item.product_name,
                  ean: item.ean ?? null, quantity: item.quantity, unit_price: item.unit_price,
                  discount: item.discount ?? 0, ncm: item.ncm ?? '99999999', cfop: item.cfop ?? '5102', cst: item.cst ?? '400', unit: item.unit ?? 'UN',
                }))
                const totalNum = Number(order.total ?? 0); const receivedNum = Number(order.amount_received ?? 0)
                const troco = order.payment_method === 'dinheiro' && receivedNum > totalNum ? receivedNum - totalNum : 0
                const result = await emitirNfce({
                  companyId, orderId: order.id, nfceNumero: order.nfce_numero, serie: order.nfce_serie ?? serie,
                  items: nfceItems, paymentMethod: order.payment_method as any, total: totalNum, troco,
                  consumer: order.cpf_cnpj_consumidor ? { name: order.consumer_name ?? '', cpf: order.cpf_cnpj_consumidor } : null, contingencia: false,
                })
                if (result.ok) { success++ }
                else {
                  const motivo = result.cStat ? `[cStat ${result.cStat}] ${result.xMotivo}` : result.error ?? 'Erro desconhecido'
                  await supabase.from('orders').update({ nfce_status: 'rejeitado', nfce_motivo: motivo, nfce_cstat: result.cStat ?? null }).eq('id', orderId)
                  fail++
                }
              } catch (err: any) {
                await supabase.from('orders').update({ nfce_status: 'rejeitado', nfce_motivo: err.message ?? 'Erro desconhecido', nfce_cstat: null }).eq('id', orderId)
                fail++
              }
            }
            if (fail === 0) showToast(success === 1 ? 'NFC-e reemitida com sucesso' : `${success} NFC-e emitidas com sucesso`, 'ok')
            else if (success === 0) showToast(fail === 1 ? 'Falha ao reemitir — consulte F7' : `${fail} falhas — consulte F7`, 'err')
            else showToast(`${success} ok · ${fail} com falha — consulte F7`, 'err')
          }}
        />
      )}

      {/* ── Modal variante (cor + tamanho) ── */}
      {variantModal && (
        <div className="absolute inset-0 bg-black/45 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[18px] w-full max-w-[420px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            <div className="relative shrink-0">
              <img src={selectedVariant?.image ?? variantModal.product.image} alt={variantModal.product.name}
                className="w-full h-44 object-cover block" onError={(e: any) => { e.target.style.display = 'none' }} />
              <button onClick={() => setVariantModal(null)}
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/50 border-none cursor-pointer text-white flex items-center justify-center hover:bg-black/70 text-base">✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="px-5 py-4 border-b border-slate-200">
                <p className="text-[15px] font-bold text-slate-900">{variantModal.product.name}</p>
                <p className="text-[13px] text-orange-500 font-bold mt-1">{fmt(variantModal.product.price)}</p>
              </div>
              {/* cor */}
              <div className="px-5 py-3.5 border-b border-slate-200">
                <div className="flex justify-between mb-2.5">
                  <span className="text-[13px] font-semibold text-slate-900">Cor</span>
                  <span className="text-[11px] text-red-600 font-semibold">Obrigatório</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {variantModal.variants.map((v: any) => {
                    const isSelected = selectedVariant?.id === v.id
                    const outOfStock = v.sizes?.length ? v.sizes.every((s: any) => s.stock !== null && s.stock <= 0) : v.stock !== null && v.stock !== undefined && v.stock <= 0
                    return (
                      <button key={v.id} disabled={outOfStock} onClick={() => { setSelectedVariant(v); setSelectedSize(null) }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border-2 transition-all
                          ${outOfStock ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed line-through opacity-50'
                            : isSelected ? 'border-slate-900 bg-slate-900 text-white cursor-pointer'
                            : 'border-slate-200 bg-white text-slate-700 cursor-pointer hover:border-slate-400'}`}>
                        {v.color?.hex_code && <span className="w-3 h-3 rounded-full border border-slate-300 shrink-0" style={{ background: v.color.hex_code }} />}
                        {v.color?.name}
                      </button>
                    )
                  })}
                </div>
                {!selectedVariant && <p className="text-[11px] text-red-500 mt-2">Selecione uma cor para continuar</p>}
              </div>
              {/* tamanho */}
              {selectedVariant && selectedVariant.sizes?.length > 0 && (
                <div className="px-5 py-3.5 border-b border-slate-200">
                  <div className="flex justify-between mb-2.5">
                    <span className="text-[13px] font-semibold text-slate-900">Tamanho</span>
                    <span className="text-[11px] text-red-600 font-semibold">Obrigatório</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedVariant.sizes.map((s: any) => {
                      const outOfStock = s.stock !== null && s.stock <= 0
                      const isSelected = selectedSize === s.value
                      return (
                        <button key={s.value} disabled={outOfStock} onClick={() => setSelectedSize(s.value)}
                          className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold border-2 transition-all
                            ${outOfStock ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed line-through opacity-50'
                              : isSelected ? 'border-slate-900 bg-slate-900 text-white cursor-pointer'
                              : 'border-slate-200 bg-white text-slate-700 cursor-pointer hover:border-slate-400'}`}>
                          {s.value}
                          {s.stock !== null && s.stock > 0 && <span className="ml-1 text-[10px] opacity-60">({s.stock})</span>}
                        </button>
                      )
                    })}
                  </div>
                  {!selectedSize && <p className="text-[11px] text-red-500 mt-2">Selecione um tamanho para continuar</p>}
                </div>
              )}
            </div>
            <div className="shrink-0 px-5 py-3.5 border-t border-slate-200 bg-white flex gap-2.5">
              <button onClick={() => setVariantModal(null)} className="flex-1 py-3 rounded-xl border border-slate-200 bg-white text-slate-500 text-[13px] cursor-pointer hover:bg-slate-50">Cancelar</button>
              <button onClick={handleConfirmVariant}
                disabled={!selectedVariant || (selectedVariant.sizes?.length > 0 && !selectedSize)}
                className="flex-[2] py-3 rounded-xl border-none text-[13px] font-bold cursor-pointer transition-all bg-green-600 hover:bg-green-700 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">
                + Adicionar · {fmt(variantModal.product.price)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal tamanho simples (sem cor) — NOVO ── */}
      {sizeModal && (
        <div className="absolute inset-0 bg-black/45 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[18px] w-full max-w-[380px] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            <div className="relative shrink-0 bg-slate-50">
              <img src={sizeModal.product.image} alt={sizeModal.product.name}
                className="w-full aspect-[3/4] object-contain block" onError={(e: any) => { e.target.style.display = 'none' }} />
              <button onClick={() => setSizeModal(null)}
                className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/50 border-none cursor-pointer text-white flex items-center justify-center hover:bg-black/70 text-base">✕</button>
            </div>
            <div className="px-5 py-4 border-b border-slate-200">
              <p className="text-[15px] font-bold text-slate-900">{sizeModal.product.name}</p>
              <p className="text-[13px] text-orange-500 font-bold mt-1">{fmt(sizeModal.product.price)}</p>
            </div>
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="flex justify-between mb-3">
                <span className="text-[13px] font-semibold text-slate-900">Tamanho</span>
                <span className="text-[11px] text-red-600 font-semibold">Obrigatório</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizeModal.sizes.map((s: any) => {
                  const outOfStock = s.stock !== null && s.stock <= 0
                  const isSelected = selectedSizeOnly === s.value
                  return (
                    <button key={s.value} disabled={outOfStock} onClick={() => setSelectedSizeOnly(s.value)}
                      className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold border-2 transition-all
                        ${outOfStock ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed line-through opacity-50'
                          : isSelected ? 'border-slate-900 bg-slate-900 text-white cursor-pointer'
                          : 'border-slate-200 bg-white text-slate-700 cursor-pointer hover:border-slate-400'}`}>
                      {s.value}
                      {s.stock !== null && s.stock > 0 && <span className="ml-1 text-[10px] opacity-60">({s.stock})</span>}
                    </button>
                  )
                })}
              </div>
              {!selectedSizeOnly && <p className="text-[11px] text-red-500 mt-2">Selecione um tamanho para continuar</p>}
            </div>
            <div className="px-5 py-3.5 flex gap-2.5">
              <button onClick={() => setSizeModal(null)} className="flex-1 py-3 rounded-xl border border-slate-200 bg-white text-slate-500 text-[13px] cursor-pointer hover:bg-slate-50">Cancelar</button>
              <button onClick={handleConfirmSizeOnly} disabled={!selectedSizeOnly}
                className="flex-[2] py-3 rounded-xl border-none text-[13px] font-bold cursor-pointer transition-all bg-green-600 hover:bg-green-700 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">
                + Adicionar · {fmt(sizeModal.product.price)}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelVendaModal && (
      <CancelarVendaModal
        companyId={companyId}
        cashRegisterId={cashRegisterId}
        onClose={() => setCancelVendaModal(false)}
        onCancelado={(msg) => {
          setCancelVendaModal(false)
          refetchProducts({ silent: true })
          showToast(msg, 'ok')
        }}
      />
    )}
    </div>
  )
}