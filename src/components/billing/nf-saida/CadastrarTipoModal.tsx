'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { FINALIDADES } from './constants'
import type { TipoNotaCustom } from './types'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (tipo: TipoNotaCustom) => void
}

const EMPTY: Omit<TipoNotaCustom, 'key'> = {
  nome: '',
  natureza_operacao: '',
  cfop_padrao: '',
  finalidade: 1,
  direcao: 'saida',
}

export function CadastrarTipoModal({ open, onClose, onSave }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY, string>>>({})

  if (!open) return null

  function set<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrors(prev => ({ ...prev, [k]: undefined }))
  }

  function validate() {
    const e: typeof errors = {}
    if (!form.nome.trim())               e.nome = 'Campo obrigatório'
    if (!form.natureza_operacao.trim())  e.natureza_operacao = 'Campo obrigatório'
    return e
  }

  function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    onSave({ ...form, key: `custom_${Date.now()}` })
    setForm(EMPTY)
    setErrors({})
    onClose()
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={handleBackdrop}
    >
      <div className="bg-[#22262b] border border-[#3a3d42] rounded-xl w-[440px] max-w-[95vw] p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-[15px] font-semibold text-[#f0f2f4]">Cadastrar tipo de nota</h3>
            <p className="text-[12px] text-[#7a7f86] mt-0.5">
              Crie um tipo personalizado conforme orientação do seu contador
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#5a5f66] hover:text-[#a0a5ad] transition-colors mt-0.5"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-[11px] text-[#7a7f86] mb-1">
              Nome do tipo <span className="text-[#e26b5a]">*</span>
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              placeholder="Ex.: Transferência entre filiais"
              className={`w-full bg-[#1a1c1e] border rounded-md px-3 py-2 text-[13px] text-[#e2e4e6]
                placeholder-[#4a4f56] outline-none transition-colors
                ${errors.nome ? 'border-[#e26b5a]' : 'border-[#3a3d42] focus:border-[#4a7ab5]'}`}
            />
            {errors.nome && <p className="text-[11px] text-[#e26b5a] mt-1">{errors.nome}</p>}
          </div>

          {/* Natureza */}
          <div>
            <label className="block text-[11px] text-[#7a7f86] mb-1">
              Natureza da operação <span className="text-[#e26b5a]">*</span>
            </label>
            <input
              type="text"
              value={form.natureza_operacao}
              onChange={e => set('natureza_operacao', e.target.value)}
              placeholder="Ex.: Transferência de mercadoria entre estabelecimentos"
              className={`w-full bg-[#1a1c1e] border rounded-md px-3 py-2 text-[13px] text-[#e2e4e6]
                placeholder-[#4a4f56] outline-none transition-colors
                ${errors.natureza_operacao
                  ? 'border-[#e26b5a]'
                  : 'border-[#3a3d42] focus:border-[#4a7ab5]'}`}
            />
            {errors.natureza_operacao && (
              <p className="text-[11px] text-[#e26b5a] mt-1">{errors.natureza_operacao}</p>
            )}
          </div>

          {/* CFOP */}
          <div>
            <label className="block text-[11px] text-[#7a7f86] mb-1">CFOP padrão</label>
            <input
              type="text"
              value={form.cfop_padrao}
              onChange={e => set('cfop_padrao', e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Ex.: 5152"
              maxLength={4}
              className="w-full bg-[#1a1c1e] border border-[#3a3d42] focus:border-[#4a7ab5]
                rounded-md px-3 py-2 text-[13px] text-[#e2e4e6] placeholder-[#4a4f56]
                outline-none transition-colors"
            />
          </div>

          {/* Finalidade */}
          <div>
            <label className="block text-[11px] text-[#7a7f86] mb-1">Finalidade da NF-e</label>
            <select
              value={form.finalidade}
              onChange={e => set('finalidade', Number(e.target.value) as 1 | 2 | 3 | 4)}
              className="w-full bg-[#1a1c1e] border border-[#3a3d42] focus:border-[#4a7ab5]
                rounded-md px-3 py-2 text-[13px] text-[#e2e4e6] outline-none transition-colors"
            >
              {FINALIDADES.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Direção */}
          <div>
            <label className="block text-[11px] text-[#7a7f86] mb-2">Direção</label>
            <div className="flex gap-2">
              {(['saida', 'entrada'] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set('direcao', d)}
                  className={`flex-1 py-2 rounded-md text-[13px] border transition-colors capitalize
                    ${form.direcao === d
                      ? 'border-[#4a7ab5] bg-[#1e3040] text-[#6c8ebf]'
                      : 'border-[#3a3d42] bg-[#1a1c1e] text-[#7a7f86] hover:border-[#5a5f66]'
                    }`}
                >
                  {d === 'saida' ? 'Saída' : 'Entrada'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-[#7a7f86] border border-[#3a3d42]
              rounded-lg hover:bg-[#2e3238] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-[13px] font-semibold text-[#90c8f0] bg-[#1e4a7a]
              border border-[#2a6aad] rounded-lg hover:bg-[#245c96] transition-colors"
          >
            Cadastrar
          </button>
        </div>
      </div>
    </div>
  )
}
