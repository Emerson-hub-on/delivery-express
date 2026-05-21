// services/orders.ts

import { supabase } from '@/lib/supabase'
import { Order, OrderItem } from '@/types/product'

// ── helpers ──────────────────────────────────────────────────────

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

type RawOrder = Order & { order_items?: OrderItem[] }

function normalizeOrder(o: RawOrder): Order {
  return {
    ...o,
    items: o.order_items?.length ? o.order_items : (o.items ?? []),
  } as Order
}

// ── leitura ───────────────────────────────────────────────────────

export const getAllOrders = async (): Promise<Order[]> => {
  const user = await getUser()

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('company_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map(o => normalizeOrder(o as RawOrder))
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

  return (data ?? []).map(o => normalizeOrder(o as RawOrder))
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

  if (byCode) return normalizeOrder(byCode as RawOrder)

  const { data: byId } = await base
    .eq('id', code)
    .limit(1)
    .maybeSingle()

  return byId ? normalizeOrder(byId as RawOrder) : null
}

// ── escrita ───────────────────────────────────────────────────────

export const createOrder = async (
  order: Omit<Order, 'id' | 'created_at' | 'code'> & {
    company_id?: string
    delivery_pin?: string
  }
): Promise<Order> => {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  })

  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error || 'Erro ao criar pedido')
  }

  return res.json()
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