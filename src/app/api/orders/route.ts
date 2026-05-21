// app/api/orders/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { OrderItem } from '@/types/product'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { items, ...orderData } = await req.json()

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([{ ...orderData, change: orderData.change ?? null }])
      .select()
      .single()

    if (orderError) throw new Error(orderError.message)

    if (items?.length) {
      const rows = items.map((item: OrderItem) => ({
        order_id:     order.id,
        product_id:   item.product_id ?? null,
        product_name: item.product_name,
        quantity:     item.quantity,
        unit_price:   item.unit_price,
        discount:     0,
        addons:       item.addons ?? null,
        observation:  item.observation ?? null,
      }))

      const { error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(rows)

      if (itemsError) throw new Error(`order_items insert: ${itemsError.message}`)
    }

    // busca o code gerado pelo trigger
    if (!order.code) {
      const { data: fresh, error: freshError } = await supabaseAdmin
        .from('orders')
        .select()
        .eq('id', order.id)
        .single()

      if (freshError) throw new Error(freshError.message)
      return NextResponse.json(fresh)
    }

    return NextResponse.json(order)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao criar pedido'
    console.error('Erro ao criar pedido:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}