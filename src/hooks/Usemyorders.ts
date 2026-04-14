'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Order } from '@/types/product'
import { useAuth } from '@/hooks/useAuth'

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
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw new Error(fetchError.message)
      setOrders((data ?? []) as Order[])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

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
        (payload) => {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === (payload.new as Order).id ? (payload.new as Order) : o
            )
          )
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
        (payload) => {
          setOrders((prev) => [payload.new as Order, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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

        // Tenta estorno se pagou online
        if (isPaidOnline && paymentGatewayId) {
          const refundRes = await fetch('/api/mercadopago/refund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId: paymentGatewayId, orderId }),
          })

          const refundData = await refundRes.json()

          // Se erro de comunicação temporária, cancela mesmo assim
          // O MP processa o estorno de forma assíncrona nesses casos
          if (!refundRes.ok) {
            const isCommunicationError =
              refundData.error?.includes('communication_error') ||
              refundRes.status === 408 ||
              refundRes.status === 503

            if (!isCommunicationError) {
              throw new Error(refundData.error ?? 'Não foi possível processar o estorno.')
            }

            console.warn('[cancelOrder] Estorno com falha temporária — pedido cancelado mesmo assim. O estorno será processado em até 24h.')
          }
        }

        // Cancela o pedido no Supabase
        const { data, error: updateError } = await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', orderId)
          .eq('customer_id', user?.id)
          .eq('status', isPaidOnline ? 'confirmed' : 'pending')
          .select()
          .single()

        if (updateError) throw new Error(updateError.message)
        if (!data) throw new Error('Pedido não encontrado ou não pode ser cancelado.')

        setOrders(prev =>
          prev.map(o => (o.id === orderId ? (data as Order) : o))
        )
      } catch (e: any) {
        setError(e.message)
      } finally {
        setCancellingId(null)
      }
    },
    [user, orders]
  )

  return {
    orders,
    loading,
    error,
    cancellingId,
    cancelOrder,
    refetch: fetchOrders,
  }
}