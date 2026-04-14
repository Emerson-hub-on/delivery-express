'use client'
import { useState } from 'react'
import { Motoboy } from '@/types/motoboy'
import { createMotoboy, updateMotoboy, deleteMotoboy } from '@/services/motoboys'

interface MotoboyTabProps {
  motoboys: Motoboy[]
  setMotoboys: React.Dispatch<React.SetStateAction<Motoboy[]>>
  loading: boolean
  showForm: boolean
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>
  onError: (msg: string | null) => void
}

const EMPTY_FORM = { name: '', email: '', phone: '', active: true, password: '' }

export function MotoboyTab({ motoboys, setMotoboys, loading, showForm, setShowForm, onError }: MotoboyTabProps) {
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showPass, setShowPass]   = useState(false)

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(false)
    setShowPass(false)
  }

  const handleEdit = (m: Motoboy) => {
    setForm({ name: m.name, email: m.email, phone: m.phone, active: m.active, password: '' })
    setEditingId(m.id)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      onError('Preencha nome, e-mail e telefone.')
      return
    }
    if (!editingId && !form.password.trim()) {
      onError('Informe uma senha para o motoboy.')
      return
    }

    setSaving(true)
    onError(null)
    try {
      if (editingId) {
        const payload: Partial<Omit<Motoboy, 'id' | 'created_at'>> & { password?: string } = {
          name:   form.name.trim(),
          email:  form.email.trim(),
          phone:  form.phone.trim(),
          active: form.active,
        }
        // Só atualiza senha se o campo foi preenchido
        if (form.password.trim()) {
          payload.password = form.password.trim()
        }
        const updated = await updateMotoboy(editingId, payload)
        setMotoboys(prev => prev.map(m => m.id === editingId ? updated : m))
      } else {
        const created = await createMotoboy({
          name:     form.name.trim(),
          email:    form.email.trim(),
          phone:    form.phone.trim(),
          active:   form.active,
          password: form.password.trim(),
        })
        setMotoboys(prev => [created, ...prev])
      }
      resetForm()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (m: Motoboy) => {
    try {
      const updated = await updateMotoboy(m.id, { active: !m.active })
      setMotoboys(prev => prev.map(x => x.id === m.id ? updated : x))
    } catch (e: any) {
      onError(e.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este motoboy?')) return
    try {
      await deleteMotoboy(id)
      setMotoboys(prev => prev.filter(m => m.id !== id))
    } catch (e: any) {
      onError(e.message)
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">Motoboys cadastrados</h3>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>
        </div>
      ) : (
        <>
          {/* ── Formulário ── */}
          {showForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-gray-800">
                {editingId ? 'Editar motoboy' : 'Novo motoboy'}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Nome *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nome completo"
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">E-mail *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Telefone *</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(99) 99999-9999"
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">
                    Senha {editingId ? '(deixe em branco para manter)' : '*'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder={editingId ? 'Nova senha (opcional)' : 'Senha de acesso'}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="active-check"
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="active-check" className="text-sm text-gray-600">Ativo</label>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="bg-black text-white text-sm px-5 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar'}
                </button>
                <button
                  onClick={resetForm}
                  className="text-sm px-5 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* ── Lista ── */}
          {motoboys.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-400 text-center py-8">Nenhum motoboy cadastrado.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {motoboys.map(m => (
                <div
                  key={m.id}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center gap-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0
                      ${m.active ? 'bg-gray-800' : 'bg-gray-300'}`}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.name}</p>
                      <p className="text-xs text-gray-500 truncate">{m.email}</p>
                      <p className="text-xs text-gray-400">📱 {m.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:ml-auto shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {m.active ? 'Ativo' : 'Inativo'}
                    </span>
                    <button
                      onClick={() => handleToggleActive(m)}
                      className="text-xs px-3 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      {m.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => handleEdit(m)}
                      className="text-xs px-3 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
