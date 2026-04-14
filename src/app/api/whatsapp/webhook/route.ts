import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ── Tipos da sessão ───────────────────────────────────────────────────────────

type SessionState = {
  step:
    | 'menu'
    | 'order_menu_view'
    | 'order_cart'
    | 'order_name'
    | 'order_phone'
    | 'order_delivery_type'
    | 'order_address'
    | 'order_payment'
    | 'order_cpf'
    | 'order_payment_method'
    | 'order_card_number'
    | 'order_card_expiry'
    | 'order_card_cvv'
    | 'order_card_name'
    | 'order_confirm'
    | 'order_awaiting_payment'
    | 'order_query_code'
    | 'done'
  name?: string
  phone?: string
  deliveryType?: 'delivery' | 'pickup'
  address?: string
  paymentMethod?: string
  paymentGateway?: 'pix' | 'card'
  cpf?: string
  cardNumber?: string
  cardExpiry?: string
  cardCvv?: string
  cardName?: string
  pendingOrderId?: number
  pendingOrderCode?: string
  cart?: { product_id: number; product_name: string; quantity: number; unit_price: number }[]
  total?: number
  products?: { id: number; name: string; price: number; description?: string; category: string }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSession(phone: string): Promise<SessionState> {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('state')
    .eq('phone', phone)
    .single()

  console.log(`[SESSION GET] phone=${phone} state=${JSON.stringify(data?.state)} error=${JSON.stringify(error)}`)
  return (data?.state as SessionState) ?? { step: 'menu' }
}

async function saveSession(phone: string, state: SessionState) {
  const { error } = await supabase
    .from('whatsapp_sessions')
    .upsert({ phone, state, updated_at: new Date().toISOString() }, { onConflict: 'phone' })

  console.log(`[SESSION SAVE] phone=${phone} step=${state.step} error=${JSON.stringify(error)}`)
}

async function resetSession(phone: string) {
  await saveSession(phone, { step: 'menu' })
}

function formatAddress(raw: string) {
  const parts = raw.split(',').map(p => p.trim())
  return {
    street:   parts[0] ?? '',
    number:   parts[1] ?? '',
    district: parts[2] ?? '',
    city:     parts[3] ?? '',
    state:    parts[4] ?? '',
  }
}

function isValidCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, '')
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i)
  let r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(c[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i)
  r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(c[10])
}

function formatCPF(cpf: string): string {
  const c = cpf.replace(/\D/g, '')
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`
}

async function fetchGeneratedCode(id: number): Promise<string> {
  const { data } = await supabase.from('orders').select('code').eq('id', id).single()
  return data?.code ?? id.toString()
}

function restartTip(): string {
  return `\n\n_Digite *reiniciar* a qualquer momento para recomeçar o atendimento._`
}

// ── Z-API: envia texto ────────────────────────────────────────────────────────

async function sendZAPIMessage(phone: string, message: string): Promise<void> {
  const instanceId  = process.env.ZAPI_INSTANCE
  const token       = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token || !clientToken) {
    console.error('Z-API: variáveis não configuradas.')
    return
  }

  const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '')
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
    body: JSON.stringify({ phone: cleanPhone, message }),
  })

  if (!res.ok) console.error(`Z-API erro ${res.status}:`, await res.text())
}

// ── Z-API: envia imagem ───────────────────────────────────────────────────────

async function sendZAPIImage(phone: string, base64Image: string, caption: string): Promise<void> {
  const instanceId  = process.env.ZAPI_INSTANCE
  const token       = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token || !clientToken) {
    console.error('Z-API: variáveis não configuradas.')
    return
  }

  const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@c.us', '')
  // Remove o prefixo "data:image/png;base64," se existir
  const imageData = base64Image.replace(/^data:image\/\w+;base64,/, '')

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-image`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
    body: JSON.stringify({
      phone:   cleanPhone,
      image:   imageData, // base64 puro, sem prefixo
      caption,
    }),
  })

  if (!res.ok) console.error(`Z-API imagem erro ${res.status}:`, await res.text())
}

// ── Mercado Pago: tokeniza cartão server-side ─────────────────────────────────

async function tokenizeCard(session: SessionState): Promise<{
  token?: string; paymentMethodId?: string; issuerId?: string; error?: string
}> {
  const [expMonth, expYear] = (session.cardExpiry ?? '').split('/')

  const body = {
    card_number:      session.cardNumber?.replace(/\D/g, ''),
    expiration_month: parseInt(expMonth ?? '0'),
    expiration_year:  parseInt(`20${expYear ?? '00'}`),
    security_code:    session.cardCvv,
    cardholder: {
      name: session.cardName,
      identification: { type: 'CPF', number: session.cpf?.replace(/\D/g, '') },
    },
  }

  try {
    const res = await fetch('https://api.mercadopago.com/v1/card_tokens', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.MERCADOPAGO_TOKEN}`,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = data.cause?.[0]?.description ?? data.message ?? 'Dados do cartão inválidos'
      console.error('[TOKENIZE ERROR]', data)
      return { error: msg }
    }

    return {
      token:           data.id,
      paymentMethodId: data.payment_method_id ?? detectBrand(session.cardNumber ?? ''),
      issuerId:        data.issuer_id?.toString(),
    }
  } catch (err) {
    console.error('[TOKENIZE FETCH ERROR]', err)
    return { error: 'Erro ao comunicar com o gateway.' }
  }
}

function detectBrand(cardNumber: string): string {
  const num = cardNumber.replace(/\D/g, '')
  if (/^4/.test(num))               return 'visa'
  if (/^5[1-5]/.test(num))          return 'master'
  if (/^3[47]/.test(num))           return 'amex'
  if (/^(606282|3841)/.test(num))   return 'hipercard'
  if (/^(636368|438935)/.test(num)) return 'elo'
  return 'master'
}

// ── Processa pagamento com cartão ─────────────────────────────────────────────

async function processCardPayment(
  session: SessionState, orderId: number, orderCode: string
): Promise<{ success: boolean; status?: string; transactionId?: string; message?: string }> {

  const tokenResult = await tokenizeCard(session)
  if (tokenResult.error) return { success: false, message: tokenResult.error }

  const items = (session.cart ?? []).map(item => ({
    product_id:   item.product_id,
    product_name: item.product_name,
    quantity:     item.quantity,
    unit_price:   Number(item.unit_price),
    subtotal:     item.quantity * Number(item.unit_price),
  }))

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/card`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        orderCode,
        total:           session.total,
        customerName:    session.name,
        customerEmail:   'cliente@pedido.com',
        customerTaxId:   session.cpf?.replace(/\D/g, ''),
        token:           tokenResult.token,
        paymentMethodId: tokenResult.paymentMethodId,
        issuerId:        tokenResult.issuerId,
        installments:    1,
        items,
      }),
    })

    const data = await res.json()
    if (!res.ok) return { success: false, message: data.error ?? 'Cartão recusado.' }

    if (data.status === 'approved')   return { success: true, status: 'approved',   transactionId: String(data.mercadoPagoId) }
    if (data.status === 'in_process') return { success: true, status: 'in_process', transactionId: String(data.mercadoPagoId) }

    const rejectionMessages: Record<string, string> = {
      cc_rejected_bad_filled_card_number:   'Número do cartão incorreto.',
      cc_rejected_bad_filled_date:          'Data de vencimento incorreta.',
      cc_rejected_bad_filled_security_code: 'Código de segurança incorreto.',
      cc_rejected_bad_filled_other:         'Dados do cartão incorretos.',
      cc_rejected_insufficient_amount:      'Saldo insuficiente no cartão.',
      cc_rejected_blacklist:                'Cartão bloqueado. Contate seu banco.',
      cc_rejected_call_for_authorize:       'Pagamento não autorizado. Contate seu banco.',
      cc_rejected_card_disabled:            'Cartão desativado. Contate seu banco.',
      cc_rejected_duplicated_payment:       'Pagamento duplicado detectado.',
      cc_rejected_high_risk:                'Pagamento recusado por risco. Contate seu banco.',
    }
    return { success: false, message: rejectionMessages[data.statusDetail] ?? 'Pagamento recusado pelo banco.' }
  } catch (err) {
    console.error('[CARD PAYMENT ERROR]', err)
    return { success: false, message: 'Erro ao processar o pagamento.' }
  }
}

// ── Menu principal ────────────────────────────────────────────────────────────

function menuText(): string {
  return (
    `👋 Olá! Bem-vindo ao nosso atendimento.\n\n` +
    `Escolha uma opção:\n` +
    `1️⃣ - Fazer pedido\n` +
    `2️⃣ - Cardápio do dia\n` +
    `3️⃣ - Dúvidas sobre meu pedido\n\n` +
    `Digite o número da opção desejada.`
  )
}

// ── Lógica principal ──────────────────────────────────────────────────────────

// Retorna o texto a ser enviado via sendZAPIMessage.
// Quando o fluxo Pix envia as mensagens diretamente, retorna '' para o
// handler não duplicar o envio.
async function processMessage(phone: string, text: string): Promise<string> {
  const msg     = text.trim().toLowerCase()
  const session = await getSession(phone)

  console.log(`[PROCESS] phone=${phone} msg="${msg}" step=${session.step}`)

  if (msg === '0' || msg === 'menu' || msg === 'voltar' || msg === 'reiniciar') {
    await resetSession(phone)
    return menuText()
  }

  // ── Menu ──────────────────────────────────────────────────────────────────
  if (session.step === 'menu') {
    if (msg === '1') {
      const { data: products } = await supabase
        .from('products').select('id, name, price, description, category').eq('active', true).order('category')

      if (!products || products.length === 0)
        return `😔 Não há produtos disponíveis.\n\nDigite *0* para voltar ao menu.`

      const grouped = products.reduce<Record<string, typeof products>>((acc, p) => {
        if (!acc[p.category]) acc[p.category] = []
        acc[p.category].push(p)
        return acc
      }, {})

      let menu = `🍽️ *Cardápio*\n\n`
      let index = 1
      const flatProducts: any[] = []

      for (const [category, items] of Object.entries(grouped)) {
        menu += `*${category.toUpperCase()}*\n`
        for (const item of items) {
          menu += `${index}️⃣ - ${item.name} — R$ ${Number(item.price).toFixed(2)}\n`
          if (item.description) menu += `   ${item.description}\n`
          flatProducts.push(item)
          index++
        }
        menu += `\n`
      }

      menu += `🛒 Digite o número do produto para adicionar ao carrinho.\nDigite *finalizar* para concluir o pedido.` + restartTip()
      await saveSession(phone, { step: 'order_cart', cart: [], products: flatProducts } as any)
      return menu
    }

    if (msg === '2') {
      const { data: products } = await supabase
        .from('products').select('name, price, description, category').eq('active', true).order('category')

      if (!products || products.length === 0)
        return `😔 Não há produtos disponíveis.\n\nDigite *0* para voltar ao menu.`

      const grouped = products.reduce<Record<string, typeof products>>((acc, p) => {
        if (!acc[p.category]) acc[p.category] = []
        acc[p.category].push(p)
        return acc
      }, {})

      let menu = `🍽️ *Cardápio do dia*\n\n`
      for (const [category, items] of Object.entries(grouped)) {
        menu += `*${category.toUpperCase()}*\n`
        for (const item of items) {
          menu += `• ${item.name} — R$ ${Number(item.price).toFixed(2)}\n`
          if (item.description) menu += `  _${item.description}_\n`
        }
        menu += `\n`
      }
      return menu + `Digite *0* para voltar ao menu.`
    }

    if (msg === '3') {
      await saveSession(phone, { step: 'order_query_code' })
      return `🔍 Por favor, informe o *código do seu pedido* (ex: 173):` + restartTip()
    }

    return menuText()
  }

  // ── Visualizar cardápio ───────────────────────────────────────────────────
  if (session.step === 'order_menu_view') {
    if (msg !== 'continuar') return `Digite *continuar* para iniciar seu pedido.` + restartTip()
    await saveSession(phone, { step: 'order_name' })
    return `📝 Vamos começar seu pedido!\n\nQual é o seu *nome*?` + restartTip()
  }

  // ── Carrinho ──────────────────────────────────────────────────────────────
  if (session.step === 'order_cart') {
    const products = (session as any).products || []
    if (!products.length) return `Erro ao carregar produtos.` + restartTip()

    if (msg === 'finalizar') {
      if (!session.cart || session.cart.length === 0) return `🛒 Seu carrinho está vazio.` + restartTip()
      await saveSession(phone, { ...session, step: 'order_name' })
      return `📝 Vamos continuar!\n\nQual é o seu *nome*?` + restartTip()
    }

    const index = parseInt(msg)
    if (isNaN(index) || index < 1 || index > products.length)
      return `Digite um número válido ou *finalizar*.` + restartTip()

    const product = products[index - 1]
    let updatedCart = [...(session.cart || [])]
    const existingItem = updatedCart.find(p => p.product_id === product.id)

    if (existingItem) {
      updatedCart = updatedCart.map(item =>
        item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      )
    } else {
      updatedCart.push({ product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.price })
    }

    const total = updatedCart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    await saveSession(phone, { ...session, cart: updatedCart, total })

    let cartText = `✅ *${product.name}* adicionado!\n\n🛒 *Carrinho:*\n`
    updatedCart.forEach(item => { cartText += `• ${item.product_name} x${item.quantity}\n` })
    cartText += `\n💰 Total: R$ ${total.toFixed(2)}\n\nDigite outro número para adicionar mais itens ou *finalizar*.`
    return cartText + restartTip()
  }

  // ── Consulta de pedido ────────────────────────────────────────────────────
  if (session.step === 'order_query_code') {
    const code = text.trim()
    const { data: order } = await supabase
      .from('orders').select('code, status, total, created_at, delivery_type').eq('code', code).single()

    await resetSession(phone)

    if (!order) return `❌ Pedido *${code}* não encontrado.\n\nDigite *0* para voltar ao menu.`

    const statusMap: Record<string, string> = {
      pending:    '⏳ Aguardando confirmação',
      confirmed:  '✅ Confirmado',
      preparing:  '👨‍🍳 Em preparo',
      ready:      '✅ Pronto para retirada',
      delivering: '🛵 Saiu para entrega',
      completed:  '✅ Entregue',
      cancelled:  '❌ Cancelado',
      in_process: '🔄 Pagamento em análise',
    }

    return (
      `📦 *Pedido ${order.code}*\n` +
      `Status: ${statusMap[order.status] ?? order.status}\n` +
      `Total: R$ ${Number(order.total).toFixed(2)}\n` +
      `Tipo: ${order.delivery_type === 'pickup' ? 'Retirada' : 'Entrega'}\n\n` +
      `Digite *0* para voltar ao menu.`
    )
  }

  // ── Nome ──────────────────────────────────────────────────────────────────
  if (session.step === 'order_name') {
    const name = text.trim()
    if (name.length < 2 || /^\d+$/.test(name))
      return `Por favor, digite o seu *nome* para continuarmos. 😊` + restartTip()
    await saveSession(phone, { ...session, step: 'order_phone', name })
    return `Ótimo, *${name}*! 😊\n\nQual é o seu *número de telefone* com DDD?` + restartTip()
  }

  // ── Telefone ──────────────────────────────────────────────────────────────
  if (session.step === 'order_phone') {
    const phoneInput = text.trim().replace(/\D/g, '')
    if (phoneInput.length < 10 || phoneInput.length > 11)
      return `Por favor, digite um *telefone válido* com DDD.\nExemplo: 83986570076` + restartTip()
    await saveSession(phone, { ...session, step: 'order_delivery_type', phone: phoneInput })
    return (
      `📱 Telefone registrado!\n\n` +
      `📦 Como você prefere receber seu pedido?\n\n` +
      `1️⃣ - Entrega no endereço\n` +
      `2️⃣ - Retirar na loja` +
      restartTip()
    )
  }

  // ── Tipo de entrega ───────────────────────────────────────────────────────
  if (session.step === 'order_delivery_type') {
    if (msg !== '1' && msg !== '2')
      return `Por favor, digite *1* para entrega ou *2* para retirada.` + restartTip()

    const deliveryType = msg === '1' ? 'delivery' : 'pickup'
    await saveSession(phone, {
      ...session,
      step: deliveryType === 'pickup' ? 'order_payment' : 'order_address',
      deliveryType,
    })

    if (deliveryType === 'pickup') {
      return (
        `📦 Você escolheu *retirada na loja*.\n\n` +
        `💳 Como você prefere pagar?\n\n` +
        `1️⃣ - Pagar agora (Pix ou Cartão)\n` +
        `2️⃣ - Pagar na retirada` +
        restartTip()
      )
    }
    return `📍 Informe seu *endereço completo*:\n\n_Rua, Número, Bairro, Cidade, UF_` + restartTip()
  }

  // ── Endereço ──────────────────────────────────────────────────────────────
  if (session.step === 'order_address') {
    await saveSession(phone, { ...session, step: 'order_payment', address: text.trim() })
    return (
      `💳 Como você prefere pagar?\n\n` +
      `1️⃣ - Pagar agora (Pix ou Cartão)\n` +
      `2️⃣ - Pagar na entrega` +
      restartTip()
    )
  }

  // ── Forma de pagamento ────────────────────────────────────────────────────
  if (session.step === 'order_payment') {
    if (msg !== '1' && msg !== '2')
      return `Por favor, digite *1* para pagar agora ou *2* para pagar na entrega/retirada.` + restartTip()

    if (msg === '2') {
      const paymentMethod = session.deliveryType === 'pickup' ? 'na-retirada' : 'na-entrega'
      await saveSession(phone, { ...session, step: 'order_confirm', paymentMethod })

      const deliveryLabel = session.deliveryType === 'pickup' ? 'Retirada na loja' : `Entrega em: ${session.address}`
      const paymentLabel  = session.deliveryType === 'pickup' ? 'Na retirada' : 'Na entrega'
      const total = session.total ?? 0
      const itemsText = (session.cart ?? [])
        .map(i => `  • ${i.product_name} x${i.quantity} — R$ ${(i.quantity * i.unit_price).toFixed(2)}`).join('\n')

      return (
        `📋 *Resumo do pedido:*\n\n` +
        `👤 Nome: ${session.name}\n` +
        `📦 ${deliveryLabel}\n` +
        `💳 Pagamento: ${paymentLabel}\n\n` +
        `🛒 *Itens:*\n${itemsText}\n\n` +
        `💰 *Total: R$ ${total.toFixed(2)}*\n\n` +
        `Digite *confirmar* para finalizar seu pedido.\nDigite *0* para cancelar.` +
        restartTip()
      )
    }

    // Pagar agora → pede CPF
    await saveSession(phone, { ...session, step: 'order_cpf', paymentMethod: 'online' })
    return (
      `📄 Para processar o pagamento, precisamos do seu *CPF*.\n\n` +
      `Digite apenas os números (11 dígitos):` +
      restartTip()
    )
  }

  // ── CPF ───────────────────────────────────────────────────────────────────
  if (session.step === 'order_cpf') {
    const cpfRaw = text.trim().replace(/\D/g, '')
    if (!isValidCPF(cpfRaw))
      return `❌ CPF inválido. Por favor, digite um *CPF válido* (11 números):` + restartTip()

    await saveSession(phone, { ...session, step: 'order_payment_method', cpf: cpfRaw })
    return (
      `✅ CPF registrado!\n\n` +
      `💳 Como você prefere pagar?\n\n` +
      `1️⃣ - Pix (mais rápido ⚡)\n` +
      `2️⃣ - Cartão de crédito/débito` +
      restartTip()
    )
  }

  // ── Pix ou Cartão ─────────────────────────────────────────────────────────
  if (session.step === 'order_payment_method') {
    if (msg !== '1' && msg !== '2')
      return `Por favor, digite *1* para Pix ou *2* para Cartão.` + restartTip()

    if (msg === '1') {
      // ── Fluxo Pix ────────────────────────────────────────────────────────
      const addressParsed = session.address ? formatAddress(session.address) : null
      const items = (session.cart ?? []).map(item => ({
        product_id:   item.product_id,
        product_name: item.product_name,
        quantity:     item.quantity,
        unit_price:   Number(item.unit_price),
        subtotal:     item.quantity * Number(item.unit_price),
      }))
      const total = items.reduce((s, i) => s + i.subtotal, 0)

      const { data: inserted, error } = await supabase
        .from('orders')
        .insert([{
          customer:       session.name,
          customer_phone: session.phone ?? phone,
          total,
          status:         'pending',
          items,
          address:        addressParsed,
          delivery_type:  session.deliveryType,
          payment_method: 'pix',
        }])
        .select('id').single()

      if (error) {
        console.error('[ORDER ERROR]', error)
        await resetSession(phone)
        return `❌ Erro ao criar pedido.` + restartTip()
      }

      const code = await fetchGeneratedCode(inserted.id)

      const pixRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/pix`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId:       inserted.id,
          orderCode:     code,
          total,
          customerName:  session.name,
          customerEmail: 'cliente@pedido.com',
          customerTaxId: session.cpf,
          items,
        }),
      })

      const pixData = await pixRes.json()
      console.log('[PIX DATA]', JSON.stringify(pixData))

      // Falhou ou não veio o copia e cola → cancela pedido e avisa
      if (!pixRes.ok || !pixData.pixCode) {
        console.error('[PIX ERROR]', pixData)
        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', inserted.id)
        await resetSession(phone)
        return `❌ Erro ao gerar Pix. Tente novamente ou escolha outro método de pagamento.` + restartTip()
      }

      // Salva sessão aguardando pagamento
      await saveSession(phone, {
        ...session,
        step:             'order_awaiting_payment',
        paymentGateway:   'pix',
        pendingOrderId:   inserted.id,
        pendingOrderCode: code,
        total,
      })

      // Monta mensagem com copia e cola
      const pixMessage =
        `💸 *Pagamento via Pix*\n\n` +
        `📦 Pedido: *${code}*\n` +
        `💰 Total: R$ ${total.toFixed(2)}\n` +
        `👤 CPF: ${formatCPF(session.cpf!)}\n\n` +
        `📲 *Copia e cola:*\n${pixData.pixCode}\n\n` +
        `⏳ Válido até: ${pixData.expiresAt}\n\n` +
        `Após o pagamento, seu pedido será confirmado automaticamente. ✅\n\n` +
        `_Envie qualquer mensagem para verificar se o pagamento foi confirmado._`

      // 1. Envia o texto SEMPRE primeiro — garante que o cliente receba o copia e cola
      await sendZAPIMessage(phone, pixMessage)

      // 2. Tenta enviar o QR Code como imagem (fire and forget — falha não bloqueia)
      if (pixData.qrCodeImage) {
        sendZAPIImage(
          phone,
          String(pixData.qrCodeImage),
          `🔳 QR Code — Pedido *${code}* — R$ ${total.toFixed(2)}`,
        ).catch(err => console.error('[QR IMAGE ERROR]', err))
      }

      // Retorna '' pois o texto já foi enviado diretamente acima
      return ''
    }

    // ── Fluxo Cartão ──────────────────────────────────────────────────────
    await saveSession(phone, { ...session, step: 'order_card_number', paymentGateway: 'card' })
    return (
      `💳 *Pagamento com Cartão*\n\n` +
      `⚠️ _Seus dados são processados com segurança pelo Mercado Pago e não ficam armazenados._\n\n` +
      `Digite o *número do cartão* (somente números):` +
      restartTip()
    )
  }

  // ── Coleta de dados do cartão ─────────────────────────────────────────────

  if (session.step === 'order_card_number') {
    const num = text.trim().replace(/\D/g, '')
    if (num.length < 13 || num.length > 19)
      return `❌ Número inválido. Digite os *números do cartão*:` + restartTip()
    await saveSession(phone, { ...session, step: 'order_card_expiry', cardNumber: num })
    return `📅 Digite a *validade* no formato *MM/AA*:\n_Exemplo: 08/27_` + restartTip()
  }

  if (session.step === 'order_card_expiry') {
    const exp = text.trim()
    if (!/^\d{2}\/\d{2}$/.test(exp))
      return `❌ Formato inválido. Digite como *MM/AA* (ex: 08/27):` + restartTip()
    await saveSession(phone, { ...session, step: 'order_card_cvv', cardExpiry: exp })
    return `🔒 Digite o *código de segurança* (CVV — 3 ou 4 dígitos no verso do cartão):` + restartTip()
  }

  if (session.step === 'order_card_cvv') {
    const cvv = text.trim().replace(/\D/g, '')
    if (cvv.length < 3 || cvv.length > 4)
      return `❌ CVV inválido. Digite o *código de segurança* (3 ou 4 dígitos):` + restartTip()
    await saveSession(phone, { ...session, step: 'order_card_name', cardCvv: cvv })
    return `👤 Digite o *nome* exatamente como aparece no cartão:` + restartTip()
  }

  if (session.step === 'order_card_name') {
    const cardName = text.trim().toUpperCase()
    if (cardName.length < 3)
      return `❌ Nome inválido. Digite o *nome completo* como está no cartão:` + restartTip()

    const addressParsed = session.address ? formatAddress(session.address) : null
    const items = (session.cart ?? []).map(item => ({
      product_id:   item.product_id,
      product_name: item.product_name,
      quantity:     item.quantity,
      unit_price:   Number(item.unit_price),
      subtotal:     item.quantity * Number(item.unit_price),
    }))
    const total = items.reduce((s, i) => s + i.subtotal, 0)

    const { data: inserted, error } = await supabase
      .from('orders')
      .insert([{
        customer:       session.name,
        customer_phone: session.phone ?? phone,
        total,
        status:         'pending',
        items,
        address:        addressParsed,
        delivery_type:  session.deliveryType,
        payment_method: 'card',
      }])
      .select('id').single()

    if (error) {
      console.error('[ORDER ERROR]', error)
      await resetSession(phone)
      return `❌ Erro ao criar pedido.` + restartTip()
    }

    const code = await fetchGeneratedCode(inserted.id)

    const cardResult = await processCardPayment({ ...session, cardName, total }, inserted.id, code)

    if (!cardResult.success) {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', inserted.id)
      await resetSession(phone)
      return (
        `❌ *Pagamento recusado*\n\n` +
        `Motivo: ${cardResult.message ?? 'Cartão não autorizado.'}\n\n` +
        `Verifique os dados e tente novamente ou escolha outro método.\n\n` +
        `Digite *0* para voltar ao menu.`
      )
    }

    if (cardResult.status === 'in_process') {
      await supabase.from('orders')
        .update({ status: 'in_process', payment_gateway_id: cardResult.transactionId })
        .eq('id', inserted.id)

      await saveSession(phone, {
        ...session,
        cardName,
        step:             'order_awaiting_payment',
        paymentGateway:   'card',
        pendingOrderId:   inserted.id,
        pendingOrderCode: code,
        total,
      })

      return (
        `🔄 *Pagamento em análise*\n\n` +
        `📦 Pedido: *${code}*\n` +
        `💰 Total: R$ ${total.toFixed(2)}\n\n` +
        `O Mercado Pago está analisando seu pagamento.\n` +
        `Você será notificado quando for confirmado. ⏳\n\n` +
        `_Envie qualquer mensagem para verificar o status._`
      )
    }

    // Aprovado!
    await supabase.from('orders')
      .update({ status: 'confirmed', payment_gateway_id: cardResult.transactionId })
      .eq('id', inserted.id)
    await resetSession(phone)

    return (
      `✅ *Pagamento aprovado!*\n\n` +
      `📦 Pedido: *${code}*\n` +
      `💰 Total: R$ ${total.toFixed(2)}\n` +
      `💳 Final do cartão: **** ${session.cardNumber?.slice(-4)}\n\n` +
      `Seu pedido foi confirmado e está sendo preparado! 🎉\n\n` +
      `Guarde o código *${code}* para acompanhar o status.`
    )
  }

  // ── Aguardando pagamento (Pix ou cartão in_process) ───────────────────────
  if (session.step === 'order_awaiting_payment') {
    if (!session.pendingOrderId) { await resetSession(phone); return menuText() }

    const { data: order } = await supabase
      .from('orders').select('status, code, total').eq('id', session.pendingOrderId).single()

    if (!order) { await resetSession(phone); return `❌ Pedido não encontrado.\n\nDigite *0* para voltar ao menu.` }

    if (order.status === 'confirmed' || order.status === 'preparing') {
      await resetSession(phone)
      return (
        `✅ *Pagamento confirmado!*\n\n` +
        `📦 Pedido: *${order.code}*\n` +
        `💰 Total: R$ ${Number(order.total).toFixed(2)}\n\n` +
        `Seu pedido está sendo preparado! 🎉\n\n` +
        `Guarde o código *${order.code}* para acompanhar o status.`
      )
    }

    if (order.status === 'cancelled') {
      await resetSession(phone)
      return `❌ Pedido *${order.code}* foi cancelado (pagamento expirado ou não recebido).\n\nDigite *0* para um novo pedido.`
    }

    const detail = session.paymentGateway === 'pix'
      ? `Se já realizou o Pix, aguarde até 1 minuto — a confirmação é automática.`
      : `Seu pagamento ainda está sendo analisado pelo Mercado Pago.`

    return (
      `⏳ *Aguardando pagamento...*\n\n` +
      `📦 Pedido: *${order.code}*\n\n` +
      `${detail}\n\n` +
      `_Envie qualquer mensagem para verificar novamente._\n` +
      `_Digite *reiniciar* para cancelar e recomeçar._`
    )
  }

  // ── Confirmação (pagamento posterior) ─────────────────────────────────────
  if (session.step === 'order_confirm' && msg === 'confirmar') {
    const addressParsed = session.address ? formatAddress(session.address) : null
    const items = (session.cart ?? []).map(item => ({
      product_id:   item.product_id,
      product_name: item.product_name,
      quantity:     item.quantity,
      unit_price:   Number(item.unit_price),
      subtotal:     item.quantity * Number(item.unit_price),
    }))
    const total = items.reduce((s, i) => s + i.subtotal, 0)

    const { data: inserted, error } = await supabase
      .from('orders')
      .insert([{
        customer:       session.name,
        customer_phone: session.phone ?? phone,
        total,
        status:         'pending',
        items,
        address:        addressParsed,
        delivery_type:  session.deliveryType,
        payment_method: session.paymentMethod,
      }])
      .select('id').single()

    if (error) {
      console.error('[ORDER INSERT ERROR]', JSON.stringify(error, null, 2))
      await resetSession(phone)
      return `❌ Erro ao registrar pedido. Tente novamente ou acesse nosso site.`
    }

    const code = await fetchGeneratedCode(inserted.id)
    await resetSession(phone)

    return (
      `✅ *Pedido registrado com sucesso!*\n\n` +
      `📦 Código: *${code}*\n` +
      `💰 Total: R$ ${total.toFixed(2)}\n\n` +
      `Um atendente entrará em contato em breve.\n\n` +
      `Guarde seu código para acompanhar o status! 😊`
    )
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return `Não entendi sua mensagem. 😅\n\nDigite *0* para ver o menu ou *reiniciar* para recomeçar.`
}

// ── Handler HTTP ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('Z-API webhook body:', JSON.stringify(body, null, 2))

    const remoteJid = body.data?.key?.remoteJid || body.phone || body.from || ''

    if (
      remoteJid.endsWith('@g.us') || body.isGroup === true ||
      body.data?.isGroup === true || body.chatId?.endsWith('@g.us') ||
      body.data?.chatId?.endsWith('@g.us')
    ) return NextResponse.json({ ok: true })

    const phone = body.phone || body.from || body.data?.key?.remoteJid || body.data?.key?.participant
    const text  = body.text?.message || body.body || body.message ||
                  body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text

    if (!phone || !text) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    const fromMe = body.fromMe ?? body.data?.key?.fromMe
    if (fromMe) return NextResponse.json({ ok: true })

    const reply = await processMessage(phone, text)

    // Só envia se houver conteúdo.
    // O fluxo Pix envia o texto diretamente via sendZAPIMessage e retorna ''.
    if (reply) {
      await sendZAPIMessage(phone, reply)
    }

    return NextResponse.json({ reply: reply || 'ok' })
  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}