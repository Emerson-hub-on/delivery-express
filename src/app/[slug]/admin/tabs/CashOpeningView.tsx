'use client'
import { useEffect, useState } from 'react'
import { Operator, CashRegister } from '@/types/cash-register'
import { getOperators, openCashRegister, getLastClosedCashRegister } from '@/services/cash-register'

const CHECKLIST_ITEMS = [
  'Conferir valor em dinheiro na gaveta',
  'Verificar funcionamento da impressora fiscal',
  'Testar terminal de pagamento',
  'Confirmar conexão com sistema',
  'Verificar estoque de produtos principais',
  'Organizar área de atendimento',
]

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

interface Props {
  openingTime: string  // ex: "08:00"
  onOpened: (cash: CashRegister) => void
}

export function CashOpeningView({ openingTime, onOpened }: Props) {
  const [operators, setOperators] = useState<Operator[]>([])
  const [lastCash, setLastCash] = useState<CashRegister | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('')
  const [manualOperator, setManualOperator] = useState('')
  const [openingAmount, setOpeningAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})

  useEffect(() => {
    Promise.all([getOperators(), getLastClosedCashRegister()])
      .then(([ops, last]) => {
        setOperators(ops)
        setLastCash(last)
        if (ops.length > 0) setSelectedOperatorId(ops[0].id)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const toggleChecklist = (item: string) => {
    setChecklist(prev => ({ ...prev, [item]: !prev[item] }))
  }

  const allChecked = CHECKLIST_ITEMS.every(i => checklist[i])

  // Horário de abertura configurado para hoje
  const today = new Date().toLocaleDateString('pt-BR')
  const openingLabel = `${today} às ${openingTime}`

  const operatorName = selectedOperatorId === '__manual__'
    ? manualOperator.trim()
    : operators.find(o => o.id === selectedOperatorId)?.name ?? ''

  const handleOpen = async () => {
    if (!operatorName) return setError('Selecione ou informe o operador.')
    const amount = parseFloat(openingAmount.replace(',', '.'))
    if (isNaN(amount) || amount < 0) return setError('Informe o valor inicial válido.')

    try {
      setSaving(true)
      setError(null)
      const cash = await openCashRegister({
        operator_id: selectedOperatorId !== '__manual__' ? selectedOperatorId : undefined,
        operator_name: operatorName,
        opening_amount: amount,
        opening_notes: notes || undefined,
        checklist: CHECKLIST_ITEMS.filter(i => checklist[i]),
      })
      onOpened(cash)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="text-center py-16 text-gray-400 text-sm">Carregando...</div>
  )

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-10">

      {/* Horário de abertura */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl shrink-0">
          🕐
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-800">Horário de Abertura</p>
          <p className="text-sm text-blue-600">{openingLabel}</p>
        </div>
      </div>

      {/* Último fechamento */}
      {lastCash && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4">Último Fechamento</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Data', value: fmtDate(lastCash.closing_at!) },
              { label: 'Operador', value: lastCash.closing_operator_name ?? lastCash.operator_name },
              { label: 'Total de Vendas', value: fmtBRL(lastCash.total_sales ?? 0) },
              { label: 'Dinheiro Fechamento', value: fmtBRL(lastCash.closing_amount ?? 0) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="text-sm font-semibold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulário de abertura */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-5">
        <p className="text-sm font-semibold text-gray-800">Dados de Abertura</p>

        {/* Operador */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            <span className="mr-1">👤</span> Operador
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

        {/* Valor inicial */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            <span className="mr-1">💵</span> Valor Inicial em Dinheiro
          </label>
          <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-black">
            <span className="text-sm text-gray-400 mr-2">R$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="0,00"
              value={openingAmount}
              onChange={e => setOpeningAmount(e.target.value)}
              className="flex-1 text-sm font-semibold focus:outline-none"
            />
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Observações (opcional)
          </label>
          <textarea
            rows={3}
            placeholder="Adicione observações sobre a abertura..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-800 mb-4">Checklist de Abertura</p>
        <div className="flex flex-col gap-3">
          {CHECKLIST_ITEMS.map(item => (
            <label key={item} className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => toggleChecklist(item)}
                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
                  ${checklist[item]
                    ? 'bg-gray-900 border-gray-900'
                    : 'border-gray-300 group-hover:border-gray-500'}`}
              >
                {checklist[item] && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span className={`text-sm transition-colors ${checklist[item] ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                {item}
              </span>
            </label>
          ))}
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
          onClick={() => setChecklist({})}
          className="text-sm px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleOpen}
          disabled={saving}
          className={`flex items-center gap-2 text-sm px-6 py-2.5 rounded-xl font-medium transition-colors
            ${allChecked
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-900 hover:bg-gray-700 text-white'
            } disabled:opacity-50`}
        >
          {allChecked && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {saving ? 'Abrindo...' : 'Abrir Caixa'}
        </button>
      </div>
    </div>
  )
}
