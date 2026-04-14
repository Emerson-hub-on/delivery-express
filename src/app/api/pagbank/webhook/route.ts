import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const event = await req.json()

  // O PagBank envia events com o ID do pedido e o novo status
  if (event.charges?.[0]?.status === 'PAID') {
    const pagbankOrderId = event.id  // ex: "ORDE_..."

    await supabase
      .from('orders')
      .update({ status: 'confirmed' })
      .eq('pagbank_order_id', pagbankOrderId)
  }

  return NextResponse.json({ received: true })
}