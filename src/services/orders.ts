// services/orders.ts

import { supabase } from '@/lib/supabase'
import { Order, OrderItem } from '@/types/product'

// ── helpers ──────────────────────────────────────────────────────

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

async function insertOrderItems(orderId: number, items: OrderItem[]) {
  if (!items?.length) return

  const rows = items.map(item => ({
    order_id:     orderId,
    product_id:   item.product_id ?? null,
    product_name: item.product_name,
    quantity:     item.quantity,
    unit_price:   item.unit_price,
    discount:     0,
    addons:       item.addons   ?? null,
    observation:  item.observation ?? null,
  }))

  const { error } = await supabase.from('order_items').insert(rows)
  if (error) throw new Error(`order_items insert: ${error.message}`)
}

// ── leitura ───────────────────────────────────────────────────────

export const getAllOrders = async (): Promise<Order[]> => {
  const user = await getUser()

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')       // ← join quando pronto
    .eq('company_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  // normaliza: se order_items veio, usa; senão cai no jsonb legado
  return (data ?? []).map(o => ({
    ...o,
    items: o.order_items?.length ? o.order_items : (o.items ?? []),
  })) as Order[]
}

export const getOrdersByDateRange = async (
  from: string,
  to: string
): Promise<Order[]> => {
  const user = await getUser()

  const fromUTC = new Date(`${from}T00:00:00-03:00`).toISOString()
  const toUTC   = new Date(`${to}T23:59:59-03:00`).toISOString()

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('company_id', user.id)
    .gte('created_at', fromUTC)
    .lte('created_at', toUTC)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map(o => ({
    ...o,
    items: o.order_items?.length ? o.order_items : (o.items ?? []),
  })) as Order[]
}

export const getOrderByCode = async (code: number): Promise<Order | null> => {
  const user = await getUser()

  const base = supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('company_id', user.id)

  const { data: byCode } = await base
    .eq('code', String(code))
    .limit(1)
    .maybeSingle()

  if (byCode) return normalizeOrder(byCode)

  const { data: byId } = await base
    .eq('id', code)
    .limit(1)
    .maybeSingle()

  return byId ? normalizeOrder(byId) : null
}

function normalizeOrder(o: any): Order {
  return {
    ...o,
    items: o.order_items?.length ? o.order_items : (o.items ?? []),
  } as Order
}

// ── escrita ───────────────────────────────────────────────────────

export const createOrder = async (
  order: Omit<Order, 'id' | 'created_at' | 'code'> & {
    company_id?: string
    delivery_pin?: string
  }
): Promise<Order> => {
  const { data, error } = await supabase
    .from('orders')
    .insert([{ ...order, change: order.change ?? null }])
    .select()
    .single()

  if (error) throw new Error(error.message)

  // dual-write: espelha em order_items
  await insertOrderItems(data.id, order.items as OrderItem[])

  if (!data.code) {
    const { data: fresh, error: e2 } = await supabase
      .from('orders').select().eq('id', data.id).single()
    if (e2) throw new Error(e2.message)
    return fresh as Order
  }

  return data as Order
}

export const updateOrderStatus = async (
  id: number,
  status: string
): Promise<Order> => {
  const extra: Record<string, string | null> = {}
  if (status === 'delivering') extra.dispatched_at = new Date().toISOString()
  if (status === 'completed' || status === 'cancelled')
    extra.completed_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('orders')
    .update({ status, ...extra })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  if ((status === 'delivering' || status === 'completed') && data.customer_phone) {
    fetch('/api/whatsapp/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone:     data.customer_phone,
        orderCode: data.code,
        status,
      }),
    }).catch(console.error)
  }

  return data as Order
}

export const assignMotoboy = async (
  orderId: number,
  motoboyId: string | null
): Promise<Order> => {
  const { data, error } = await supabase
    .from('orders')
    .update({ motoboy_id: motoboyId })
    .eq('id', orderId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as Order
}

// ── produto ───────────────────────────────────────────────────────

export const checkProductHasOrders = async (
  productId: number
): Promise<number> => {
  const { count, error } = await supabase
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export function generateDeliveryPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}