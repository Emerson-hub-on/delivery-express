"use client"
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { Progress } from "../ui/progress"
import { StepUser } from "./step-user";
import { StepDelivery } from "./step-delivery";
import { StepAddress } from "./step-address";
import { StepWhenToPay } from "./step-when-to-pay";
import { StepPayment } from "./step-payment";
import { StepFinish } from "./step-finish";
import { StepCard } from "./step-card"
import { CheckoutSteps } from "@/types/checkout-steps";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { StepChange } from "./step-change";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CheckoutDialog = ({ open, onOpenChange }: Props) => {
  const [step, setStep] = useState<CheckoutSteps>('user');
  const [requireAuth, setRequireAuth] = useState(false)
  const params = useParams<{ slug: string }>()
  const [companyId, setCompanyId] = useState('')

const progressPct: Record<CheckoutSteps, number> = {
  user:          14,
  delivery:      28,
  address:       42,
  'when-to-pay': 56,
  payment:       70,
  card:          85,
  change:        92,  // ← novo
  finish:        100,
}

const stepTitle: Record<CheckoutSteps, string> = {
  user:          'Dados Pessoais',
  delivery:      'Tipo de entrega',
  address:       'Endereço de entrega',
  'when-to-pay': 'Quando pagar',
  payment:       'Forma de pagamento',
  card:          'Dados do cartão',
  change:        'Troco',              // ← novo
  finish:        'Finalizar pedido',
}

  const handleRequireAuth = () => {
  setRequireAuth(true)
  setStep('user')
}

useEffect(() => {
  if (!params?.slug) return
  supabase.from('companies').select('id').eq('slug', params.slug).maybeSingle()
    .then(({ data }) => { if (data) setCompanyId(data.id) })
}, [params?.slug])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
      aria-describedby={undefined}
      className="max-h-[90vh] flex flex-col overflow-hidden"
    >
        <DialogHeader className="shrink-0">
          <DialogTitle>{stepTitle[step]}</DialogTitle>
        </DialogHeader>

        <Progress value={progressPct[step]} className="shrink-0" />

        <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1 mt-1">
          {step === 'user' && (
          <StepUser
            setStep={(s) => { setRequireAuth(false); setStep(s) }}
            requireAuth={requireAuth}
            companyId={companyId}
          />
        )}
          {step === 'delivery'    && <StepDelivery setStep={setStep} />}
          {step === 'address'     && <StepAddress setStep={setStep} />}
          {step === 'when-to-pay' && <StepWhenToPay setStep={setStep} />}
          {step === 'payment'     && <StepPayment setStep={setStep} />}
          {step === 'change'      && <StepChange setStep={setStep} />}
          {step === 'card'        && <StepCard setStep={setStep} />}
          {step === 'finish'      && (
            <StepFinish setStep={setStep} onRequireAuth={handleRequireAuth} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}