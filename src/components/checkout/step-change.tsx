'use client'
import { useState } from 'react'
import { useCheckoutStore } from '@/stores/checkout-store'
import { useCartStore } from '@/stores/cart-store'
import { Button } from '../ui/button'
import { Input } from '@/components/ui/input'
import { CheckoutSteps } from '@/types/checkout-steps'

type Props = {
  setStep: (step: CheckoutSteps) => void
}

function maskBRL(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const num = Number(digits) / 100
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseBRL(value: string): number {
  return Number(value.replace(/\D/g, '')) / 100
}

export const StepChange = ({ setStep }: Props) => {
  const { deliveryFee, setChange } = useCheckoutStore(s => s)
  const { cart } = useCartStore(s => s)
  const [inputValue, setInputValue] = useState('')
  const [noChange, setNoChange] = useState(false)

  const subtotal = cart.reduce((sum, item) => sum + item.totalWithAddons, 0)
  const total = subtotal + deliveryFee

  const paymentAmount = noChange ? total : parseBRL(inputValue)
  const difference = paymentAmount - total

  const changeLabel = (() => {
    if (noChange) return null
    if (!inputValue) return null
    if (difference < 0) return { type: 'short', value: Math.abs(difference) }
    if (difference === 0) return { type: 'exact', value: 0 }
    return { type: 'change', value: difference }
  })()

  const hasEnough = noChange || (!!inputValue && difference >= 0)
  const canContinue = noChange || (!!inputValue && hasEnough)

  const handleContinue = () => {
    if (!canContinue) return
    setChange(noChange ? null : difference)
    setStep('finish')
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-gray-500 text-center">
        Vai precisar de troco?
      </p>

      {/* Resumo do valor */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-center">
        <p className="text-xs text-gray-400 mb-0.5">Total do pedido</p>
        <p className="text-xl font-bold text-gray-900">
          {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </div>

      {/* Sem troco */}
      <button
        type="button"
        onClick={() => { setNoChange(true); setInputValue('') }}
        className={`flex items-center gap-4 p-4 border-2 rounded-xl transition-all text-left
          ${noChange ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
      >
        <span className="text-2xl">✅</span>
        <div>
          <p className="text-sm font-semibold text-gray-900">Não preciso de troco</p>
          <p className="text-xs text-gray-400">Vou pagar o valor exato</p>
        </div>
      </button>

      {/* Com troco */}
      <button
        type="button"
        onClick={() => setNoChange(false)}
        className={`flex items-center gap-4 p-4 border-2 rounded-xl transition-all text-left
          ${!noChange ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
      >
        <span className="text-2xl">💵</span>
        <div>
          <p className="text-sm font-semibold text-gray-900">Preciso de troco</p>
          <p className="text-xs text-gray-400">Informe com quanto vai pagar</p>
        </div>
      </button>

      {/* Input */}
      {!noChange && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Vou pagar com</label>
          <Input
            autoFocus
            placeholder="R$ 0,00"
            value={inputValue}
            onChange={e => setInputValue(maskBRL(e.target.value))}
          />

          {changeLabel && (
            <div className={`mt-1 px-3 py-2 rounded-lg text-sm font-medium
              ${changeLabel.type === 'short'
                ? 'bg-red-50 text-red-600'
                : changeLabel.type === 'exact'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-blue-50 text-blue-700'
              }`}>
              {changeLabel.type === 'short' &&
                `Faltam ${changeLabel.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para cobrir o pedido`
              }
              {changeLabel.type === 'exact' && 'Valor exato, sem troco'}
              {changeLabel.type === 'change' &&
                `Troco: ${changeLabel.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
              }
            </div>
          )}
        </div>
      )}

      <Button disabled={!canContinue} onClick={handleContinue}>
        Continuar
      </Button>

      <button
        onClick={() => setStep('payment')}
        className="text-sm text-gray-400 hover:text-gray-600 text-center"
      >
        ← Voltar
      </button>
    </div>
  )
}
