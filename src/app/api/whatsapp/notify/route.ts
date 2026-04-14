import { supabase } from '@/lib/supabase'
import { Order } from '@/types/product'

// ── Queries ───────────────────────────────────────────────────────────────────

export const getAllOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}

export const getOrdersByDateRange = async (
  from: string,
  to: string
): Promise<Order[]> => {
  const fromUTC = new Date(`${from}T00:00:00-03:00`).toISOString()
  const toUTC   = new Date(`${to}T23:59:59-03:00`).toISOString()
  console.log('getOrdersByDateRange query:', fromUTC, 'até', toUTC)

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', fromUTC)
    .lte('created_at', toUTC)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}

export const createOrder = async (
  order: Omit<Order, 'id' | 'created_at' | 'code'>
): Promise<Order> => {
  const { data, error } = await supabase
    .from('orders')
    .insert([{ ...order }])
    .select()
    .single()

  if (error) {
    console.error('[CREATE ORDER ERROR]', JSON.stringify(error, null, 2))
    throw new Error(error.message)
  }

  return data as Order
}

export const updateOrderStatus = async (id: number, status: string): Promise<Order> => {
  const extra: Record<string, string | null> = {}
  if (status === 'delivering') extra.dispatched_at = new Date().toISOString()
  if (status === 'completed' || status === 'cancelled') extra.completed_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('orders')
    .update({ status, ...extra })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  // ── Notifica o cliente via WhatsApp nos eventos relevantes ───────────────
  //
  //  delivering  → entrega a caminho          (todos os pedidos de delivery)
  //  ready       → pronto para retirada       (todos os pedidos de pickup)
  //  completed   → pedido entregue/retirado   (opcional, pode remover)
  //
  const shouldNotify =
    status === 'delivering' ||  // saiu para entrega
    status === 'ready'      ||  // pronto para retirada
    status === 'completed'      // entregue/retirado

  if (shouldNotify && data.customer_phone) {
    fetch('/api/whatsapp/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone:        data.customer_phone,
        orderCode:    data.code,
        status,
        deliveryType: data.delivery_type, // 'delivery' | 'pickup'
      }),
    }).catch(console.error) // fire and forget
  }

  return data as Order
}

export const assignMotoboy = async (orderId: number, motoboyId: string | null): Promise<Order> => {
  console.log('assignMotoboy chamado:', { orderId, motoboyId })

  const { data, error } = await supabase
    .from('orders')
    .update({ motoboy_id: motoboyId })
    .eq('id', orderId)
    .select('*')
    .single()

  console.log('assignMotoboy resultado:', { data, error })

  if (error) throw new Error(error.message)
  return data as Order
}