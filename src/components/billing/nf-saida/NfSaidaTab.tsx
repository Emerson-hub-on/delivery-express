'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { FileText, Save, Send } from 'lucide-react'
import { nanoid } from 'nanoid'
import { supabase } from '@/lib/supabase'

import { TipoNotaSelect } from './TipoNotaSelect'
import { DestinatarioSection } from './DestinatarioSection'
import { ItensSection } from './ItensSection'
import { TotaisSection } from './TotaisSection'
import { DanfePreview } from './DanfePreview'

import {
  TIPOS_NOTA_PADRAO,
  TIPOS_NOTA_REQUEREM_CHAVE_REF,
} from './constants'
import type {
  NfSaidaForm,
  DestinatarioForm,
  ItemNota,
  TipoNota,
  TipoNotaCustom,
  FormaPagamento,
} from './types'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Props {
  companyId: string
  onError?: (msg: string) => void
}

type Emitente = {
  razao_social: string
  cnpj: string
  ie: string
  logradouro: string
  numero: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  fone?: string
}

// ── Estado inicial ────────────────────────────────────────────────────────────
const DEST_EMPTY: DestinatarioForm = {
  tipo: 'fisica',
  nome: '',
  cpf: '',
  cnpj: '',
  ie: '',
  email: '',
  telefone: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  municipio: '',
  codigo_municipio: '',
  uf: 'PB',
  contribuinte: '',
  ind_ie_dest: 1,
}

const TIPO_INICIAL = TIPOS_NOTA_PADRAO[0]

function emptyForm(): NfSaidaForm {
  return {
    tipo_nota: TIPO_INICIAL.value,
    natureza_operacao: TIPO_INICIAL.natureza_operacao,
    cfop_padrao: TIPO_INICIAL.cfop,
    finalidade: TIPO_INICIAL.finalidade,
    serie: '001',
    destinatario: DEST_EMPTY,
    itens: [{ id: nanoid(), produto_desc: '', ncm: '', cfop: '', cst_csosn: '', quantidade: 1, valor_unit: 0, valor_total: 0 }],
    valor_desconto: 0,
    valor_frete: 0,
    forma_pagamento: 'boleto',
    informacoes_adicionais: '',
    chave_ref: '',
  }
}

// ── Componente ────────────────────────────────────────────────────────────────
export function NfSaidaTab({ companyId, onError }: Props) {
  const [form, setForm]               = useState<NfSaidaForm>(emptyForm)
  const [customTypes, setCustomTypes] = useState<TipoNotaCustom[]>([])
  const [saving, setSaving]           = useState(false)
  const [emitting, setEmitting]       = useState(false)
  const [showDanfe, setShowDanfe]     = useState(false)
  const [savedNumero, setSavedNumero] = useState<string | undefined>()

  // Emitente buscado internamente via fiscal_config
  const [emitente, setEmitente]       = useState<Emitente | null>(null)
  const [loadingEmitente, setLoadingEmitente] = useState(true)

  // ── Busca dados do emitente ──────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return

    async function fetchEmitente() {
      setLoadingEmitente(true)
      const { data, error } = await supabase
        .from('fiscal_config')
        .select('razao_social, cnpj, ie, logradouro, numero, bairro, municipio, uf, cep, telefone')
        .eq('company_id', companyId)
        .single()

      if (error || !data) {
        onError?.('Configuração fiscal não encontrada. Cadastre os dados do emitente antes de emitir NF-e.')
        setLoadingEmitente(false)
        return
      }

      setEmitente({
        razao_social: data.razao_social,
        cnpj:         data.cnpj,
        ie:           data.ie ?? '',
        logradouro:   data.logradouro,
        numero:       data.numero,
        bairro:       data.bairro,
        municipio:    data.municipio,
        uf:           data.uf.trim(), // uf é char(2), pode vir com espaço
        cep:          data.cep,
        fone:         data.telefone ?? undefined,
      })
      setLoadingEmitente(false)
    }

    fetchEmitente()
  }, [companyId])

  // ── Tipo de nota ─────────────────────────────────────────────────────────
  function handleTipoChange(tipo: TipoNota) {
    setForm(prev => ({
      ...prev,
      tipo_nota:          tipo.value,
      natureza_operacao:  tipo.natureza_operacao,
      cfop_padrao:        tipo.cfop,
      finalidade:         tipo.finalidade,
    }))
  }

  // ── Destinatário ─────────────────────────────────────────────────────────
  const handleDestChange = useCallback(
    <K extends keyof DestinatarioForm>(k: K, v: DestinatarioForm[K]) => {
      setForm(prev => ({
        ...prev,
        destinatario: { ...prev.destinatario, [k]: v },
      }))
    },
    []
  )

  // ── Itens ────────────────────────────────────────────────────────────────
  const handleItensChange = useCallback((itens: ItemNota[]) => {
    setForm(prev => ({ ...prev, itens }))
  }, [])

  // ── Totais ───────────────────────────────────────────────────────────────
  const valorProdutos = useMemo(
    () => form.itens.reduce((s, i) => s + (i.valor_total || 0), 0),
    [form.itens]
  )
  const valorTotal = useMemo(
    () => Math.max(0, valorProdutos - form.valor_desconto + form.valor_frete),
    [valorProdutos, form.valor_desconto, form.valor_frete]
  )

  const cfopBadgeLabel = useMemo(() => {
    const nat  = form.natureza_operacao.toUpperCase()
    const cfop = form.cfop_padrao
    return cfop ? `${nat.slice(0, 32)} — CFOP ${cfop}` : nat.slice(0, 40)
  }, [form.natureza_operacao, form.cfop_padrao])

  const showChaveRef = TIPOS_NOTA_REQUEREM_CHAVE_REF.includes(form.tipo_nota)

  // ── Payload ──────────────────────────────────────────────────────────────
  function buildPayload(status: 'rascunho' | 'pendente') {
    const d = form.destinatario
    return {
      company_id:        companyId,
      numero:            '',
      serie:             form.serie,
      tipo_nota:         form.tipo_nota,
      finalidade:        form.finalidade,
      natureza_operacao: form.natureza_operacao,
      dest_tipo:         d.tipo === 'juridica' ? 'juridica' : 'fisica',
      dest_nome:         d.nome,
      dest_cpf_cnpj:     d.tipo === 'juridica' ? d.cnpj.replace(/\D/g, '') : d.cpf.replace(/\D/g, ''),
      dest_ie:           d.ie           || null,
      dest_email:        d.email        || null,
      dest_telefone:     d.telefone     || null,
      dest_logradouro:   d.logradouro   || null,
      dest_numero:       d.numero       || null,
      dest_complemento:  d.complemento  || null,
      dest_bairro:       d.bairro       || null,
      dest_municipio:    d.municipio    || null,
      dest_codigo_mun:   d.codigo_municipio || null,
      dest_uf:           d.uf           || null,
      dest_cep:          d.cep.replace(/\D/g, '') || null,
      chave_ref:         form.chave_ref || null,
      itens:             form.itens,
      valor_produtos:    valorProdutos,
      valor_desconto:    form.valor_desconto,
      valor_frete:       form.valor_frete,
      valor_total:       valorTotal,
      status,
    }
  }

  // ── Salvar rascunho → abre DANFE ─────────────────────────────────────────
  async function handleSaveRascunho() {
    if (!emitente) {
      onError?.('Configuração fiscal não encontrada. Cadastre os dados do emitente.')
      return
    }
    try {
      setSaving(true)
      const payload = buildPayload('rascunho')
      const { data, error } = await supabase
        .from('nf_saida')
        .insert(payload)
        .select('numero')
        .single()
      if (error) throw error
      setSavedNumero(data?.numero ?? undefined)
      setShowDanfe(true)
    } catch (e: any) {
      onError?.(e.message ?? 'Erro ao salvar rascunho')
    } finally {
      setSaving(false)
    }
  }

  // ── Emitir NF-e ──────────────────────────────────────────────────────────
  async function handleEmitir() {
    if (!emitente) {
      onError?.('Configuração fiscal não encontrada. Cadastre os dados do emitente.')
      return
    }
    try {
      setEmitting(true)
      const payload = buildPayload('pendente')
      const { data, error } = await supabase
        .from('nf_saida')
        .insert(payload)
        .select('id')
        .single()
      if (error) throw error

      const { error: fnErr } = await supabase.functions.invoke('emitir-nfe', {
        body: { nf_saida_id: data.id },
      })
      if (fnErr) throw fnErr
    } catch (e: any) {
      onError?.(e.message ?? 'Erro ao emitir NF-e')
    } finally {
      setEmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Modal DANFE — só monta quando emitente está disponível */}
      {showDanfe && emitente && (
        <DanfePreview
          form={form}
          numero={savedNumero}
          serie={form.serie}
          emitente={emitente}
          onClose={() => setShowDanfe(false)}
        />
      )}

      <div>
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-[18px] font-semibold text-[#f0f2f4]">Nova nota fiscal</h2>
            <p className="text-[12px] text-[#7a7f86] mt-0.5">Emissão de NF-e</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Badge de status do emitente */}
            {loadingEmitente && (
              <span className="bg-[#2a2d30] border border-[#141516] rounded-md px-3 py-1.5 text-[12px] text-[#7a7f86] animate-pulse">
                Carregando emitente…
              </span>
            )}
            {!loadingEmitente && !emitente && (
              <span className="bg-[#3a1a1a] border border-[#6b2a2a] rounded-md px-3 py-1.5 text-[12px] text-[#f08080]">
                ⚠ Config. fiscal não encontrada
              </span>
            )}
            <span className="bg-[#2a2d30] border border-[#141516] rounded-md px-3 py-1.5 text-[12px] text-[#a0a5ad]">
              Rascunho
            </span>
            <span className="bg-[#2a2d30] border border-[#3a3d42] rounded-md px-3 py-1.5 text-[12px] text-[#a0a5ad]">
              Série <span className="text-[#6c8ebf] font-semibold">{form.serie}</span>
              {' · '}N° <span className="text-[#6c8ebf] font-semibold">—</span>
            </span>
          </div>
        </div>

        {/* Tipo de nota */}
        <div className="mb-5">
          <TipoNotaSelect
            value={form.tipo_nota}
            onChange={handleTipoChange}
            customTypes={customTypes}
            onCustomTypeAdded={t => setCustomTypes(prev => [...prev, t])}
          />
        </div>

        {/* Destinatário */}
        <DestinatarioSection
          form={form.destinatario}
          onChange={handleDestChange}
          companyId={companyId}
        />

        {/* Itens */}
        <ItensSection
          itens={form.itens}
          cfopBadgeLabel={cfopBadgeLabel}
          companyId={companyId}
          onChange={handleItensChange}
        />

        {/* Totais */}
        <TotaisSection
          valorProdutos={valorProdutos}
          valorDesconto={form.valor_desconto}
          valorFrete={form.valor_frete}
          valorTotal={valorTotal}
          formaPagamento={form.forma_pagamento}
          informacoesAdicionais={form.informacoes_adicionais}
          chaveRef={form.chave_ref}
          showChaveRef={showChaveRef}
          onDescontoChange={v => setForm(p => ({ ...p, valor_desconto: v }))}
          onFreteChange={v => setForm(p => ({ ...p, valor_frete: v }))}
          onFormaPagamentoChange={v => setForm(p => ({ ...p, forma_pagamento: v as FormaPagamento }))}
          onInformacoesChange={v => setForm(p => ({ ...p, informacoes_adicionais: v }))}
          onChaveRefChange={v => setForm(p => ({ ...p, chave_ref: v }))}
        />

        {/* Ações */}
        <div className="flex items-center justify-between pt-4 border-t border-[#2e3238] mt-1">
          <button
            type="button"
            onClick={() => {
              if (!emitente) {
                onError?.('Configuração fiscal não encontrada.')
                return
              }
              setShowDanfe(true)
            }}
            disabled={loadingEmitente || !emitente}
            className="flex items-center gap-2 border border-[#3a3d42] rounded-lg
              px-4 py-2 text-[13px] text-[#7a7f86] hover:border-[#5a5f66]
              hover:text-[#a0a5ad] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText size={15} />
            Preview DANFE
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveRascunho}
              disabled={saving || loadingEmitente || !emitente}
              className="flex items-center gap-2 bg-[#22262b] border border-[#3a3d42]
                rounded-lg px-4 py-2 text-[13px] text-[#a0a5ad]
                hover:bg-[#2e3238] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={15} />
              {saving ? 'Salvando…' : 'Salvar rascunho'}
            </button>

            <button
              type="button"
              onClick={handleEmitir}
              disabled={emitting || loadingEmitente || !emitente}
              className="flex items-center gap-2 bg-[#1e4a7a] border border-[#2a6aad]
                rounded-lg px-4 py-2 text-[13px] font-semibold text-[#90c8f0]
                hover:bg-[#245c96] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={15} />
              {emitting ? 'Emitindo…' : 'Emitir NF-e'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}