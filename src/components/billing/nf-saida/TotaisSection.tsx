'use client'
import { FORMAS_PAGAMENTO } from './constants'
import type { FormaPagamento } from './types'

interface Props {
  valorProdutos: number; valorDesconto: number; valorFrete: number; valorTotal: number
  formaPagamento: FormaPagamento; informacoesAdicionais: string
  chaveRef?: string; showChaveRef?: boolean
  onDescontoChange: (v: number) => void; onFreteChange: (v: number) => void
  onFormaPagamentoChange: (v: FormaPagamento) => void; onInformacoesChange: (v: string) => void
  onChaveRefChange?: (v: string) => void
}

export function TotaisSection({
  valorProdutos, valorDesconto, valorFrete, valorTotal,
  formaPagamento, informacoesAdicionais, chaveRef, showChaveRef,
  onDescontoChange, onFreteChange, onFormaPagamentoChange, onInformacoesChange, onChaveRefChange,
}: Props) {
  return (
    <div className="bg-white border border-gray-300 rounded-xl mb-3.5 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-300 bg-gray-100">
        <span className="text-[11px] font-bold text-gray-600 tracking-wider uppercase">Totais</span>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-4 gap-2.5">
          <div className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2.5">
            <p className="text-xs font-medium text-gray-500 mb-1">Produtos</p>
            <p className="text-sm font-bold text-gray-900">{brl(valorProdutos)}</p>
          </div>
          <div className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2.5">
            <p className="text-xs font-medium text-gray-500 mb-1">Desconto</p>
            <input type="text"
              value={valorDesconto ? brlRaw(valorDesconto) : ''}
              onChange={e => onDescontoChange(parseBrl(e.target.value))}
              placeholder="R$ 0"
              className="w-full bg-transparent text-sm font-bold text-gray-900 placeholder-gray-400 outline-none"
            />
          </div>
          <div className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2.5">
            <p className="text-xs font-medium text-gray-500 mb-1">Frete</p>
            <input type="text"
              value={valorFrete ? brlRaw(valorFrete) : ''}
              onChange={e => onFreteChange(parseBrl(e.target.value))}
              placeholder="R$ 0"
              className="w-full bg-transparent text-sm font-bold text-gray-900 placeholder-gray-400 outline-none"
            />
          </div>
          <div className="bg-green-100 border border-green-300 rounded-lg px-3 py-2.5">
            <p className="text-xs font-semibold text-green-700 mb-1">Total NF-e</p>
            <p className="text-base font-bold text-green-800">{brl(valorTotal)}</p>
          </div>
        </div>

        {showChaveRef && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Chave NF-e referenciada <span className="text-red-500">*</span>
            </label>
            <input type="text" value={chaveRef ?? ''}
              onChange={e => onChaveRefChange?.(e.target.value.replace(/\D/g, '').slice(0, 44))}
              placeholder="44 dígitos — chave da NF-e de origem" maxLength={44}
              className="w-full bg-gray-50 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200
                rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors font-mono"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Informações adicionais</label>
            <textarea rows={3} value={informacoesAdicionais} onChange={e => onInformacoesChange(e.target.value)}
              placeholder="Obs.: Referente ao pedido nº..."
              className="bg-gray-50 border border-gray-300 hover:border-gray-400 focus:border-blue-500
                focus:ring-1 focus:ring-blue-200 focus:bg-white rounded-lg px-3 py-2
                text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors resize-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Forma de pagamento</label>
            <select value={formaPagamento} onChange={e => onFormaPagamentoChange(e.target.value as FormaPagamento)}
              className="bg-gray-50 border border-gray-300 hover:border-gray-400 focus:border-blue-500
                focus:ring-1 focus:ring-blue-200 rounded-lg px-3 py-2 text-sm text-gray-900
                outline-none transition-colors">
              {FORMAS_PAGAMENTO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

function brl(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function brlRaw(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }
function parseBrl(s: string): number { return parseFloat(s.replace(/[^\d,]/g, '').replace(',', '.')) || 0 }
