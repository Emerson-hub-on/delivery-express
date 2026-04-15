import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getIfoodToken } from '@/lib/ifood-token'

const IFOOD_API = 'https://merchant-api.ifood.com.br'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  )

  try {
    const { ifoodId } = await req.json() as { ifoodId?: string }
    if (!ifoodId) {
      return NextResponse.json({ error: 'ifoodId obrigatório' }, { status: 400 })
    }

    const token = await getIfoodToken()

    const res = await fetch(`${IFOOD_API}/order/v1.0/orders/${ifoodId}/dispatch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[iFood Dispatch] Erro ${res.status}:`, text)
      return NextResponse.json(
        { warning: 'Despacho notificado localmente, mas falhou no iFood', details: text },
        { status: 200 }
      )
    }

    console.log(`[iFood Dispatch] Pedido ${ifoodId} despachado no iFood`)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[iFood Dispatch] Erro:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}