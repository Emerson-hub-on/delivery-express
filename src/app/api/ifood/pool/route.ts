import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getIfoodToken } from '@/lib/ifood-token'
import { mapIfoodToOrder, IfoodOrder } from '@/services/ifood-mapper'

const IFOOD_API = 'https://merchant-api.ifood.com.br'

export const dynamic = 'force-dynamic'

async function fetchIfood<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${IFOOD_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`iFood ${path} → ${res.status}: ${text}`)
  }

  if (res.status === 204) return {} as T
  return res.json() as Promise<T>
}

interface IfoodEvent {
  id:      string
  code:    string
  orderId: string
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  )

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

  // 1. Autenticação
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // 2. companyId no body
  let companyId: string | undefined
  try {
    const body = await req.json() as { companyId?: string }
    companyId = body?.companyId
  } catch { /* body vazio */ }

  if (!companyId) {
    return NextResponse.json({ error: 'companyId ausente no body' }, { status: 400 })
  }

  if (!process.env.IFOOD_MERCHANT_ID) {
    return NextResponse.json({ error: 'IFOOD_MERCHANT_ID não configurado' }, { status: 500 })
  }

  try {
    const token = await getIfoodToken()

    // 3. Busca eventos pendentes
    const events = await fetchIfood<IfoodEvent[]>(`/order/v1.0/events:polling`, token)

    if (!events || events.length === 0) {
      return NextResponse.json({ processed: 0, message: 'Sem eventos novos' })
    }

    console.log(`[iFood] ${events.length} evento(s) — company ${companyId}`)

    const placedEvents = events.filter(e => e.code === 'PLACED')
    const allIds       = events.map(e => ({ id: e.id }))
    let savedCount = 0
    const errors: string[] = []

    // 4. Processa pedidos novos
    for (const event of placedEvents) {
      try {
        const { data: existing } = await supabaseAdmin
          .from('orders')
          .select('id')
          .eq('ifood_id', event.orderId)
          .single()

        if (existing) {
          console.log(`[iFood] ${event.orderId} já existe — pulando`)
          continue
        }

        const ifoodOrder = await fetchIfood<IfoodOrder>(`/order/v1.0/orders/${event.orderId}`, token)

        const rawPhone = ifoodOrder.customer.phone?.number ?? null
        const phone = rawPhone
          ? rawPhone.replace(/^\+?55/, '').replace(/\D/g, '').slice(0, 11)
          : null

        const customerUuid = await resolveCustomerId(phone, companyId)
        const payload = mapIfoodToOrder(ifoodOrder, companyId, customerUuid)

        const { error: insertError } = await supabaseAdmin
          .from('orders')
          .insert([payload])

        if (insertError) throw new Error(insertError.message)

        savedCount++
        console.log(`[iFood] Pedido ${event.orderId} salvo`)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido'
        console.error(`[iFood] Erro em ${event.orderId}:`, message)
        errors.push(`${event.orderId}: ${message}`)
      }
    }

    // 5. Confirma todos os eventos
    await fetchIfood(`/order/v1.0/events/acknowledgment`, token, {
      method: 'POST',
      body: JSON.stringify(allIds),
    })

    return NextResponse.json({
      processed: savedCount,
      total_events: events.length,
      ...(errors.length ? { errors } : {}),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[iFood] Erro crítico:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}