import { supabase } from '@/lib/supabase'
import { Order } from '@/types/product'

async function getCompanyId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user.id
}

export const getAllOrders = async (): Promise<Order[]> => {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('company_id', user.id)  // ← filtra explicitamente
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}

export const getOrdersByDateRange = async (from: string, to: string): Promise<Order[]> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const fromUTC = new Date(`${from}T00:00:00-03:00`).toISOString()
  const toUTC   = new Date(`${to}T23:59:59-03:00`).toISOString()

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('company_id', user.id)  // ← filtra explicitamente
    .gte('created_at', fromUTC)
    .lte('created_at', toUTC)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}
export async function getOrderByCode(code: number): Promise<Order | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: byCode, error: errCode } = await supabase
    .from('orders')
    .select('*')   // sem join de items
    .eq('company_id', user.id)
    .eq('code', String(code))
    .limit(1)
    .maybeSingle()

  if (errCode) console.error('[GET ORDER BY CODE ERROR]', errCode.message)
  if (byCode) return byCode as Order

  const { data: byId, error: errId } = await supabase
    .from('orders')
    .select('*')   // sem join de items
    .eq('company_id', user.id)
    .eq('id', code)
    .limit(1)
    .maybeSingle()

  if (errId) console.error('[GET ORDER BY ID ERROR]', errId.message)
  return (byId ?? null) as Order | null
}

export const createOrder = async (
  order: Omit<Order, 'id' | 'created_at' | 'code'> & { company_id?: string; delivery_pin?: string }
): Promise<Order> => {
  const { data, error } = await supabase
    .from('orders')
    .insert([{
      ...order,
      change: order.change ?? null,
    }])
    .select()
    .single()

  if (error) {
    console.error('[CREATE ORDER ERROR]', JSON.stringify(error, null, 2))
    throw new Error(error.message)
  }

  // Se code ainda é null, o trigger ainda não rodou — busca novamente
  if (!data.code) {
    const { data: fresh, error: fetchError } = await supabase
      .from('orders')
      .select()
      .eq('id', data.id)
      .single()

    if (fetchError) throw new Error(fetchError.message)
    return fresh as Order
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

export const assignMotoboy = async (orderId: number, motoboyId: string | null): Promise<Order> => {
  const { data, error } = await supabase
    .from('orders')
    .update({ motoboy_id: motoboyId })
    .eq('id', orderId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as Order
}

export function generateDeliveryPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}