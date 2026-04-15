'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useCheckoutStore } from '@/stores/checkout-store'
import { useCartStore } from '@/stores/cart-store'
import { Button } from '../ui/button'
import { useRouter, useParams } from 'next/navigation'
import { createOrder, generateDeliveryPin } from '@/services/orders'
import { createPixPayment, PixPaymentResult } from '@/services/mercadopago'
import { useAuth } from '@/hooks/useAuth'
import { updateCustomerProfile } from '@/services/auth'
import { supabase } from '@/lib/supabase'
import { getPaymentLabel, isPaymentPending } from '@/lib/payment-labels'
import { CheckoutSteps } from '@/types/checkout-steps'

function PaymentApproved() {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-green-700">Pagamento confirmado!</p>
      <p className="text-sm text-gray-500 text-center">Seu pedido foi recebido e já está sendo preparado.</p>
      <p className="text-xs text-gray-400">Redirecionando para seus pedidos...</p>
    </div>
  )
}

function PixDisplay({ pix }: { pix: PixPaymentResult }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pix.pixCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const expiresAt = new Date(pix.expiresAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col items-center gap-4">
      <p className="text-sm font-semibold text-green-800">Pague com Pix</p>
      {pix.qrCodeImage && (
        <img src={pix.qrCodeImage} alt="QR Code Pix" className="w-48 h-48 rounded-lg border border-green-200" />
      )}
      <div className="w-full">
        <p className="text-[10px] text-gray-400 mb-1">Pix Copia e Cola</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={pix.pixCode}
            className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-600 truncate"
          />
          <button
            onClick={handleCopy}
            className={`px-3 py-2 text-xs rounded-lg font-medium transition-colors whitespace-nowrap
              ${copied ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'}`}
          >
            {copied ? '✓ Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        ⏱ Válido até {expiresAt} — após o pagamento seu pedido é confirmado automaticamente
      </p>
    </div>
  )
}

function DeliveryPinDisplay({ pin }: { pin: string }) {
  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl px-5 py-4 flex flex-col items-center gap-2">
      <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">
        🔐 Código de confirmação de entrega
      </p>
      <p className="text-4xl font-bold text-blue-700 tracking-[0.3em]">
        {pin}
      </p>
      <p className="text-xs text-blue-400 text-center">
        Mostre este código ao motoboy no momento da entrega
      </p>
    </div>
  )
}

interface Props {
  setStep: (step: CheckoutSteps) => void
  onRequireAuth: () => void
}

export const StepFinish = ({ setStep, onRequireAuth }: Props) => {
  const params = useParams<{ slug: string }>()
  const [companyId, setCompanyId] = useState('')
  const [loadingCompany, setLoadingCompany] = useState(true)

  useEffect(() => {
    if (!params?.slug) return
    const load = async () => {
      try {
        const { data } = await supabase
          .from('companies')
          .select('id')
          .eq('slug', params.slug)
          .maybeSingle()
        if (data) setCompanyId(data.id)
      } finally {
        setLoadingCompany(false)
      }
    }
    load()
  }, [params?.slug])

  const { name, address, phone, cpf, deliveryType, paymentMethod, payWhen, deliveryFee, change } = useCheckoutStore(s => s)
  const { cart } = useCartStore(s => s)
  const { user } = useAuth()
  const router = useRouter()

  const [loading, setLoading]                   = useState(false)
  const [orderSaved, setOrderSaved]             = useState(false)
  const [savedOrderId, setSavedOrderId]         = useState<number | null>(null)
  const [savedOrderCode, setSavedOrderCode]     = useState<string | null>(null)
  const [savedDeliveryPin, setSavedDeliveryPin] = useState<string | null>(null)
  const [pixData, setPixData]                   = useState<PixPaymentResult | null>(null)
  const [pixError, setPixError]                 = useState<string | null>(null)
  const [paymentApproved, setPaymentApproved]   = useState(false)
  const submittingRef = useRef(false)
  const pollingRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const [orderConfirmed, setOrderConfirmed] = useState(false)
  const isPickup = deliveryType === 'pickup'
  const isPix    = paymentMethod === 'pix'
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const total    = subtotal + deliveryFee

  const handleBack = () => {
    setStep(payWhen === 'now' ? 'payment' : 'when-to-pay')
  }

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback((mercadoPagoId: string, orderId: number) => {
    const MAX_ATTEMPTS = 150
    let attempts = 0
    pollingRef.current = setInterval(async () => {
      attempts++
      if (attempts > MAX_ATTEMPTS) { stopPolling(); return }
      try {
        const res = await fetch(`/api/mercadopago/status?paymentId=${mercadoPagoId}&orderId=${orderId}`)
        const { status } = await res.json()
        if (status === 'approved') {
          stopPolling()
          await supabase.from('orders').update({ status: 'confirmed' }).eq('id', orderId)
          setPaymentApproved(true)
          setTimeout(() => router.push(`/${params.slug}/meus-pedidos`), 3000)
        }
      } catch {}
    }, 4000)
  }, [stopPolling, router])

  useEffect(() => () => stopPolling(), [stopPolling])

  const doSaveOrder = async (userId: string) => {
    if (!companyId) throw new Error('Empresa não encontrada. Tente novamente.')

    const items = cart.map(item => ({
      product_id:   item.product.id,
      product_name: item.product.name,
      quantity:     item.quantity,
      unit_price:   item.product.price,
    }))

    const deliveryPin = !isPickup ? generateDeliveryPin() : undefined

    const order = await createOrder({
      customer:       name,
      customer_phone: phone,
      customer_id:    userId,
      total,
      status:         'pending',
      items,
      address:        isPickup ? null : address,
      delivery_type:  deliveryType,
      payment_method: paymentMethod,
      company_id:     companyId,
      delivery_pin:   deliveryPin,
      change:         paymentMethod === 'dinheiro' ? change : null,
    })

    setSavedOrderId(order.id)
    setSavedOrderCode(order.code)
    if (deliveryPin) setSavedDeliveryPin(deliveryPin)
    setOrderSaved(true)
    return order
  }

  const saveAddressToProfile = async (userId: string) => {
    if (isPickup) return
    try { await updateCustomerProfile(userId, companyId, { address }) } catch {}
  }

  const generatePix = async (order: { id: number; code: string }) => {
    setPixError(null)
    try {
      const result = await createPixPayment({
        orderId:       order.id,
        orderCode:     order.code,
        total,
        customerName:  name,
        customerTaxId: cpf,
        items: cart.map(item => ({
          product_name: item.product.name,
          quantity:     item.quantity,
          unit_price:   item.product.price,
        })),
      })
      setPixData(result)
      await supabase.from('orders').update({ payment_gateway_id: result.mercadoPagoId }).eq('id', order.id)
      startPolling(result.mercadoPagoId, order.id)
    } catch (err: unknown) {
  setPixError(err instanceof Error ? err.message : 'Não foi possível gerar o Pix. Tente novamente.')
}
  }

  const handleSendOrder = async (e: React.MouseEvent) => {
    e.preventDefault()

    if (!user) {
      onRequireAuth()
      return
    }

    if (submittingRef.current || orderSaved) return
    submittingRef.current = true
    setLoading(true)
    try {
      await saveAddressToProfile(user.id)
      const order = await doSaveOrder(user.id)

      if (isPix && payWhen === 'now') {
        await generatePix(order)
      } else {
        setOrderConfirmed(true)
        setTimeout(() => router.push(`/${params.slug}/meus-pedidos`), 3000)
      }
    } catch (err) {
      console.error('Erro ao salvar pedido:', err)
      submittingRef.current = false
    } finally {
      setLoading(false)
    }
  }

function OrderConfirmed() {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-green-700">Pedido confirmado!</p>
      <p className="text-sm text-gray-500 text-center">Seu pedido foi recebido e já está sendo preparado.</p>
      <p className="text-xs text-gray-400">Redirecionando para seus pedidos...</p>
    </div>
  )
}


  if (paymentApproved) return <PaymentApproved />
  if (orderConfirmed)  return <OrderConfirmed />


  return (
    <div className="text-center flex flex-col gap-5">
      <p>Pronto <strong>{name}</strong>!</p>

      {isPickup ? (
        <p>Seu pedido será preparado e você será avisado quando estiver <strong>pronto para retirada</strong>.</p>
      ) : isPix && payWhen === 'now' ? (
        <p>Escaneie o QR Code ou copie o código Pix para finalizar seu pedido.</p>
      ) : (
        <p>Revise seu pedido e clique em <strong>Finalizar pedido</strong> para confirmar.</p>
      )}

      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-left space-y-1.5">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>R$ {subtotal.toFixed(2)}</span>
        </div>
        {!isPickup && deliveryFee > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Taxa de entrega</span>
            <span className="text-orange-500">+ R$ {deliveryFee.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-semibold text-gray-900 pt-1.5 border-t border-gray-200">
          <span>Total</span>
          <span>R$ {total.toFixed(2)}</span>
        </div>
        {paymentMethod && payWhen === 'now' && (
          <div className="flex justify-between text-xs pt-1">
            <span className="text-gray-400">Pagamento</span>
            <span className={isPaymentPending(paymentMethod) ? 'text-red-500 font-medium' : 'text-gray-400'}>
              {getPaymentLabel(paymentMethod)}
            </span>
          </div>
        )}
      </div>

      {savedDeliveryPin && orderSaved && (
        <DeliveryPinDisplay pin={savedDeliveryPin} />
      )}

      {pixData && <PixDisplay pix={pixData} />}

      {pixData && !paymentApproved && (
        <button
          onClick={async () => {
            stopPolling()
            await supabase.from('orders').update({ status: 'cancelled' }).eq('id', savedOrderId)
            setPixData(null)
            setOrderSaved(false)
            setSavedOrderId(null)
            setSavedOrderCode(null)
            setSavedDeliveryPin(null)
            submittingRef.current = false
          }}
          className="text-sm text-red-400 hover:text-red-600 underline text-center"
        >
          Cancelar operação
        </button>
      )}

      {pixError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
          {pixError}
          <button
            onClick={() => savedOrderId && savedOrderCode && generatePix({ id: savedOrderId, code: savedOrderCode })}
            className="block mt-1 underline text-red-700 text-xs"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {pixData && !paymentApproved && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Aguardando confirmação do pagamento...
        </div>
      )}

      {!pixData && (
        <Button
          disabled={loading || loadingCompany}
          onClick={handleSendOrder}
        >
          {loadingCompany
            ? 'Carregando...'
            : loading
              ? (isPix && payWhen === 'now' ? 'Gerando Pix...' : 'Salvando pedido...')
              : isPix && payWhen === 'now'
                ? 'Gerar QR Code Pix'
                : 'Finalizar pedido'
          }
        </Button>
      )}

      {pixData && user && (
        <a href={`/${params.slug}/meus-pedidos`} className="text-sm text-gray-500 underline">
          Ver meus pedidos →
        </a>
      )}

      {!orderSaved && (
        <button onClick={handleBack} className="text-sm text-gray-400 hover:text-gray-600 text-center">
          ← Voltar
        </button>
      )}
    </div>
  )
}