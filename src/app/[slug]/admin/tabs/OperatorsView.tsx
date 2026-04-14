'use client'
import { useEffect, useState } from 'react'
import { Operator } from '@/types/cash-register'
import { getOperators, createOperator, updateOperator, deleteOperator } from '@/services/cash-register'

export function OperatorsView() {
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const ops = await getOperators()
      setOperators(ops)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setName('')
    setPin('')
    setError(null)
  }

  const handleEdit = (op: Operator) => {
    setEditingId(op.id)
    setName(op.name)
    setPin(op.pin ?? '')
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!name.trim()) return setError('Informe o nome do operador.')
    if (pin && !/^\d{4}$/.test(pin)) return setError('PIN deve ter exatamente 4 dígitos.')
    try {
      setSaving(true)
      setError(null)
      if (editingId) {
        const updated = await updateOperator(editingId, { name: name.trim(), pin: pin || undefined })
        setOperators(prev => prev.map(o => o.id === editingId ? updated : o))
      } else {
        const created = await createOperator(name.trim(), pin || undefined)
        setOperators(prev => [...prev, created])
      }
      resetForm()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Desativar este operador?')) return
    try {
      await deleteOperator(id)
      setOperators(prev => prev.filter(o => o.id !== id))
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">

      {/* Formulário */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
          <p className="text-sm font-semibold text-gray-800">
            {editingId ? 'Editar Operador' : 'Novo Operador'}
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Nome</label>
            <input
              type="text"
              placeholder="Ex: João Silva"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              PIN (opcional, 4 dígitos)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-xs text-gray-400 mt-1">
              O PIN pode ser usado para identificar o operador na abertura/fechamento
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-black text-white text-sm px-5 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar operador'}
            </button>
            <button
              onClick={resetForm}
              className="text-sm px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {operators.length} {operators.length === 1 ? 'operador cadastrado' : 'operadores cadastrados'}
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            + Novo operador
          </button>
        )}
      </div>

      {/* Lista */}
      {operators.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm bg-white border border-gray-200 rounded-2xl">
          Nenhum operador cadastrado.<br />
          <span className="text-xs">Crie operadores para identificar quem abre e fecha o caixa.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {operators.map(op => (
            <div key={op.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-base font-semibold text-gray-600">
                  {op.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{op.name}</p>
                  <p className="text-xs text-gray-400">{op.pin ? '🔒 PIN configurado' : 'Sem PIN'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleEdit(op)}
                  className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(op.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
