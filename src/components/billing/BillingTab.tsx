'use client'
import { NfEntradaTab } from './NfEntradaTab'

type BillingSubTab = 'nf-entrada'

interface BillingTabProps {
  subTab: BillingSubTab
  onSubTabChange: (sub: BillingSubTab) => void
  companyId: string
  onError: (msg: string) => void
}

export function BillingTab({ subTab, companyId, onError }: BillingTabProps) {
  return (
    <div>
      {subTab === 'nf-entrada' && (
        <NfEntradaTab companyId={companyId} onError={onError} />
      )}
    </div>
  )
}