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
    const body = await req.json()

    // 1. Valida campos obrigatórios
    const { items, company_id, customer_id, ...rest } = body

    if (!company_id) {
      return NextResponse.json({ error: 'company_id obrigatório' }, { status: 400 })
    }

    // 2. Verifica se a empresa existe
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('id', company_id)
      .maybeSingle()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Empresa inválida' }, { status: 403 })
    }

    // 3. Monta o objeto de insert explicitamente — todos os campos permitidos
    const orderInsert = {
      company_id,
      customer_id:    customer_id         ?? null,
      customer:       rest.customer       ?? null,   // ← nome do cliente (texto)
      customer_phone: rest.customer_phone ?? null,
      total:          rest.total,
      status:         'pending',                     // sempre força o status inicial
      payment_method: rest.payment_method ?? null,
      change:         rest.change         ?? null,
      notes:          rest.notes          ?? null,
      delivery_type:  rest.delivery_type  ?? null,
      delivery_pin:   rest.delivery_pin   ?? null,
      order_type:     rest.order_type     ?? 'delivery',
      address:        rest.address        ?? null,
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([orderInsert])
      .select()
      .single()

    if (orderError) throw new Error(orderError.message)

    // 4. Insere itens — rollback manual se falhar
    if (items?.length) {
      const rows = items.map((item: OrderItem) => ({
        order_id:     order.id,
        product_id:   item.product_id  ?? null,
        product_name: item.product_name,
        quantity:     item.quantity,
        unit_price:   item.unit_price,
        discount:     item.discount    ?? 0,
        addons:       item.addons      ?? null,
        observation:  item.observation ?? null,
      }))

      const { error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(rows)

      if (itemsError) {
        // rollback: remove o pedido órfão
        await supabaseAdmin.from('orders').delete().eq('id', order.id)
        throw new Error(`order_items insert: ${itemsError.message}`)
      }
    }

    // 5. Retorna pedido completo com itens e código gerado pelo trigger
    const { data: full, error: fullError } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', order.id)
      .single()

    if (fullError) throw new Error(fullError.message)

    const { order_items, ...orderRest } = full as typeof full & { order_items: OrderItem[] }
    return NextResponse.json({ ...orderRest, items: order_items ?? [] })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao criar pedido'
    console.error('Erro ao criar pedido:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}