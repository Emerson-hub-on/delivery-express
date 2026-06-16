'use client'
import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegraConversao = {
  id: number
  cfop_origem: string
  cst_origem: string
  crt: number
  cfop_entrada: string
  cst_entrada: string
  finalidade: string
  tem_icms: boolean
  descricao: string | null
  created_at: string
}

type RegraInput = Omit<RegraConversao, 'id' | 'created_at'>

// ─── Constants ────────────────────────────────────────────────────────────────

const FINALIDADES = [
  { value: 'revenda',          label: 'Revenda' },
  { value: 'uso_consumo',      label: 'Uso e consumo' },
  { value: 'ativo',            label: 'Ativo imobilizado' },
  { value: 'industrializacao', label: 'Industrialização' },
  { value: 'devolucao',        label: 'Devolução' },
  { value: 'bonificacao',      label: 'Bonificação' },
  { value: 'outros',           label: 'Outros' },
] as const

const CRT_OPTIONS = [
  { value: 1, label: 'CRT 1 — Simples Nacional' },
  { value: 2, label: 'CRT 2 — Simples Nacional (Excesso)' },
  { value: 3, label: 'CRT 3 — Regime Normal' },
]

const FINALIDADE_BADGE: Record<string, string> = {
  revenda:          'bg-blue-50 text-blue-700 border-blue-200',
  uso_consumo:      'bg-amber-50 text-amber-700 border-amber-200',
  ativo:            'bg-gray-100 text-gray-600 border-gray-200',
  industrializacao: 'bg-green-50 text-green-700 border-green-200',
  devolucao:        'bg-red-50 text-red-600 border-red-200',
  bonificacao:      'bg-purple-50 text-purple-700 border-purple-200',
  outros:           'bg-gray-100 text-gray-500 border-gray-200',
}

const EMPTY_FORM: RegraInput = {
  cfop_origem:  '',
  cst_origem:   '',
  crt:          3,
  cfop_entrada: '',
  cst_entrada:  '',
  finalidade:   'revenda',
  tem_icms:     true,
  descricao:    null,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function finalidadeLabel(v: string) {
  return FINALIDADES.find(f => f.value === v)?.label ?? v
}

function crtLabel(v: number) {
  return CRT_OPTIONS.find(c => c.value === v)?.label ?? `CRT ${v}`
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  initial: RegraInput
  editId: number | null
  onClose: () => void
  onSaved: (r: RegraConversao) => void
  onError: (msg: string) => void
}

function RegraModal({ initial, editId, onClose, onSaved, onError }: ModalProps) {
  const [form, setForm]       = useState<RegraInput>(initial)
  const [saving, setSaving]   = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)

  const set = (k: keyof RegraInput, v: unknown) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!/^\d{4}$/.test(form.cfop_origem)) {
      setFormErr('CFOP de origem deve ter exatamente 4 dígitos numéricos'); return
    }
    if (!/^\d{4}$/.test(form.cfop_entrada)) {
      setFormErr('CFOP de entrada deve ter exatamente 4 dígitos numéricos'); return
    }
    if (!form.cst_entrada.trim()) {
      setFormErr('CST de entrada é obrigatório'); return
    }
    setFormErr(null)
    setSaving(true)
    try {
      const method = editId ? 'PUT' : 'POST'
      const body   = editId ? { ...form, id: editId } : form
      const res    = await fetch('/api/fiscal/nf-entrada/conversao-regras', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'Erro ao salvar')
      onSaved(json.regra as RegraConversao)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md flex flex-col"
        style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">
            {editId ? 'Editar regra de conversão' : 'Nova regra de conversão'}
          </h3>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded">
            ✕
          </button>
        </div>

        {/* Body com scroll */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Origem + Entrada em linha */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Origem → Entrada
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FieldInput
                label="CFOP de origem"
                value={form.cfop_origem}
                onChange={v => set('cfop_origem', v.replace(/\D/g, '').slice(0, 4))}
                placeholder="ex: 6661"
                hint="CFOP que vem na nota"
                mono
              />
              <FieldInput
                label="CST de origem"
                value={form.cst_origem}
                onChange={v => set('cst_origem', v.slice(0, 4))}
                placeholder="ex: 061"
                hint="Vazio = qualquer CST"
                mono
              />
              <FieldInput
                label="CFOP de entrada"
                value={form.cfop_entrada}
                onChange={v => set('cfop_entrada', v.replace(/\D/g, '').slice(0, 4))}
                placeholder="ex: 2102"
                mono
              />
              <FieldInput
                label="CST de entrada"
                value={form.cst_entrada}
                onChange={v => set('cst_entrada', v.slice(0, 4))}
                placeholder="ex: 0500"
                mono
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* CRT + ICMS em linha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">
                Regime (CRT)
              </label>
              <div className="relative">
                <select
                  value={form.crt}
                  onChange={e => set('crt', Number(e.target.value))}
                  className="w-full appearance-none border border-gray-200 rounded-lg px-3 py-2
                    text-sm text-gray-800 bg-white focus:outline-none focus:ring-2
                    focus:ring-blue-100 focus:border-blue-400 pr-7"
                >
                  {CRT_OPTIONS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2
                  text-gray-400 text-xs">▾</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">
                Base de ICMS?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[{ v: false, label: 'Não' }, { v: true, label: 'Sim' }].map(opt => (
                  <button
                    key={String(opt.v)}
                    onClick={() => set('tem_icms', opt.v)}
                    className={`flex items-center justify-center gap-1 py-2 rounded-lg border text-sm
                      transition-colors font-medium
                      ${form.tem_icms === opt.v
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                  >
                    {form.tem_icms === opt.v ? '✓ ' : ''}{opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Finalidade — horizontal compacto */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-2 block">
              Finalidade
            </label>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {FINALIDADES.map(f => (
                <label key={f.value}
                  className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="radio"
                    name="finalidade"
                    value={f.value}
                    checked={form.finalidade === f.value}
                    onChange={() => set('finalidade', f.value)}
                    className="accent-blue-600"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">
              Descrição (opcional)
            </label>
            <input
              type="text"
              value={form.descricao ?? ''}
              onChange={e => set('descricao', e.target.value || null)}
              placeholder="ex: GLP botijão P13 — interestadual"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800
                focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
            />
          </div>

          {/* Erro */}
          {formErr && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200
              rounded-lg px-3 py-2">
              {formErr}
            </div>
          )}
        </div>

        {/* Footer — sempre visível */}
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-gray-100 shrink-0">
          <button onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200
              text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-medium
              hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? 'Salvando…' : '💾 Salvar regra'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function FieldInput({
  label, value, onChange, placeholder, hint, mono = false, maxLength,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; hint?: string; mono?: boolean; maxLength?: number
}) {
  return (
    <div>
      <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5 block">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}  // ← adiciona
        className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800
          focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400
          ${mono ? 'font-mono tracking-wider' : ''}`}
      />
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

// ─── Confirm delete ───────────────────────────────────────────────────────────

function ConfirmDelete({
  regra, onCancel, onConfirm, loading,
}: {
  regra: RegraConversao; onCancel: () => void; onConfirm: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-sm p-5">
        <p className="text-sm font-semibold text-gray-900 mb-2">Excluir regra de conversão</p>
        <p className="text-xs text-gray-500 mb-4">
          Deseja remover a regra{' '}
          <span className="font-mono font-semibold text-gray-700">
            {regra.cfop_origem} → {regra.cfop_entrada}
          </span>
          {' '}({finalidadeLabel(regra.finalidade)})?
          Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200
              text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="text-sm px-4 py-2 rounded-lg border border-red-200
              text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
            {loading ? '…' : '🗑 Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onError?: (msg: string) => void
}

export function ConversaoRegrasManager({ onError }: Props) {
  const [regras,      setRegras]      = useState<RegraConversao[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState<{ open: boolean; editId: number | null }>({
    open: false, editId: null,
  })
  const [deleting,    setDeleting]    = useState<RegraConversao | null>(null)
  const [deleteLoad,  setDeleteLoad]  = useState(false)
  const [toast,       setToast]       = useState<string | null>(null)

  // filters
  const [busca,       setBusca]       = useState('')
  const [filtroFin,   setFiltroFin]   = useState('')
  const [filtroCrt,   setFiltroCrt]   = useState('')

  const notifyError = (msg: string) => {
    onError?.(msg)
    showToast('❌ ' + msg)
  }
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const fetchRegras = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroFin) params.set('finalidade', filtroFin)
      if (filtroCrt) params.set('crt', filtroCrt)
      if (busca)     params.set('busca', busca)

      const res  = await fetch(`/api/fiscal/nf-entrada/conversao-regras?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      setRegras(json.regras)
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Erro ao carregar regras')
    } finally {
      setLoading(false)
    }
  }, [filtroFin, filtroCrt, busca])

  useEffect(() => { fetchRegras() }, [fetchRegras])

  const handleSaved = (r: RegraConversao) => {
    setRegras(prev => {
      const idx = prev.findIndex(x => x.id === r.id)
      if (idx >= 0) { const copy = [...prev]; copy[idx] = r; return copy }
      return [...prev, r]
    })
    setModal({ open: false, editId: null })
    showToast('✓ Regra salva com sucesso')
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoad(true)
    try {
      const res = await fetch(`/api/fiscal/nf-entrada/conversao-regras?id=${deleting.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.message)
      }
      setRegras(prev => prev.filter(r => r.id !== deleting.id))
      setDeleting(null)
      showToast('✓ Regra excluída')
    } catch (e) {
      notifyError(e instanceof Error ? e.message : 'Erro ao excluir')
    } finally {
      setDeleteLoad(false)
    }
  }

  const editInitial = modal.editId
    ? (() => {
        const r = regras.find(x => x.id === modal.editId)!
        return r
          ? { cfop_origem: r.cfop_origem, cst_origem: r.cst_origem, crt: r.crt,
              cfop_entrada: r.cfop_entrada, cst_entrada: r.cst_entrada,
              finalidade: r.finalidade, tem_icms: r.tem_icms, descricao: r.descricao }
          : EMPTY_FORM
      })()
    : EMPTY_FORM

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Regras de conversão CFOP / CST
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Define como CFOPs e CSTs do emitente são convertidos conforme finalidade e regime tributário
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, editId: null })}
          className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg
            bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shrink-0"
        >
          + Nova regra
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por CFOP…"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700
            focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 w-44"
        />
        <div className="relative">
          <select
            value={filtroFin}
            onChange={e => setFiltroFin(e.target.value)}
            className="appearance-none border border-gray-200 rounded-lg px-3 py-1.5 pr-7
              text-sm text-gray-700 bg-white focus:outline-none focus:ring-2
              focus:ring-blue-100 focus:border-blue-400"
          >
            <option value="">Todas as finalidades</option>
            {FINALIDADES.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2
            text-gray-400 text-[10px]">▾</span>
        </div>
        <div className="relative">
          <select
            value={filtroCrt}
            onChange={e => setFiltroCrt(e.target.value)}
            className="appearance-none border border-gray-200 rounded-lg px-3 py-1.5 pr-7
              text-sm text-gray-700 bg-white focus:outline-none focus:ring-2
              focus:ring-blue-100 focus:border-blue-400"
          >
            <option value="">Todos os CRTs</option>
            {CRT_OPTIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2
            text-gray-400 text-[10px]">▾</span>
        </div>
        {(busca || filtroFin || filtroCrt) && (
          <button
            onClick={() => { setBusca(''); setFiltroFin(''); setFiltroCrt('') }}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 py-1.5
              border border-gray-200 rounded-lg"
          >
            ✕ Limpar
          </button>
        )}
        <span className="ml-auto text-[11px] text-gray-400">
          {loading ? 'Carregando…' : `${regras.length} regra${regras.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[680px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  ['CFOP orig.',   'left'],
                  ['CST orig.',    'left'],
                  ['CFOP entrada', 'left'],
                  ['CST entrada',  'left'],
                  ['Base ICMS',    'center'],
                  ['Finalidade',   'left'],
                  ['CRT',          'left'],
                  ['Descrição',    'left'],
                  ['',             'right'],
                ].map(([h, align]) => (
                  <th key={h}
                    className={`px-3 py-2.5 text-[10px] font-semibold text-gray-400
                      uppercase tracking-wide text-${align} whitespace-nowrap`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400 text-xs">
                    Carregando…
                  </td>
                </tr>
              ) : regras.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-400 text-xs">
                    Nenhuma regra encontrada. Clique em "Nova regra" para adicionar.
                  </td>
                </tr>
              ) : regras.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5">
                    <span className="font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[11px]">
                      {r.cfop_origem}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[11px]">
                      {r.cst_origem || <span className="text-gray-400 not-mono">qualquer</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono bg-blue-50 text-blue-700 border border-blue-100
                      px-1.5 py-0.5 rounded text-[11px]">
                      {r.cfop_entrada}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono bg-blue-50 text-blue-700 border border-blue-100
                      px-1.5 py-0.5 rounded text-[11px]">
                      {r.cst_entrada}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5
                      rounded-full border font-medium
                      ${r.tem_icms
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {r.tem_icms ? '✓ Sim' : '— Não'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-full border
                      font-medium ${FINALIDADE_BADGE[r.finalidade] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {finalidadeLabel(r.finalidade)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                    {crtLabel(r.crt).split('—')[0].trim()}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 max-w-[160px] truncate"
                    title={r.descricao ?? undefined}>
                    {r.descricao ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => setModal({ open: true, editId: r.id })}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200
                          text-gray-500 hover:bg-gray-100 transition-colors whitespace-nowrap">
                        ✏ Editar
                      </button>
                      <button
                        onClick={() => setDeleting(r)}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-red-200
                          text-red-500 hover:bg-red-50 transition-colors">
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-gray-200 bg-gray-100 inline-block font-mono" />
          CFOP/CST origem (nota)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-blue-100 bg-blue-50 inline-block" />
          CFOP/CST convertido (entrada)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="italic">CST origem vazio</span> = curinga (qualquer CST daquele CFOP)
        </span>
      </div>

      {/* Modal */}
      {modal.open && (
        <RegraModal
          initial={editInitial}
          editId={modal.editId}
          onClose={() => setModal({ open: false, editId: null })}
          onSaved={handleSaved}
          onError={notifyError}
        />
      )}

      {/* Confirm delete */}
      {deleting && (
        <ConfirmDelete
          regra={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
          loading={deleteLoad}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-xs
          px-4 py-2.5 rounded-xl shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}