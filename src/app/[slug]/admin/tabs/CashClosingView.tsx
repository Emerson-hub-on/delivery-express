'use client'
import { useEffect, useMemo, useState } from 'react'
import { CashRegister, Operator } from '@/types/cash-register'
import { Order } from '@/types/product'
import { getOperators, closeCashRegister, saveDraftCashRegister } from '@/services/cash-register'
import { getOrdersByDateRange } from '@/services/orders'
import { getPaymentLabel, getPaymentGroup } from '@/lib/payment-labels'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const PAYMENT_GROUP_LABELS: Record<string, { label: string; icon: string }> = {
  credito:  { label: 'Cartão de Crédito', icon: '💳' },
  debito:   { label: 'Cartão de Débito',  icon: '💳' },
  pix:      { label: 'Pix',               icon: '💠' },
  dinheiro: { label: 'Dinheiro',           icon: '💵' },
  outro:    { label: 'Outros',             icon: '🔹' },
}

interface Props {
  cashRegister: CashRegister
  onClosed: () => void
}

export function CashClosingView({ cashRegister, onClosed }: Props) {
  const [operators, setOperators] = useState<Operator[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('')
  const [manualOperator, setManualOperator] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    const openDate = cashRegister.opening_at.slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)

    Promise.all([
      getOperators(),
      getOrdersByDateRange(openDate, today),
    ])
      .then(([ops, ords]) => {
        setOperators(ops)
        setOrders(ords)
        if (ops.length > 0) setSelectedOperatorId(ops[0].id)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [cashRegister.opening_at])

  // Pedidos do período (somente após a abertura)
  const periodOrders = useMemo(() =>
    orders.filter(o => o.created_at >= cashRegister.opening_at),
    [orders, cashRegister.opening_at]
  )

  const confirmedOrders = useMemo(() =>
    periodOrders.filter(o => o.status !== 'cancelled'),
    [periodOrders]
  )

  const cancelledOrders = useMemo(() =>
    periodOrders.filter(o => o.status === 'cancelled'),
    [periodOrders]
  )

  const totalSales = useMemo(() =>
    confirmedOrders.reduce((s, o) => s + (o.total ?? 0), 0),
    [confirmedOrders]
  )

  const totalCancelled = useMemo(() =>
    cancelledOrders.reduce((s, o) => s + (o.total ?? 0), 0),
    [cancelledOrders]
  )

  // Resumo por forma de pagamento (agrupado)
  const paymentSummary = useMemo(() => {
    const map: Record<string, { label: string; icon: string; total: number; count: number }> = {}
    confirmedOrders.forEach(o => {
      const group = getPaymentGroup(o.payment_method)
      const meta = PAYMENT_GROUP_LABELS[group] ?? PAYMENT_GROUP_LABELS.outro
      if (!map[group]) map[group] = { ...meta, total: 0, count: 0 }
      map[group].total += o.total ?? 0
      map[group].count += 1
    })
    return Object.entries(map)
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => b.total - a.total)
  }, [confirmedOrders])

  const operatorName = selectedOperatorId === '__manual__'
    ? manualOperator.trim()
    : operators.find(o => o.id === selectedOperatorId)?.name ?? ''

  const handleSaveDraft = async () => {
    try {
      setSaving(true)
      await saveDraftCashRegister(cashRegister.id, {
        closing_operator_name: operatorName || undefined,
        closing_amount: closingAmount ? parseFloat(closingAmount.replace(',', '.')) : undefined,
        closing_notes: notes || undefined,
      })
      alert('Rascunho salvo com sucesso.')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async () => {
    if (!operatorName) return setError('Selecione ou informe o operador.')
    const amount = parseFloat(closingAmount.replace(',', '.'))
    if (isNaN(amount) || amount < 0) return setError('Informe o valor em dinheiro no caixa.')

    if (!confirm('Confirmar fechamento do caixa? Essa ação não pode ser desfeita.')) return

    try {
      setSaving(true)
      setError(null)
      await closeCashRegister(cashRegister.id, {
        closing_operator_id: selectedOperatorId !== '__manual__' ? selectedOperatorId : undefined,
        closing_operator_name: operatorName,
        closing_amount: amount,
        closing_notes: notes || undefined,
        total_sales: totalSales,
        total_cancelled: totalCancelled,
      })
      onClosed()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="text-center py-16 text-gray-400 text-sm">Carregando dados do caixa...</div>
  )

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-10">

      {/* Header — info da abertura */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-800">Resumo da Abertura</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Aberto em',         value: fmtDateTime(cashRegister.opening_at) },
            { label: 'Operador Abertura', value: cashRegister.operator_name },
            { label: 'Valor de Abertura', value: fmtBRL(cashRegister.opening_amount) },
            { label: 'Pedidos no período', value: String(confirmedOrders.length) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-sm font-semibold text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo de vendas */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-800 mb-4">Resumo de Vendas</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
            <p className="text-xs text-green-600 mb-1">Total de Vendas</p>
            <p className="text-lg font-bold text-green-700">{fmtBRL(totalSales)}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
            <p className="text-xs text-red-600 mb-1">Cancelados</p>
            <p className="text-lg font-bold text-red-700">{fmtBRL(totalCancelled)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
            <p className="text-xs text-blue-600 mb-1">Pedidos</p>
            <p className="text-lg font-bold text-blue-700">{confirmedOrders.length}</p>
          </div>
        </div>
      </div>

      {/* Resumo por forma de pagamento */}
      {paymentSummary.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4">Resumo por Forma de Pagamento</p>
          <div className="flex flex-col gap-4">
            {paymentSummary.map(p => (
              <div key={p.key}>
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-sm font-medium text-gray-800">
                      {p.icon} {p.label}
                    </span>
                    <p className="text-xs text-gray-400">{p.count} {p.count === 1 ? 'transação' : 'transações'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{fmtBRL(p.total)}</p>
                    <p className="text-xs text-gray-400">
                      {totalSales > 0 ? ((p.total / totalSales) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: totalSales > 0 ? `${(p.total / totalSales) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-3 flex justify-between">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-sm font-semibold text-gray-900">{fmtBRL(totalSales)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Pedidos cancelados */}
      {cancelledOrders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4">
            Pedidos Cancelados ({cancelledOrders.length})
          </p>
          <div className="flex flex-col gap-2">
            {cancelledOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">#{o.code}</p>
                    <p className="text-xs text-gray-400">
                      {(o as any).cancellation_reason ?? 'Sem motivo informado'} ·{' '}
                      {new Date(o.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-red-600">{fmtBRL(o.total)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 pt-3 border-t border-red-100">
            <span className="text-sm font-medium text-gray-600">Total Cancelado:</span>
            <span className="text-sm font-semibold text-red-600">{fmtBRL(totalCancelled)}</span>
          </div>
        </div>
      )}

      {/* Formulário de fechamento */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-5">
        <p className="text-sm font-semibold text-gray-800">Dados de Fechamento</p>

        {/* Operador fechamento */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            <span className="mr-1">👤</span> Operador do Fechamento
          </label>
          {operators.length > 0 ? (
            <select
              value={selectedOperatorId}
              onChange={e => setSelectedOperatorId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            >
              {operators.map(op => (
                <option key={op.id} value={op.id}>{op.name}</option>
              ))}
              <option value="__manual__">Outro (digitar nome)</option>
            </select>
          ) : (
            <input
              type="text"
              placeholder="Nome do operador"
              value={manualOperator}
              onChange={e => setManualOperator(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          )}
          {selectedOperatorId === '__manual__' && (
            <input
              type="text"
              placeholder="Nome do operador"
              value={manualOperator}
              onChange={e => setManualOperator(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black mt-2"
            />
          )}
        </div>

        {/* Dinheiro no caixa */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            <span className="mr-1">💵</span> Dinheiro no Caixa (contagem física)
          </label>
          <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-black">
            <span className="text-sm text-gray-400 mr-2">R$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="0,00"
              value={closingAmount}
              onChange={e => setClosingAmount(e.target.value)}
              className="flex-1 text-sm font-semibold focus:outline-none"
            />
          </div>
          {/* Diferença em dinheiro */}
          {closingAmount && !isNaN(parseFloat(closingAmount)) && (() => {
            const cashInRegister = paymentSummary.find(p => p.key === 'dinheiro')?.total ?? 0
            const counted = parseFloat(closingAmount.replace(',', '.'))
            const diff = counted - (cashRegister.opening_amount + cashInRegister)
            const hasDiscrepancy = Math.abs(diff) > 0.01
            return hasDiscrepancy ? (
              <p className={`text-xs mt-1.5 font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {diff >= 0 ? '▲' : '▼'} Diferença de {fmtBRL(Math.abs(diff))} em relação ao esperado
                ({fmtBRL(cashRegister.opening_amount + cashInRegister)})
              </p>
            ) : (
              <p className="text-xs mt-1.5 text-green-600 font-medium">✓ Caixa conferido</p>
            )
          })()}
        </div>

        {/* Observações */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Observações (opcional)
          </label>
          <textarea
            rows={3}
            placeholder="Observações sobre o fechamento..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="text-sm px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Salvar Rascunho
        </button>
        <button
          onClick={handleClose}
          disabled={saving}
          className="flex items-center gap-2 text-sm px-6 py-2.5 rounded-xl font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {saving ? 'Fechando...' : 'Confirmar Fechamento'}
        </button>
      </div>
    </div>
  )
}
