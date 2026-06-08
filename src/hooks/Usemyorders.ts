'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, OrderItem } from '@/types/product'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

type RawOrder = Omit<Order, 'items'> & { order_items?: OrderItem[] }

function normalizeOrder(o: RawOrder): Order {
  const { order_items, ...rest } = o as RawOrder & { order_items?: unknown }
  return { ...rest, items: (o.order_items ?? []) } as Order
}

export function useMyOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setOrders([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*, order_items(*)')          // ← JOIN com order_items
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw new Error(fetchError.message)
      setOrders((data ?? []).map(o => normalizeOrder(o as RawOrder)))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Realtime: rebusca completo (com itens) ao invés de usar payload direto
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`my-orders-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${user.id}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', (payload.new as Order).id)
            .maybeSingle()

          if (data) {
            setOrders(prev =>
              prev.map(o => o.id === data.id ? normalizeOrder(data as RawOrder) : o)
            )
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${user.id}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('id', (payload.new as Order).id)
            .maybeSingle()

          if (data) {
            setOrders(prev => [normalizeOrder(data as RawOrder), ...prev])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const cancelOrder = useCallback(
    async (orderId: number) => {
      try {
        setCancellingId(orderId)
        setError(null)

        const order = orders.find(o => o.id === orderId)
        const isPaidOnline =
          order?.payment_method === 'pix' ||
          order?.payment_method === 'credito' ||
          order?.payment_method === 'debito'
        const paymentGatewayId = order?.payment_gateway_id

        if (isPaidOnline && paymentGatewayId) {
          const refundRes = await fetch('/api/mercadopago/refund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId: paymentGatewayId, orderId }),
          })

          const refundData = await refundRes.json()
          if (!refundRes.ok) {
            const isCommunicationError =
              refundData.error?.includes('communication_error') ||
              refundRes.status === 408 ||
              refundRes.status === 503

            if (!isCommunicationError) {
              throw new Error(refundData.error ?? 'Não foi possível processar o estorno.')
            }
            console.warn('[cancelOrder] Estorno com falha temporária — pedido cancelado mesmo assim.')
          }
        }

        const { data, error: updateError } = await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', orderId)
          .eq('customer_id', user?.id)
          .in('status', ['pending', 'confirmed'])
          .select('*, order_items(*)')
          .maybeSingle()

        if (updateError) throw new Error(updateError.message)
        if (data) {
          setOrders(prev =>
            prev.map(o => o.id === orderId ? normalizeOrder(data as RawOrder) : o)
          )
        }
        toast.success('Pedido cancelado com sucesso')
      } catch (e: any) {
        setError(e.message)
      } finally {
        setCancellingId(null)
      }
    },
    [user, orders]
  )

  return { orders, loading, error, cancellingId, cancelOrder, refetch: fetchOrders }
}