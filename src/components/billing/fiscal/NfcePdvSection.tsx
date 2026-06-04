'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Plus, ChevronDown, ChevronUp, Save, Trash2,
  Loader2, CheckCircle2, AlertTriangle, Store,
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface NfcePdv {
  id:         string
  company_id: string
  nome:       string
  serie:      string
  csc_id:     string
  csc_token:  string
  ultimo:     number
  ativo:      boolean
}

interface Props {
  companyId: string
  onError:   (msg: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const inputCls = 'w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white ' +
  'text-gray-800 outline-none focus:border-[#1a4a8a] focus:ring-2 focus:ring-[#1a4a8a]/10 ' +
  'transition-all placeholder-gray-300 disabled:opacity-50'
const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

const EMPTY_PDV = (companyId: string): Omit<NfcePdv, 'id'> => ({
  company_id: companyId,
  nome:       'Novo PDV',
  serie:      '',
  csc_id:     '',
  csc_token:  '',
  ultimo:     0,
  ativo:      true,
})

// ── Componente ────────────────────────────────────────────────────────────────
export function NfcePdvSection({ companyId, onError }: Props) {
  const [pdvs,        setPdvs]        = useState<NfcePdv[]>([])
  const [loading,     setLoading]     = useState(true)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [savingId,    setSavingId]    = useState<string | null>(null)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [savedId,     setSavedId]     = useState<string | null>(null)
  const [adding,      setAdding]      = useState(false)

  // ── Carrega PDVs ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return
    supabase
      .from('nfce_pdv')
      .select('*')
      .eq('company_id', companyId)
      .order('serie')
      .then(({ data, error }) => {
        console.log('[NfcePdv] companyId:', companyId, '| data:', data, '| error:', error)
        if (error) onError(error.message)
        else setPdvs((data ?? []) as NfcePdv[])
        setLoading(false)
      })
  }, [companyId])

  // ── Atualiza campo local ─────────────────────────────────────────────────
  function updateField(id: string, field: keyof NfcePdv, value: unknown) {
    setPdvs(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  // ── Adicionar novo PDV ──────────────────────────────────────────────────
  async function handleAdd() {
    setAdding(true)
    try {
      const { data, error } = await supabase
        .from('nfce_pdv')
        .insert(EMPTY_PDV(companyId))
        .select()
        .single()
      if (error) throw new Error(error.message)
      const novo = data as NfcePdv
      setPdvs(prev => [...prev, novo])
      setExpandedId(novo.id)
    } catch (e: any) {
      onError(e.message)
    } finally {
      setAdding(false)
    }
  }

  // ── Salvar PDV ──────────────────────────────────────────────────────────
  async function handleSave(pdv: NfcePdv) {
    // Valida série
    const serie = pdv.serie.replace(/\D/g, '').padStart(3, '0')
    if (!serie || serie === '000') {
      onError('Informe uma série válida (ex: 001)')
      return
    }

    setSavingId(pdv.id)
    try {
      const { error } = await supabase
        .from('nfce_pdv')
        .update({
          nome:      pdv.nome,
          serie:     serie,
          csc_id:    pdv.csc_id,
          csc_token: pdv.csc_token,
          ultimo:    pdv.ultimo,
          ativo:     pdv.ativo,
        })
        .eq('id', pdv.id)
        .eq('company_id', companyId)

      if (error) throw new Error(error.message)

      // Atualiza série formatada localmente
      updateField(pdv.id, 'serie', serie)
      setSavedId(pdv.id)
      setTimeout(() => setSavedId(null), 2500)
    } catch (e: any) {
      onError(e.message)
    } finally {
      setSavingId(null)
    }
  }

  // ── Excluir PDV ─────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Excluir este PDV? Esta ação não pode ser desfeita.')) return
    setDeletingId(id)
    try {
      const { error } = await supabase
        .from('nfce_pdv')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId)
      if (error) throw new Error(error.message)
      setPdvs(prev => prev.filter(p => p.id !== id))
      if (expandedId === id) setExpandedId(null)
    } catch (e: any) {
      onError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">PDVs — NFC-e</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Cada PDV tem série e CSC próprios independentes
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
            bg-[#1a4a8a] text-white rounded-lg hover:bg-[#1a4a8a]/90
            disabled:opacity-50 transition-colors"
        >
          {adding
            ? <Loader2 size={13} className="animate-spin" />
            : <Plus size={13} />
          }
          Adicionar PDV
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-xs">Carregando PDVs...</span>
        </div>
      )}

      {/* Vazio */}
      {!loading && pdvs.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Store size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum PDV cadastrado.</p>
          <p className="text-xs mt-1">Clique em "Adicionar PDV" para começar.</p>
        </div>
      )}

      {/* Lista de PDVs */}
      {!loading && pdvs.map((pdv, idx) => {
        const expanded  = expandedId === pdv.id
        const isSaving  = savingId  === pdv.id
        const isDeleting = deletingId === pdv.id
        const wasSaved  = savedId   === pdv.id

        return (
          <div
            key={pdv.id}
            className={`border rounded-xl overflow-hidden transition-all ${
              expanded ? 'border-[#1a4a8a]/30' : 'border-gray-100'
            }`}
          >
            {/* Linha do PDV */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer
                hover:bg-gray-50 transition-colors select-none"
              onClick={() => setExpandedId(expanded ? null : pdv.id)}
            >
              {/* Ícone + número */}
              <div className="w-8 h-8 rounded-lg bg-[#1a4a8a]/10 flex items-center
                justify-center shrink-0">
                <Store size={15} className="text-[#1a4a8a]" />
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {pdv.nome || `PDV ${idx + 1}`}
                </p>
                <p className="text-xs text-gray-400">
                  Série <span className="font-mono font-medium text-gray-600">{pdv.serie || '—'}</span>
                  {pdv.csc_id && (
                    <> · CSC ID <span className="font-mono">{pdv.csc_id}</span></>
                  )}
                </p>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 shrink-0">
                {!pdv.ativo && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full
                    bg-gray-100 text-gray-400 font-medium">
                    Inativo
                  </span>
                )}
                {wasSaved && (
                  <CheckCircle2 size={14} className="text-green-500" />
                )}
                <div className="text-gray-300">
                  {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </div>
              </div>
            </div>

            {/* Painel expandido */}
            {expanded && (
              <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4 space-y-4">

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Nome */}
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Nome do PDV</label>
                    <input
                      className={inputCls}
                      value={pdv.nome}
                      onChange={e => updateField(pdv.id, 'nome', e.target.value)}
                      placeholder="Ex: Caixa 1, PDV Balcão"
                    />
                  </div>

                  {/* Série */}
                  <div>
                    <label className={labelCls}>Série NFC-e *</label>
                    <input
                      className={inputCls}
                      value={pdv.serie}
                      onChange={e => updateField(
                        pdv.id, 'serie',
                        e.target.value.replace(/\D/g, '').slice(0, 3)
                      )}
                      placeholder="001"
                      maxLength={3}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      Deve ser única por empresa
                    </p>
                  </div>

                  {/* Último número */}
                  <div>
                    <label className={labelCls}>Último número emitido</label>
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={pdv.ultimo}
                      onChange={e => updateField(
                        pdv.id, 'ultimo', Math.max(0, Number(e.target.value))
                      )}
                      placeholder="0"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      Próxima NFC-e: n° <strong>{pdv.ultimo + 1}</strong>
                    </p>
                  </div>

                  {/* CSC ID */}
                  <div>
                    <label className={labelCls}>CSC ID</label>
                    <input
                      className={inputCls}
                      value={pdv.csc_id}
                      onChange={e => updateField(pdv.id, 'csc_id', e.target.value)}
                      placeholder="000001"
                    />
                  </div>

                  {/* CSC Token */}
                  <div>
                    <label className={labelCls}>CSC Token</label>
                    <input
                      className={inputCls}
                      value={pdv.csc_token}
                      onChange={e => updateField(pdv.id, 'csc_token', e.target.value)}
                      placeholder="Token fornecido pela SEFAZ"
                    />
                  </div>
                </div>

                {/* Ativo toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateField(pdv.id, 'ativo', !pdv.ativo)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      pdv.ativo ? 'bg-[#1a4a8a]' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white
                      shadow transition-transform ${
                        pdv.ativo ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span className="text-xs text-gray-500">PDV ativo</span>
                </div>

                {/* Aviso série duplicada */}
                {pdvs.filter(p => p.serie === pdv.serie && p.id !== pdv.id).length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-700
                    bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle size={13} className="shrink-0" />
                    Série <strong>{pdv.serie}</strong> já está em uso por outro PDV.
                  </div>
                )}

                {/* Ações */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => handleDelete(pdv.id)}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 text-xs text-red-500
                      hover:text-red-700 disabled:opacity-40 transition-colors"
                  >
                    {isDeleting
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />
                    }
                    {isDeleting ? 'Excluindo...' : 'Excluir PDV'}
                  </button>

                  <div className="flex items-center gap-2">
                    {wasSaved && (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle2 size={13} /> Salvo!
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSave(pdv)}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5
                        bg-[#1a4a8a] text-white rounded-lg hover:bg-[#1a4a8a]/90
                        disabled:opacity-50 transition-colors"
                    >
                      {isSaving
                        ? <><Loader2 size={13} className="animate-spin" /> Salvando...</>
                        : <><Save size={13} /> Salvar PDV</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Info CSC */}
      {pdvs.length > 0 && (
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200
          rounded-lg p-3 text-xs text-blue-700">
          <span className="text-base leading-none shrink-0">ℹ️</span>
          <span>
            O CSC (Código de Segurança do Contribuinte) é fornecido pela SEFAZ estadual
            durante o credenciamento. Cada PDV pode ter seu próprio CSC ou compartilhar
            o mesmo — consulte sua SEFAZ estadual.
          </span>
        </div>
      )}
    </div>
  )
}