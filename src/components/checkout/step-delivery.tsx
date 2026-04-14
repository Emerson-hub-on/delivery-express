'use client'
import { Dispatch, SetStateAction } from "react"
import { CheckoutSteps } from "@/types/checkout-steps"
import { useCheckoutStore } from "@/stores/checkout-store"
import { Button } from "@/components/ui/button"

type Props = {
  setStep: Dispatch<SetStateAction<CheckoutSteps>>
}

export const DELIVERY_FEE = 8.00

export const StepDelivery = ({ setStep }: Props) => {
  const { setDeliveryType, setDeliveryFee } = useCheckoutStore(state => state)

  const handleChoice = (type: 'delivery' | 'pickup') => {
    setDeliveryType(type)
    setDeliveryFee(type === 'delivery' ? DELIVERY_FEE : 0)
    setStep(type === 'delivery' ? 'address' : 'when-to-pay')  // pickup pula address
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-500 text-center">Como você quer receber seu pedido?</p>

      <button
        onClick={() => handleChoice('delivery')}
        className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-black hover:bg-gray-50 transition-all text-left"
      >
        <span className="text-2xl">🛵</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Entrega</p>
          <p className="text-xs text-gray-400">Receba no seu endereço</p>
        </div>
        <span className="text-xs font-medium text-orange-500 bg-orange-50 border border-orange-100 px-2 py-1 rounded-lg">
          + R$ {DELIVERY_FEE.toFixed(2)}
        </span>
      </button>

      <button
        onClick={() => handleChoice('pickup')}
        className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-black hover:bg-gray-50 transition-all text-left"
      >
        <span className="text-2xl">🏪</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Retirada no local</p>
          <p className="text-xs text-gray-400">Retire diretamente na loja</p>
        </div>
        <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-100 px-2 py-1 rounded-lg">
          Grátis
        </span>
      </button>

      <div className="flex justify-between mt-1">
        <Button variant="link" onClick={() => setStep('user')}>Anterior</Button>
      </div>
    </div>
  )
}