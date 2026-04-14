/**
 * app/api/ifood/poll/route.ts
 *
 * POST /api/ifood/poll
 * Body: { companyId: string }
 *
 * Chamada pelo cron a cada 30s. Não chamar diretamente do browser.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getIfoodToken } from '@/lib/ifood-token'
import { mapIfoodToOrder, IfoodOrder } from '@/services/ifood-mapper'

const IFOOD_API = 'https://merchant-api.ifood.com.br'

// Service role bypassa RLS — só usar no server
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Chamada autenticada ao iFood ──────────────────────────────

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
  return res.json()
}

// ── Tenta vincular ao customer pelo telefone ──────────────────

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

// ── Tipos de evento ───────────────────────────────────────────

interface IfoodEvent {
  id:      string
  code:    string   // 'PLACED' | 'CONFIRMED' | 'CANCELLED' | ...
  orderId: string
}

// ── Handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
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
    const body = await req.json()
    companyId = body?.companyId
  } catch { /* body vazio */ }

  if (!companyId) {
    return NextResponse.json({ error: 'companyId ausente no body' }, { status: 400 })
  }

  // IFOOD_MERCHANT_ID = 7b1abb84-e900-4be8-94c0-207e10d0fb4c
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
        // Idempotência
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
      } catch (err: any) {
        console.error(`[iFood] Erro em ${event.orderId}:`, err.message)
        errors.push(`${event.orderId}: ${err.message}`)
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
  } catch (err: any) {
    console.error('[iFood] Erro crítico:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}