'use client'
import { useRef, useState, useEffect } from 'react'
import { useCheckoutStore } from '@/stores/checkout-store'
import { useCartStore } from '@/stores/cart-store'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { createOrder } from '@/services/orders'
import { createCardPayment } from '@/services/mercadopago'
import { updateCustomerProfile } from '@/services/auth'
import { supabase } from '@/lib/supabase'
import { CardBrick } from './CardBrick'
import { CheckoutSteps } from '@/types/checkout-steps'
import { useParams } from 'next/navigation'

type Props = {
  setStep: (step: CheckoutSteps) => void
}

function PaymentApproved({ inProcess = false }: { inProcess?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center animate-bounce
        ${inProcess ? 'bg-yellow-100' : 'bg-green-100'}`}>
        <svg className={`w-10 h-10 ${inProcess ? 'text-yellow-600' : 'text-green-600'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className={`text-lg font-semibold ${inProcess ? 'text-yellow-700' : 'text-green-700'}`}>
        {inProcess ? 'Pagamento em análise!' : 'Pagamento confirmado!'}
      </p>
      <p className="text-sm text-gray-500 text-center">
        {inProcess
          ? 'Seu pedido foi recebido e o pagamento está sendo processado.'
          : 'Seu pedido foi recebido e já está sendo preparado.'}
      </p>
      <p className="text-xs text-gray-400">Redirecionando para seus pedidos...</p>
    </div>
  )
}

export function StepCard({ setStep }: Props) {
  const { name, address, phone, cpf, deliveryType, paymentMethod, deliveryFee } = useCheckoutStore(s => s)
  const { cart } = useCartStore(s => s)
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const [companyId, setCompanyId] = useState('')

  const [orderReady, setOrderReady]             = useState(false)
  const [orderError, setOrderError]             = useState<string | null>(null)
  const [savedOrderId, setSavedOrderId]         = useState<number | null>(null)
  const [savedOrderCode, setSavedOrderCode]     = useState<string | null>(null)
  const [cardError, setCardError]               = useState<string | null>(null)
  const [paymentApproved, setPaymentApproved]   = useState(false)
  const [processing, setProcessing]             = useState(false)
  const [paymentInProcess, setPaymentInProcess] = useState(false)
  const [mpPublicKey, setMpPublicKey]           = useState<string | null>(null)  // ← novo

  const submittingRef = useRef(false)
  const savedRef      = useRef(false)

  const isPickup = deliveryType === 'pickup'
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const total    = subtotal + deliveryFee

  // Busca companyId e mpPublicKey pelo slug
  useEffect(() => {
    if (!params?.slug) return

    supabase
      .from('companies')
      .select('id')
      .eq('slug', params.slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCompanyId(data.id)
      })

    fetch(`/api/mp/public-key?slug=${params.slug}`)
      .then(r => r.json())
      .then(d => { if (d.publicKey) setMpPublicKey(d.publicKey) })
      .catch(() => setOrderError('Erro ao carregar chave de pagamento.'))
  }, [params?.slug])

  // Salva o pedido assim que tiver o companyId
  useEffect(() => {
    if (!companyId) return

    const ensureOrderSaved = async () => {
      if (savedRef.current) return
      savedRef.current = true

      try {
        const items = cart.map(item => ({
          product_id:   item.product.id,
          product_name: item.product.name,
          quantity:     item.quantity,
          unit_price:   item.product.price,
        }))

        const order = await createOrder({
          customer:       name,
          customer_phone: phone,
          customer_id:    user?.id ?? null,
          total,
          status:         'pending',
          items,
          address:        isPickup ? null : address,
          delivery_type:  deliveryType,
          payment_method: paymentMethod,
          company_id:     companyId,
        })

        setSavedOrderId(order.id)
        setSavedOrderCode(order.code)

        if (!isPickup && user) {
          try { await updateCustomerProfile(user.id, companyId, { address }) } catch {}
        }

        setOrderReady(true)
      } catch (err: any) {
        console.error('[StepCard] Erro ao salvar pedido:', err)
        savedRef.current = false
        setOrderError(err.message ?? 'Erro ao preparar o pedido. Tente novamente.')
      }
    }

    ensureOrderSaved()
  }, [companyId])

  const processCard = async (formData: {
    token: string
    paymentMethodId: string
    installments: number
    issuerId?: string
  }) => {
    if (submittingRef.current || !savedOrderId || !savedOrderCode) return
    submittingRef.current = true
    setCardError(null)
    setProcessing(true)

    const { token, paymentMethodId, installments, issuerId } = formData

    try {
      const result = await createCardPayment({
        orderId:         savedOrderId,
        orderCode:       savedOrderCode,
        total,
        customerName:    name,
        customerEmail:   user?.email ?? undefined,
        customerTaxId:   cpf,
        token,
        paymentMethodId,
        installments,
        issuerId,
        items: cart.map(item => ({
          product_name: item.product.name,
          quantity:     item.quantity,
          unit_price:   item.product.price,
        })),
      })

      await supabase
        .from('orders')
        .update({ payment_gateway_id: String(result.mercadoPagoId) })
        .eq('id', savedOrderId)

      if (result.status === 'approved') {
        await supabase.from('orders').update({ status: 'confirmed' }).eq('id', savedOrderId)
        setPaymentApproved(true)
        setTimeout(() => router.push(`/${params.slug}/meus-pedidos`), 3000)
      } else if (result.status === 'in_process') {
        await supabase.from('orders').update({ status: 'in_process' }).eq('id', savedOrderId)
        setPaymentInProcess(true)
        setPaymentApproved(true)
        setTimeout(() => router.push(`/${params.slug}/meus-pedidos`), 3000)
      } else {
        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', savedOrderId)
        setCardError('Pagamento recusado. Verifique os dados ou escolha outra forma de pagamento.')
        submittingRef.current = false
      }
    } catch (err: any) {
      if (savedOrderId) {
        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', savedOrderId)
      }
      setCardError(err.message ?? 'Erro ao processar pagamento.')
      submittingRef.current = false
    } finally {
      setProcessing(false)
    }
  }

  if (paymentApproved) return <PaymentApproved inProcess={paymentInProcess} />

  return (
    <div className="flex flex-col gap-1 overflow-y-auto max-h-full">
      <p className="text-center text-xs text-gray-500 shrink-0">
        Total: <strong>R$ {total.toFixed(2)}</strong>
      </p>

      {orderError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 text-center">
          {orderError}
          <button
            onClick={() => { setOrderError(null); savedRef.current = false }}
            className="block mx-auto mt-2 underline text-red-700 text-xs"
          >
            Tentar novamente
          </button>
        </div>
      ) : !orderReady || !mpPublicKey ? (  // ← aguarda os dois
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-4">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Preparando formulário...
        </div>
      ) : (
        <div className="overflow-y-auto">
          <CardBrick
            total={total}
            publicKey={mpPublicKey}  // ← passa a chave do banco
            onSubmit={processCard}
            onError={setCardError}
          />
        </div>
      )}

      {cardError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 text-center">
          {cardError}
          <button
            onClick={() => setStep('when-to-pay')}
            className="block mx-auto mt-2 underline text-red-700 text-xs"
          >
            Escolher outra forma de pagamento
          </button>
        </div>
      )}

      {processing && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Processando pagamento...
        </div>
      )}

      {!processing && !paymentApproved && (
        <button
          onClick={() => setStep('payment')}
          className="text-sm text-gray-400 hover:text-gray-600 text-center"
        >
          ← Voltar
        </button>
      )}
    </div>
  )
}