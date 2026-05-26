'use client'
import { NfEntradaTab }       from './nf-entrada/NfEntradaTab'
import { NfSaidaTab }         from './nf-saida/NfSaidaTab'
import { NfSaidaGerenciador } from './nf-saida/NfSaidaGerenciador'

type BillingSubTab = 'nf-entrada' | 'nf-saida' | 'nf-saida-gerenciador'

interface Props {
  subTab: BillingSubTab
  onSubTabChange: (t: BillingSubTab) => void
  companyId: string
  onError?: (msg: string) => void
}

export function BillingTab({ subTab, onSubTabChange, companyId, onError }: Props) {
  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#2e3238]">
        <SubTabBtn
          active={subTab === 'nf-entrada'}
          onClick={() => onSubTabChange('nf-entrada')}
        >
          NF-e Entrada
        </SubTabBtn>
        <SubTabBtn
          active={subTab === 'nf-saida'}
          onClick={() => onSubTabChange('nf-saida')}
        >
          NF-e Saída / Faturamento
        </SubTabBtn>
        <SubTabBtn
          active={subTab === 'nf-saida-gerenciador'}
          onClick={() => onSubTabChange('nf-saida-gerenciador')}
        >
          Gerenciador de NF-e
        </SubTabBtn>
      </div>

      {subTab === 'nf-entrada' && (
        <NfEntradaTab companyId={companyId} onError={onError ?? (() => {})} />
      )}
      {subTab === 'nf-saida' && (
        <NfSaidaTab companyId={companyId} onError={onError ?? (() => {})} />
      )}
      {subTab === 'nf-saida-gerenciador' && (
        <NfSaidaGerenciador companyId={companyId} onError={onError} />
      )}
    </div>
  )
}

function SubTabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px
        ${active
          ? 'border-[#4a7ab5] text-[#6c9fd4]'
          : 'border-transparent text-[#7a7f86] hover:text-[#a0a5ad]'
        }`}
    >
      {children}
    </button>
  )
}