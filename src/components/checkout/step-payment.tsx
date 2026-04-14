'use client'
import { useRef, useState } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import { useCheckoutStore } from '@/stores/checkout-store'
import { Button } from '../ui/button'
import { CheckoutSteps } from '@/types/checkout-steps'
import { Input } from '@/components/ui/input'

// Apenas os 4 métodos válidos no banco
const PAYMENT_OPTIONS = [
  { value: 'pix',     label: 'Pix',              icon: '💠' },
  { value: 'credito', label: 'Cartão de Crédito', icon: '💳' },
  { value: 'debito',  label: 'Cartão de Débito',  icon: '💳' },
  { value: 'dinheiro',label: 'Dinheiro',           icon: '💵' },
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
  const [cpfInput, setCpfInput]         = useState(cpf ? maskCpf(cpf) : '')
  const [cpfError, setCpfError]         = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaError, setCaptchaError] = useState('')
  const recaptchaRef = useRef<ReCAPTCHA>(null)

  // CPF só é obrigatório para Pix pagando agora (geração de QR via Mercado Pago)
  const needsCpf = (paymentMethod === 'pix' || paymentMethod === 'credito' || paymentMethod === 'debito') && payWhen === 'now'

  // Cartão de crédito/débito pagando agora vai para tela de cartão
  const isCardNow = (paymentMethod === 'credito' || paymentMethod === 'debito') && payWhen === 'now'

const handleContinue = async () => {
  if (needsCpf) {
    if (!isValidCpf(cpfInput)) {
      setCpfError('CPF inválido')
      return
    }
    setCpf(cpfInput.replace(/\D/g, ''))
  }

  // Pagar na entrega → não precisa de captcha, avança direto
  if (payWhen !== 'now') {
    // Dinheiro na entrega → pede troco antes
    if (paymentMethod === 'dinheiro') {
      setStep('change')
    } else {
      setStep('finish')
    }
    return
  }
  if (!captchaToken) {
    setCaptchaError('Por favor, confirme que você não é um robô.')
    return
  }

  try {
    const res = await fetch('/api/recaptcha/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: captchaToken }),
    })
    const data = await res.json()

    if (!data.success) {
      setCaptchaError('Verificação falhou. Tente novamente.')
      recaptchaRef.current?.reset()
      setCaptchaToken(null)
      return
    }

    setStep(isCardNow ? 'card' : 'finish')
  } catch (err) {
    console.error('[reCAPTCHA] erro:', err)
    setCaptchaError('Erro ao verificar. Tente novamente.')
  }
}

  const canContinue = !!paymentMethod && (!needsCpf || cpfInput.length === 14)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 text-center">
        {payWhen === 'now' ? 'Como você vai pagar?' : 'Qual a forma de pagamento?'}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {PAYMENT_OPTIONS.map(option => (
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

      {paymentMethod && payWhen === 'now' && (
        <div className="flex flex-col items-center gap-1">
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
            onChange={(token) => { setCaptchaToken(token); setCaptchaError('') }}
            onExpired={() => { setCaptchaToken(null); setCaptchaError('Verificação expirada. Refaça.') }}
            hl="pt-BR"
          />
          {captchaError && <p className="text-xs text-red-500">{captchaError}</p>}
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
