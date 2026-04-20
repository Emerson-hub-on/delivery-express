'use client'
import { useState } from 'react'
import { useCheckoutStore } from '@/stores/checkout-store'
import { Button } from '../ui/button'
import { CheckoutSteps } from '@/types/checkout-steps'
import { Input } from '@/components/ui/input'

const PAYMENT_OPTIONS = [
  { value: 'pix',      label: 'Pix',              icon: '💠' },
  { value: 'credito',  label: 'Cartão de Crédito', icon: '💳' },
  { value: 'debito',   label: 'Cartão de Débito',  icon: '💳' },
  { value: 'dinheiro', label: 'Dinheiro',           icon: '💵' },
]

function isValidCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i)
  let rest = (sum * 10) % 11
  if (rest === 10 || rest === 11) rest = 0
  if (rest !== Number(digits[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i)
  rest = (sum * 10) % 11
  if (rest === 10 || rest === 11) rest = 0
  return rest === Number(digits[10])
}

function maskCpf(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

type Props = {
  setStep: (step: CheckoutSteps) => void
}

export const StepPayment = ({ setStep }: Props) => {
  const { paymentMethod, payWhen, cpf, setPaymentMethod, setCpf } = useCheckoutStore(s => s)
  const [cpfInput, setCpfInput] = useState(cpf ? maskCpf(cpf) : '')
  const [cpfError, setCpfError] = useState('')

  const needsCpf = (paymentMethod === 'pix' || paymentMethod === 'credito' || paymentMethod === 'debito') && payWhen === 'now'
  const isCardNow = (paymentMethod === 'credito' || paymentMethod === 'debito') && payWhen === 'now'

  const handleContinue = () => {
    if (needsCpf) {
      if (!isValidCpf(cpfInput)) {
        setCpfError('CPF inválido')
        return
      }
      setCpf(cpfInput.replace(/\D/g, ''))
    }

    if (payWhen !== 'now') {
      if (paymentMethod === 'dinheiro') {
        setStep('change')
      } else {
        setStep('finish')
      }
      return
    }

    setStep(isCardNow ? 'card' : 'finish')
  }

  const canContinue = !!paymentMethod && (!needsCpf || cpfInput.length === 14)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 text-center">
        {payWhen === 'now' ? 'Como você vai pagar?' : 'Qual a forma de pagamento?'}
      </p>
    <div className="grid grid-cols-2 gap-3">
      {PAYMENT_OPTIONS
        .filter(option => !(payWhen === 'now' && option.value === 'dinheiro'))
        .map(option => (
          <button
            key={option.value}
            onClick={() => { setPaymentMethod(option.value); setCpfError('') }}
            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all
              ${paymentMethod === option.value
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
              }`}
          >
            <span className="text-2xl">{option.icon}</span>
            <span className="text-xs font-medium text-gray-700 text-center">{option.label}</span>
          </button>
        ))}
    </div>

      {needsCpf && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">CPF (necessário para gerar o Pix)</label>
          <Input
            placeholder="000.000.000-00"
            value={cpfInput}
            onChange={e => { setCpfInput(maskCpf(e.target.value)); setCpfError('') }}
          />
          {cpfError && <p className="text-xs text-red-500">{cpfError}</p>}
        </div>
      )}

      <Button disabled={!canContinue} onClick={handleContinue}>
        Continuar
      </Button>

      <button
        onClick={() => setStep('when-to-pay')}
        className="text-sm text-gray-400 hover:text-gray-600 text-center"
      >
        ← Voltar
      </button>
    </div>
  )
}