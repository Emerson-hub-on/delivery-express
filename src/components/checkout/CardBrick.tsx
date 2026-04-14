'use client'
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react'

initMercadoPago(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY!, {
  locale: 'pt-BR',
})

interface CardBrickProps {
  total: number
  onSubmit: (formData: {
    token: string
    paymentMethodId: string
    installments: number
    issuerId?: string
  }) => Promise<void>
  onError: (error: string) => void
}

export function CardBrick({ total, onSubmit, onError }: CardBrickProps) {
  return (
    <CardPayment
      initialization={{ amount: total }}
      customization={{
        paymentMethods: {
          minInstallments: 1,
          maxInstallments: 12,  // ← até 12x
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