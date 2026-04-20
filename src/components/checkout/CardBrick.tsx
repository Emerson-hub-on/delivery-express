'use client'
import { useEffect, useRef, useState } from 'react'
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react'

interface CardBrickProps {
  total: number
  publicKey: string
  onSubmit: (formData: {
    token: string
    paymentMethodId: string
    installments: number
    issuerId?: string
  }) => Promise<void>
  onError: (error: string) => void
}

export function CardBrick({ total, publicKey, onSubmit, onError }: CardBrickProps) {
  const initializedRef = useRef(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!publicKey || initializedRef.current) return
    initMercadoPago(publicKey, { locale: 'pt-BR' })
    initializedRef.current = true
    setInitialized(true)
  }, [publicKey])

  if (!initialized) return null

  return (
    <CardPayment
      initialization={{ amount: total }}
      customization={{
        paymentMethods: {
          minInstallments: 1,
          maxInstallments: 12,
        },
        visual: { style: { theme: 'default' } },
      }}
      onSubmit={async (formData) => {
        await onSubmit({
          token:           formData.token,
          paymentMethodId: formData.payment_method_id,
          installments:    formData.installments,
          issuerId:        formData.issuer_id,
        })
      }}
      onError={(err) => onError(err.message ?? 'Erro no formulário de cartão')}
    />
  )
}