import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getIfoodToken } from '@/lib/ifood-token'

const IFOOD_API = 'https://merchant-api.ifood.com.br'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { ifoodId } = await req.json()
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
      // Não bloqueia — o despacho interno já aconteceu
      return NextResponse.json({ warning: 'Despacho notificado localmente, mas falhou no iFood', details: text }, { status: 200 })
    }

    console.log(`[iFood Dispatch] Pedido ${ifoodId} despachado no iFood`)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[iFood Dispatch] Erro:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}