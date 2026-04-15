import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/master-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.type !== 'payment') return NextResponse.json({ received: true })

    const paymentId = body.data?.id
    if (!paymentId) return NextResponse.json({ received: true })

    const supabase = getSupabaseAdmin()

    const { data: order } = await supabase
      .from('orders')
      .select('id, company_id')
      .eq('payment_gateway_id', String(paymentId))
      .maybeSingle()

    if (!order) return NextResponse.json({ received: true })

    const { data: company } = await supabase
      .from('companies')
      .select('mp_secret_key')
      .eq('id', order.company_id)
      .single()

    const secretKey = company?.mp_secret_key ?? process.env.MERCADOPAGO_TOKEN!

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })

    const payment = await response.json()

    if (payment.status === 'approved') {
      await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', order.id)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}