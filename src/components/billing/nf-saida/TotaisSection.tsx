'use client'
import { FORMAS_PAGAMENTO } from './constants'
import type { FormaPagamento } from './types'

interface Props {
  valorProdutos: number
  valorDesconto: number
  valorFrete: number
  valorTotal: number
  formaPagamento: FormaPagamento
  informacoesAdicionais: string
  chaveRef?: string
  showChaveRef?: boolean
  onDescontoChange: (v: number) => void
  onFreteChange: (v: number) => void
  onFormaPagamentoChange: (v: FormaPagamento) => void
  onInformacoesChange: (v: string) => void
  onChaveRefChange?: (v: string) => void
}

export function TotaisSection({
  valorProdutos,
  valorDesconto,
  valorFrete,
  valorTotal,
  formaPagamento,
  informacoesAdicionais,
  chaveRef,
  showChaveRef,
  onDescontoChange,
  onFreteChange,
  onFormaPagamentoChange,
  onInformacoesChange,
  onChaveRefChange,
}: Props) {
  return (
    <div className="bg-[#22262b] border border-[#2e3238] rounded-xl mb-3.5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2e3238]">
        <span className="text-[11px] font-semibold text-[#a0a5ad] tracking-wider uppercase">
          Totais
        </span>
      </div>

      <div className="p-4">
        {/* Cards de valor */}
        <div className="grid grid-cols-4 gap-2.5">
          {/* Produtos (readonly) */}
          <div className="bg-[#1a1c1e] border border-[#2e3238] rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-[#7a7f86] mb-1">Produtos</p>
            <p className="text-[15px] font-semibold text-[#e2e4e6]">{brl(valorProdutos)}</p>
          </div>

          {/* Desconto (editável) */}
          <div className="bg-[#1a1c1e] border border-[#2e3238] rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-[#7a7f86] mb-1">Desconto</p>
            <input
              type="text"
              value={valorDesconto ? brlRaw(valorDesconto) : ''}
              onChange={e => onDescontoChange(parseBrl(e.target.value))}
              placeholder="R$ 0"
              className="w-full bg-transparent text-[15px] font-semibold text-[#e2e4e6]
                placeholder-[#4a4f56] outline-none"
            />
          </div>

          {/* Frete (editável) */}
          <div className="bg-[#1a1c1e] border border-[#2e3238] rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-[#7a7f86] mb-1">Frete</p>
            <input
              type="text"
              value={valorFrete ? brlRaw(valorFrete) : ''}
              onChange={e => onFreteChange(parseBrl(e.target.value))}
              placeholder="R$ 0"
              className="w-full bg-transparent text-[15px] font-semibold text-[#e2e4e6]
                placeholder-[#4a4f56] outline-none"
            />
          </div>

          {/* Total (destaque) */}
          <div className="bg-[#1e3a5a] border border-[#2a5a8a] rounded-lg px-3 py-2.5">
            <p className="text-[11px] text-[#5a8ab0] mb-1">Total NF-e</p>
            <p className="text-[17px] font-semibold text-[#6cb8f0]">{brl(valorTotal)}</p>
          </div>
        </div>

        {/* Chave referenciada (devolução / anulatória) */}
        {showChaveRef && (
          <div className="mt-3">
            <label className="block text-[11px] text-[#7a7f86] mb-1">
              Chave NF-e referenciada <span className="text-[#e26b5a]">*</span>
            </label>
            <input
              type="text"
              value={chaveRef ?? ''}
              onChange={e => onChaveRefChange?.(e.target.value.replace(/\D/g, '').slice(0, 44))}
              placeholder="44 dígitos — chave da NF-e de origem"
              maxLength={44}
              className="w-full bg-[#1a1c1e] border border-[#3a3d42] focus:border-[#4a7ab5]
                rounded-md px-3 py-2 text-[13px] text-[#e2e4e6] placeholder-[#4a4f56]
                outline-none transition-colors font-mono"
            />
          </div>
        )}

        {/* Informações + forma de pagamento */}
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-[#7a7f86]">Informações adicionais</label>
            <textarea
              rows={3}
              value={informacoesAdicionais}
              onChange={e => onInformacoesChange(e.target.value)}
              placeholder="Obs.: Referente ao pedido nº..."
              className="bg-[#1a1c1e] border border-[#3a3d42] focus:border-[#4a7ab5]
                rounded-md px-3 py-2 text-[13px] text-[#e2e4e6] placeholder-[#4a4f56]
                outline-none transition-colors resize-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-[#7a7f86]">Forma de pagamento</label>
            <select
              value={formaPagamento}
              onChange={e => onFormaPagamentoChange(e.target.value as FormaPagamento)}
              className="bg-[#1a1c1e] border border-[#3a3d42] focus:border-[#4a7ab5]
                rounded-md px-3 py-2 text-[13px] text-[#e2e4e6]
                outline-none transition-colors h-9"
            >
              {FORMAS_PAGAMENTO.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── helpers ─────────────────────────────────────────────────── */
function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function brlRaw(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function parseBrl(s: string): number {
  return parseFloat(s.replace(/[^\d,]/g, '').replace(',', '.')) || 0
}
