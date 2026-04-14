/**
 * app/api/ifood/webhook/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { getIfoodToken } from '@/lib/ifood-token'
import { mapIfoodToOrder, IfoodOrder } from '@/services/ifood-mapper'

const IFOOD_API = 'https://merchant-api.ifood.com.br'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function validateSignature(body: string, signature: string | null): boolean {
  if (!signature) return false
  const secret = process.env.IFOOD_CLIENT_SECRET!
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return signature === expected
}

async function fetchOrderDetails(orderId: string, token: string): Promise<IfoodOrder> {
  const res = await fetch(`${IFOOD_API}/order/v1.0/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Erro ao buscar pedido ${orderId}: ${res.status}`)
  return res.json()
}

async function resolveCompanyId(merchantId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('companies')
    .select('id')
    .eq('ifood_merchant_id', merchantId)
    .single()

  if (!data) {
    const { data: fallback } = await supabaseAdmin
      .from('companies')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    return fallback?.id ?? null
  }

  return data.id
}

async function resolveCustomerId(phone: string | null, companyId: string): Promise<string | null> {
  if (!phone) return null
  const { data } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('phone', phone)
    .eq('company_id', companyId)
    .single()
  return data?.id ?? null
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const signature = req.headers.get('x-ifood-signature')
  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev && !validateSignature(rawBody, signature)) {
    console.warn('[iFood Webhook] Assinatura inválida')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  console.log('[iFood Webhook] Evento recebido:', JSON.stringify(payload, null, 2))

  const fullCode   = payload?.fullCode ?? payload?.code ?? ''
  const orderId    = payload?.orderId ?? ''
  const merchantId = payload?.merchantId ?? process.env.IFOOD_MERCHANT_ID!

  if (!orderId || fullCode === 'KEEPALIVE') {
    return NextResponse.json({ received: true })
  }

  try {
    // ─────────────────────────────
    // 🔥 EVENTO: PEDIDO CRIADO
    // ─────────────────────────────
    if (fullCode === 'PLACED') {
      processOrder(orderId, merchantId).catch(err =>
        console.error('[iFood Webhook] Erro ao processar pedido:', err.message)
      )
      return NextResponse.json({ received: true })
    }

    // ─────────────────────────────
    // ✅ EVENTO: CONFIRMADO
    // ─────────────────────────────
    if (fullCode === 'CONFIRMED') {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('ifood_id', orderId)

      console.log(`[iFood Webhook] Pedido ${orderId} confirmado (sync)`)
      return NextResponse.json({ received: true })
    }

    // ─────────────────────────────
    // 🔐 EVENTO: PIN DE ENTREGA
    // ─────────────────────────────
    if (fullCode === 'DELIVERY_DROP_CODE_REQUESTED') {
      const token = await getIfoodToken()
      const ifoodOrder = await fetchOrderDetails(orderId, token)

      const deliveryPin =
        (ifoodOrder as any)?.delivery?.deliveryVerificationCode ?? null

      await supabaseAdmin
        .from('orders')
        .update({ delivery_pin: deliveryPin })
        .eq('ifood_id', orderId)

      console.log(`[iFood Webhook] PIN recebido para pedido ${orderId}`)
      return NextResponse.json({ received: true })
    }

    // ─────────────────────────────
    // 📦 EVENTOS FUTUROS (placeholder)
    // ─────────────────────────────
    if (fullCode === 'DISPATCHED') {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'delivering' })
        .eq('ifood_id', orderId)

      console.log(`[iFood Webhook] Pedido ${orderId} saiu para entrega`)
      return NextResponse.json({ received: true })
    }

    if (fullCode === 'CONCLUDED') {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('ifood_id', orderId)

      console.log(`[iFood Webhook] Pedido ${orderId} concluído`)
      return NextResponse.json({ received: true })
    }

    if (fullCode === 'CANCELLED') {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('ifood_id', orderId)

      console.log(`[iFood Webhook] Pedido ${orderId} cancelado`)
      return NextResponse.json({ received: true })
    }

    // ─────────────────────────────
    // ❓ EVENTO NÃO TRATADO
    // ─────────────────────────────
    console.log(`[iFood Webhook] Evento não tratado: ${fullCode}`)
    return NextResponse.json({ received: true })

  } catch (err: any) {
    console.error('[iFood Webhook] Erro geral:', err.message)
    return NextResponse.json({ received: true })
  }
}

async function processOrder(orderId: string, merchantId: string) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('ifood_id', orderId)
      .single()

    if (existing) {
      console.log(`[iFood Webhook] Pedido ${orderId} já existe — pulando`)
      return
    }

    const token = await getIfoodToken()

    const companyId = await resolveCompanyId(merchantId)
    if (!companyId) {
      console.error(`[iFood Webhook] company_id não encontrado`)
      return
    }

    const ifoodOrder = await fetchOrderDetails(orderId, token)

    const rawPhone = ifoodOrder.customer.phone?.number ?? null
    const phone = rawPhone
      ? rawPhone.replace(/^\+?55/, '').replace(/\D/g, '').slice(0, 11)
      : null

    const customerUuid = await resolveCustomerId(phone, companyId)
    const orderPayload = mapIfoodToOrder(ifoodOrder, companyId, customerUuid)

    const { error } = await supabaseAdmin.from('orders').insert([orderPayload])
    if (error) throw new Error(error.message)

    console.log(`[iFood Webhook] Pedido ${orderId} salvo`)
  } catch (err: any) {
    console.error(`[iFood Webhook] Falha em ${orderId}:`, err.message)
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'ifood-webhook' })
}