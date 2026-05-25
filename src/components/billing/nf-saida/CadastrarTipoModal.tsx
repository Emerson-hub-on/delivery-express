'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { FINALIDADES } from './constants'
import type { TipoNotaCustom } from './types'

interface Props { open: boolean; onClose: () => void; onSave: (tipo: TipoNotaCustom) => void }
const EMPTY: Omit<TipoNotaCustom, 'key'> = { nome: '', natureza_operacao: '', cfop_padrao: '', finalidade: 1, direcao: 'saida' }

export function CadastrarTipoModal({ open, onClose, onSave }: Props) {
  const [form, setForm]     = useState(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY, string>>>({})

  if (!open) return null

  function set<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrors(prev => ({ ...prev, [k]: undefined }))
  }

  function handleSave() {
    const e: typeof errors = {}
    if (!form.nome.trim())              e.nome = 'Campo obrigatório'
    if (!form.natureza_operacao.trim()) e.natureza_operacao = 'Campo obrigatório'
    if (Object.keys(e).length) { setErrors(e); return }
    onSave({ ...form, key: `custom_${Date.now()}` })
    setForm(EMPTY); setErrors({}); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white border border-gray-300 rounded-xl w-[440px] max-w-[95vw] p-6 shadow-xl">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-[15px] font-bold text-gray-800">Cadastrar tipo de nota</h3>
            <p className="text-xs text-gray-500 mt-0.5">Crie um tipo personalizado conforme orientação do seu contador</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors"><X size={18} /></button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Nome do tipo <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)}
              placeholder="Ex.: Transferência entre filiais"
              className={`w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm text-gray-900
                placeholder-gray-400 outline-none transition-colors
                ${errors.nome ? 'border-red-400 focus:ring-1 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'}`}
            />
            {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Natureza da operação <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.natureza_operacao} onChange={e => set('natureza_operacao', e.target.value)}
              placeholder="Ex.: Transferência de mercadoria entre estabelecimentos"
              className={`w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm text-gray-900
                placeholder-gray-400 outline-none transition-colors
                ${errors.natureza_operacao ? 'border-red-400 focus:ring-1 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'}`}
            />
            {errors.natureza_operacao && <p className="text-xs text-red-500 mt-1">{errors.natureza_operacao}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">CFOP padrão</label>
            <input type="text" value={form.cfop_padrao}
              onChange={e => set('cfop_padrao', e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Ex.: 5152" maxLength={4}
              className="w-full bg-gray-50 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200
                rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Finalidade da NF-e</label>
            <select value={form.finalidade} onChange={e => set('finalidade', Number(e.target.value) as 1|2|3|4)}
              className="w-full bg-gray-50 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200
                rounded-lg px-3 py-2 text-sm text-gray-900 outline-none transition-colors">
              {FINALIDADES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Direção</label>
            <div className="flex gap-2">
              {(['saida', 'entrada'] as const).map(d => (
                <button key={d} type="button" onClick={() => set('direcao', d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors
                    ${form.direcao === d
                      ? 'border-blue-500 bg-blue-100 text-blue-800'
                      : 'border-gray-300 bg-gray-50 text-gray-600 hover:border-gray-400 hover:bg-gray-100'}`}>
                  {d === 'saida' ? 'Saída' : 'Entrada'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300
              rounded-lg hover:bg-gray-100 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave}
            className="px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
            Cadastrar
          </button>
        </div>
      </div>
    </div>
  )
}
