'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Operator = {
  id: string
  name: string
  pin: string | null
  active: boolean
  created_at: string
}

type FormState = {
  name: string
  pin: string
  active: boolean
}

const EMPTY_FORM: FormState = { name: '', pin: '', active: true }

// ── helpers ────────────────────────────────────────────────────────────────
async function getCompanyId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const uid = data.user?.id
  if (!uid) throw new Error('Não autenticado')
  const { data: co } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', uid)
    .single()
  if (!co) throw new Error('Empresa não encontrada')
  return co.id
}

// ── componente ─────────────────────────────────────────────────────────────
export function OperatorsView() {
  const [companyId, setCompanyId] = useState<string>('')
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const [showForm,  setShowForm]  = useState(false)
  const [editing,   setEditing]   = useState<Operator | null>(null)
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM)
  const [showPin,   setShowPin]   = useState(false)

  // ── load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const cid = await getCompanyId()
        setCompanyId(cid)
        await loadOperators(cid)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const loadOperators = async (cid: string) => {
    const { data, error } = await supabase
      .from('operators')
      .select('id, name, pin, active, created_at')
      .eq('company_id', cid)
      .order('name', { ascending: true })
    if (error) throw error
    setOperators(data ?? [])
  }

  // ── abrir form ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowPin(false)
    setShowForm(true)
  }

  const openEdit = (op: Operator) => {
    setEditing(op)
    setForm({ name: op.name, pin: op.pin ?? '', active: op.active })
    setShowPin(false)
    setShowForm(true)
  }

  // ── salvar ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError(null)
    const name = form.name.trim()
    const pin  = form.pin.trim()

    if (!name) { setError('Nome é obrigatório'); return }
    if (pin && !/^\d{4,6}$/.test(pin)) { setError('PIN deve ter 4 a 6 dígitos numéricos'); return }

    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase
          .from('operators')
          .update({ name, pin: pin || null, active: form.active })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('operators')
          .insert({ company_id: companyId, name, pin: pin || null, active: form.active })
        if (error) throw error
      }
      await loadOperators(companyId)
      setShowForm(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── toggle ativo ───────────────────────────────────────────────────────
  const toggleActive = async (op: Operator) => {
    await supabase
      .from('operators')
      .update({ active: !op.active })
      .eq('id', op.id)
    setOperators(prev => prev.map(o => o.id === op.id ? { ...o, active: !o.active } : o))
  }

  // ── render ─────────────────────────────────────────────────────────────
  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Carregando operadores…</div>

  return (
    <div>
      {/* Header da seção */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Operadores de Caixa</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Cadastre os operadores que acessarão o PDV com nome e PIN.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            + Novo operador
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-300 hover:text-red-500 text-xs">✕</button>
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">
            {editing ? 'Editar operador' : 'Novo operador'}
          </h3>
          <div className="flex flex-col gap-4">
            {/* Nome */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo do operador"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>

            {/* PIN */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                PIN numérico (4 a 6 dígitos)
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={form.pin}
                  onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder="Ex: 1234"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 pr-10 font-mono tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {showPin ? 'ocultar' : 'ver'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                O operador usará este PIN para entrar no PDV em <code className="bg-gray-100 px-1 rounded">/{'{slug}'}/pdv</code>
              </p>
            </div>

            {/* Ativo */}
            {editing && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4 rounded accent-black"
                />
                <span className="text-sm text-gray-700">Operador ativo</span>
              </label>
            )}

            {/* Botões */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-2 px-6 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {operators.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          <p className="text-3xl mb-3">👥</p>
          <p>Nenhum operador cadastrado ainda.</p>
          <p className="text-xs mt-1">Clique em "Novo operador" para começar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {operators.map(op => (
            <div
              key={op.id}
              className={`flex items-center justify-between bg-white border rounded-xl px-4 py-3 transition-colors
                ${op.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                  {op.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{op.name}</p>
                  <p className="text-xs text-gray-400">
                    PIN: {op.pin ? '••••' : <span className="text-amber-500">não definido</span>}
                    {' · '}
                    <span className={op.active ? 'text-green-600' : 'text-gray-400'}>
                      {op.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(op)}
                  className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleActive(op)}
                  className={`text-xs border rounded-lg px-3 py-1.5 transition-colors
                    ${op.active
                      ? 'text-red-500 border-red-100 hover:bg-red-50'
                      : 'text-green-600 border-green-100 hover:bg-green-50'}`}
                >
                  {op.active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}