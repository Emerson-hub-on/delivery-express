import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getIfoodToken } from '@/lib/ifood-token'

const IFOOD_API = 'https://merchant-api.ifood.com.br'

export const dynamic = 'force-dynamic' // ← obrigatório em toda route com env de servidor

export async function POST(req: NextRequest) {
  // ← createClient AQUI DENTRO, nunca no topo do módulo
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

    const res = await fetch(
      `${IFOOD_API}/order/v1.0/orders/${ifoodId}/confirm`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    )

    if (!res.ok) {
      const text = await res.text()
      console.error(`[iFood Confirm] Erro ${res.status}:`, text)
      return NextResponse.json(
        { error: 'Erro ao confirmar pedido no iFood', details: text },
        { status: 400 }
      )
    }

    console.log(`[iFood Confirm] Pedido ${ifoodId} confirmado no iFood`)

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update({ status: 'confirmed' })
      .eq('ifood_id', ifoodId)
      .select('*')
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, order: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[iFood Confirm] Erro:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}