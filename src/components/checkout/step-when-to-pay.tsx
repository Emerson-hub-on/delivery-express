'use client'
import { CheckoutSteps } from "@/types/checkout-steps"
import { useCheckoutStore } from "@/stores/checkout-store"

type Props = {
  setStep: (step: CheckoutSteps) => void
}

export const StepWhenToPay = ({ setStep }: Props) => {
  const { deliveryType, setPayWhen } = useCheckoutStore(s => s)
  const isPickup = deliveryType === 'pickup'

  const handleNow = () => {
    setPayWhen('now')
    setStep('payment')
  }

  const handleLater = () => {
    setPayWhen('on-delivery')
    // Não define paymentMethod aqui — o cliente escolhe na tela de pagamento
    setStep('payment')
  }

  const laterLabel = isPickup ? 'Pagar na retirada' : 'Pagar na entrega'
  const laterDescription = isPickup
    ? 'Escolha a forma de pagamento para a retirada'
    : 'Escolha a forma de pagamento para a entrega'

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-500 text-center">Quando você quer pagar?</p>

      <button
        onClick={handleNow}
        className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-black hover:bg-gray-50 transition-all text-left"
      >
        <span className="text-2xl">💳</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Pagar agora</p>
          <p className="text-xs text-gray-400">Pix, cartão de crédito ou débito</p>
        </div>
      </button>

      <button
        onClick={handleLater}
        className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-black hover:bg-gray-50 transition-all text-left"
      >
        <span className="text-2xl">🤝</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{laterLabel}</p>
          <p className="text-xs text-gray-400">{laterDescription}</p>
        </div>
      </button>

      <button
        onClick={() => setStep(isPickup ? 'delivery' : 'address')}
        className="text-sm text-gray-400 hover:text-gray-600 text-center mt-1"
      >
        ← Voltar
      </button>
    </div>
  )
}
