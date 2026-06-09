'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { DanfePreview } from './DanfePreview'
import { downloadXmlNfe } from '@/app/api/fiscal/nf-saida'
import type { NfSaidaForm } from './types'
import {
  FileText, Search, RefreshCw, ChevronDown, ChevronUp,
  Eye, Trash2, Send, X, CheckCircle2, Clock, AlertCircle,
  Ban, Filter, Download, FileCode, XCircle, Hash,
} from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────
type StatusNf = 'rascunho' | 'pendente' | 'autorizada' | 'cancelada' | 'rejeitada'

interface NfSaidaRow {
  id: string
  numero: string
  serie: string
  tipo_nota: string
  natureza_operacao: string
  dest_nome: string
  dest_cpf_cnpj: string
  dest_uf: string
  valor_total: number
  status: StatusNf
  created_at: string
  itens: any[]
  valor_desconto: number
  valor_frete: number
  valor_produtos: number
  dest_tipo: string
  dest_ie: string | null
  dest_ind_ie: number | null
  dest_email: string | null
  dest_telefone: string | null
  dest_logradouro: string | null
  dest_numero: string | null
  dest_complemento: string | null
  dest_bairro: string | null
  dest_municipio: string | null
  dest_codigo_mun: string | null
  dest_cep: string | null
  informacoes_adicionais: string | null
  chave_ref: string | null
  chave_acesso: string | null
  xml_url: string | null
  xml_protocolo: string | null
  sefaz_motivo: string | null
  finalidade: 1 | 2 | 3 | 4
  forma_pagamento: string | null
  autorizada_em?: string | null  // timestamp da autorização para checar 24h
}

interface Emitente {
  razao_social: string
  cnpj: string
  ie: string
  crt: number
  codigo_ibge: string
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  municipio: string
  uf: string
  cep: string
  telefone: string | null
  ambiente: number
}

interface Props {
  companyId: string
  onError?: (msg: string) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}
function fmtDoc(v: string) {
  const n = v?.replace(/\D/g, '') ?? ''
  if (n.length === 14) return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (n.length === 11) return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return v || '—'
}
function esc(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Retorna true se a nota autorizada ainda está dentro do prazo de 24h */
function dentroDoPrazoCancelamento(nota: NfSaidaRow): boolean {
  const ref = nota.autorizada_em ?? nota.created_at
  return Date.now() - new Date(ref).getTime() < 24 * 60 * 60 * 1000
}

// ── XML Rascunho ─────────────────────────────────────────────────────────────
function gerarXmlRascunho(nota: NfSaidaRow, emitente: Emitente): string {
  const dhEmi = new Date(nota.created_at).toISOString().replace('Z', '-03:00')
  const fmt2  = (n: number) => n.toFixed(2)
  const fmt4  = (n: number) => n.toFixed(4)

  const xmlItens = (nota.itens ?? []).map((item: any, idx: number) => {
    const nItem = String(idx + 1)
    return `
  <det nItem="${nItem}">
    <prod>
      <cProd>${nItem.padStart(6, '0')}</cProd>
      <cEAN>SEM GTIN</cEAN>
      <xProd>${esc(item.produto_desc ?? '')}</xProd>
      <NCM>${(item.ncm ?? '00000000').replace(/\D/g, '').padStart(8, '0')}</NCM>
      <CFOP>${item.cfop ?? ''}</CFOP>
      <uCom>UN</uCom>
      <qCom>${fmt4(item.quantidade ?? 0)}</qCom>
      <vUnCom>${fmt4(item.valor_unit ?? 0)}</vUnCom>
      <vProd>${fmt2(item.valor_total ?? 0)}</vProd>
      <cEANTrib>SEM GTIN</cEANTrib>
      <uTrib>UN</uTrib>
      <qTrib>${fmt4(item.quantidade ?? 0)}</qTrib>
      <vUnTrib>${fmt4(item.valor_unit ?? 0)}</vUnTrib>
      <indTot>1</indTot>
    </prod>
    <imposto>
      <ICMS><ICMSSN400><orig>0</orig><CSOSN>400</CSOSN></ICMSSN400></ICMS>
      <PIS><PISNT><CST>07</CST></PISNT></PIS>
      <COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>
    </imposto>
  </det>`
  }).join('')

  const isCnpj  = nota.dest_tipo === 'juridica'
  const docDest = isCnpj
    ? `<CNPJ>${(nota.dest_cpf_cnpj ?? '').replace(/\D/g, '')}</CNPJ>`
    : `<CPF>${(nota.dest_cpf_cnpj ?? '').replace(/\D/g, '')}</CPF>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- RASCUNHO — SEM ASSINATURA DIGITAL — APENAS PARA CONFERÊNCIA -->
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe_RASCUNHO_${nota.id}">
    <ide>
      <cUF>25</cUF>
      <mod>55</mod>
      <serie>${(nota.serie ?? '001').padStart(3, '0')}</serie>
      <nNF>${nota.numero ? parseInt(nota.numero) : 0}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      <tpNF>1</tpNF>
      <tpAmb>${emitente.ambiente === 1 ? '1' : '2'}</tpAmb>
      <finNFe>${nota.finalidade ?? 1}</finNFe>
      <natOp>${esc(nota.natureza_operacao ?? '')}</natOp>
    </ide>
    <emit>
      <CNPJ>${(emitente.cnpj ?? '').replace(/\D/g, '')}</CNPJ>
      <xNome>${esc(emitente.razao_social)}</xNome>
      <enderEmit>
        <xLgr>${esc(emitente.logradouro)}</xLgr>
        <nro>${esc(emitente.numero)}</nro>
        ${emitente.complemento ? `<xCpl>${esc(emitente.complemento)}</xCpl>` : ''}
        <xBairro>${esc(emitente.bairro)}</xBairro>
        <cMun>${emitente.codigo_ibge}</cMun>
        <xMun>${esc(emitente.municipio)}</xMun>
        <UF>${emitente.uf.trim()}</UF>
        <CEP>${(emitente.cep ?? '').replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
        ${emitente.telefone ? `<fone>${emitente.telefone.replace(/\D/g, '')}</fone>` : ''}
      </enderEmit>
      <IE>${(emitente.ie ?? '').replace(/\D/g, '')}</IE>
      <CRT>${emitente.crt}</CRT>
    </emit>
    <dest>
      ${docDest}
      <xNome>${esc(nota.dest_nome ?? '')}</xNome>
      <enderDest>
        <xLgr>${esc(nota.dest_logradouro ?? '')}</xLgr>
        <nro>${esc(nota.dest_numero ?? 'SN')}</nro>
        ${nota.dest_complemento ? `<xCpl>${esc(nota.dest_complemento)}</xCpl>` : ''}
        <xBairro>${esc(nota.dest_bairro ?? '')}</xBairro>
        <cMun>${nota.dest_codigo_mun || ''}</cMun>
        <xMun>${esc(nota.dest_municipio ?? '')}</xMun>
        <UF>${(nota.dest_uf ?? '').trim()}</UF>
        <CEP>${(nota.dest_cep ?? '').replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderDest>
      <indIEDest>${nota.dest_ind_ie ?? 9}</indIEDest>
      ${nota.dest_ie ? `<IE>${nota.dest_ie}</IE>` : ''}
      ${nota.dest_email ? `<email>${esc(nota.dest_email)}</email>` : ''}
    </dest>
    ${xmlItens}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST>
        <vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${fmt2(nota.valor_produtos ?? nota.valor_total)}</vProd>
        <vFrete>${fmt2(nota.valor_frete ?? 0)}</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>${fmt2(nota.valor_desconto ?? 0)}</vDesc>
        <vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro>
        <vNF>${fmt2(nota.valor_total)}</vNF>
      </ICMSTot>
    </total>
    <transp><modFrete>9</modFrete></transp>
    <pag>
      <detPag>
        <tPag>99</tPag>
        <vPag>${fmt2(nota.valor_total)}</vPag>
      </detPag>
    </pag>
    ${nota.informacoes_adicionais
      ? `<infAdic><infCpl>${esc(nota.informacoes_adicionais)}</infCpl></infAdic>`
      : ''}
  </infNFe>
</NFe>`
}

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<StatusNf, {
  label: string
  textCls: string
  bgCls: string
  borderCls: string
  icon: React.ReactNode
}> = {
  rascunho:   { label: 'Rascunho',   textCls: 'text-[#a0a5ad]', bgCls: 'bg-[#22262b]', borderCls: 'border-[#3a3d42]', icon: <Clock size={11} /> },
  pendente:   { label: 'Pendente',   textCls: 'text-[#f0c060]', bgCls: 'bg-[#2a2410]', borderCls: 'border-[#5a4a10]', icon: <AlertCircle size={11} /> },
  autorizada: { label: 'Autorizada', textCls: 'text-[#60c080]', bgCls: 'bg-[#102a18]', borderCls: 'border-[#205a30]', icon: <CheckCircle2 size={11} /> },
  cancelada:  { label: 'Cancelada',  textCls: 'text-[#f08080]', bgCls: 'bg-[#2a1010]', borderCls: 'border-[#5a2020]', icon: <Ban size={11} /> },
  rejeitada:  { label: 'Rejeitada',  textCls: 'text-[#f08080]', bgCls: 'bg-[#2a1010]', borderCls: 'border-[#5a2020]', icon: <X size={11} /> },
}

function StatusBadge({ status }: { status: StatusNf }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.rascunho
  return (
    <span className={`inline-flex items-center gap-1 ${c.bgCls} ${c.textCls} border ${c.borderCls} rounded-md px-2 py-0.5 text-[11px] font-medium`}>
      {c.icon} {c.label}
    </span>
  )
}

// ── Modal base ───────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="bg-[#1a1d20] border border-[#2e3238] rounded-2xl p-6 w-[480px] max-w-[90vw] flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="text-[15px] font-semibold text-[#e0e2e5]">{title}</span>
          <button onClick={onClose} className="text-[#5a5f66] hover:text-[#9095a0] transition-colors">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Modal Cancelamento ───────────────────────────────────────────────────────
function ModalCancelamento({ nota, onClose, onConfirm, loading }: {
  nota: NfSaidaRow
  onClose: () => void
  onConfirm: (motivo: string) => void
  loading: boolean
}) {
  const [motivo, setMotivo] = useState('')
  const MIN = 15
  const MAX = 255
  const valido = motivo.trim().length >= MIN

  return (
    <Modal title="Cancelar NF-e" onClose={onClose}>
      {/* Identificação */}
      <div className="bg-[#141618] border border-[#252830] rounded-lg px-4 py-3 flex gap-6">
        <div>
          <p className="text-[10px] text-[#4a4f56] mb-0.5">NF-e</p>
          <p className="text-[13px] font-semibold text-[#c0c5cc] font-mono">{nota.numero} · Série {nota.serie}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#4a4f56] mb-0.5">Destinatário</p>
          <p className="text-[13px] text-[#9095a0]">{nota.dest_nome}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#4a4f56] mb-0.5">Valor</p>
          <p className="text-[13px] font-semibold text-[#c0c5cc]">R$ {fmt(nota.valor_total)}</p>
        </div>
      </div>

      {/* Aviso 24h */}
      <div className="bg-[#2a1a08] border border-[#5a3a10] rounded-lg px-4 py-3 text-[12px] text-[#d09050]">
        ⚠ O cancelamento só é permitido dentro do prazo de <strong>24 horas</strong> após a autorização.
        Esta ação é irreversível e será registrada na SEFAZ.
      </div>

      {/* Motivo */}
      <div>
        <label className="block text-[12px] text-[#7a7f86] mb-1.5">
          Motivo do cancelamento
          <span className="text-[#5a5f66] ml-1">({motivo.trim().length}/{MIN} mínimo)</span>
        </label>
        <textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value.slice(0, MAX))}
          rows={3}
          placeholder="Descreva o motivo do cancelamento…"
          className={`w-full bg-[#141618] border ${valido ? 'border-[#2a4a2a]' : 'border-[#2e3238]'} rounded-lg p-3 text-[13px] text-[#d0d5dc] resize-y outline-none font-sans transition-colors placeholder:text-[#3a4050] focus:border-[#3a4a6a]`}
        />
        <p className="text-[11px] text-[#4a4f56] mt-1 text-right">{motivo.trim().length}/{MAX} caracteres</p>
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={loading}
          className="bg-[#22262b] border border-[#3a3d42] rounded-lg px-4 py-2 text-[13px] text-[#9095a0] cursor-pointer disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          onClick={() => onConfirm(motivo.trim())}
          disabled={!valido || loading}
          className="flex items-center gap-1.5 bg-[#4a1010] border border-[#7a2020] rounded-lg px-4 py-2 text-[13px] font-semibold text-[#f08080] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {loading
            ? <><RefreshCw size={13} className="animate-spin" /> Cancelando…</>
            : <><XCircle size={13} /> Confirmar cancelamento</>
          }
        </button>
      </div>
    </Modal>
  )
}

// ── Modal Inutilização ───────────────────────────────────────────────────────
function ModalInutilizacao({ nota, onClose, onConfirm, loading }: {
  nota: NfSaidaRow
  onClose: () => void
  onConfirm: (motivo: string) => void
  loading: boolean
}) {
  const [motivo, setMotivo] = useState('')
  const MIN = 15
  const valido = motivo.trim().length >= MIN

  return (
    <Modal title="Inutilizar NF-e" onClose={onClose}>
      {/* Aviso */}
      <div className="bg-[#1a1a2a] border border-[#3a3a6a] rounded-lg px-4 py-3 text-[12px] text-[#9090d0]">
        Use quando esta nota <strong>não foi transmitida</strong> à SEFAZ e o número precisa ser
        declarado como inutilizado para manter a sequência fiscal.
      </div>

      {/* Dados bloqueados */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-[#5a5f66] mb-1">Série</label>
          <input
            value={nota.serie}
            readOnly
            className="w-full bg-[#141618] border border-[#252830] rounded-lg px-3 py-2 text-[13px] text-[#6a6f78] outline-none cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-[11px] text-[#5a5f66] mb-1">Número</label>
          <input
            value={nota.numero || '—'}
            readOnly
            className="w-full bg-[#141618] border border-[#252830] rounded-lg px-3 py-2 text-[13px] text-[#6a6f78] outline-none cursor-not-allowed"
          />
        </div>
      </div>

      {/* Nota de confirmação */}
      <p className="text-[12px] text-[#6a9a6a]">
        O número <span className="font-semibold font-mono">{nota.numero}</span> da série{' '}
        <span className="font-semibold">{nota.serie}</span> será inutilizado na SEFAZ.
      </p>

      {/* Motivo */}
      <div>
        <label className="block text-[12px] text-[#7a7f86] mb-1.5">
          Motivo da inutilização
          <span className="text-[#5a5f66] ml-1">({motivo.trim().length}/{MIN} mínimo)</span>
        </label>
        <textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value.slice(0, 255))}
          rows={3}
          placeholder="Descreva o motivo da inutilização…"
          className={`w-full bg-[#141618] border ${valido ? 'border-[#2a4a2a]' : 'border-[#2e3238]'} rounded-lg p-3 text-[13px] text-[#d0d5dc] resize-y outline-none font-sans transition-colors placeholder:text-[#3a4050] focus:border-[#3a4a6a]`}
        />
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={loading}
          className="bg-[#22262b] border border-[#3a3d42] rounded-lg px-4 py-2 text-[13px] text-[#9095a0] cursor-pointer disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          onClick={() => onConfirm(motivo.trim())}
          disabled={!valido || loading}
          className="flex items-center gap-1.5 bg-[#1a1a3a] border border-[#3a3a7a] rounded-lg px-4 py-2 text-[13px] font-semibold text-[#9090f0] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {loading
            ? <><RefreshCw size={13} className="animate-spin" /> Inutilizando…</>
            : <><Hash size={13} /> Confirmar inutilização</>
          }
        </button>
      </div>
    </Modal>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function NfSaidaGerenciador({ companyId, onError }: Props) {
  const [notas, setNotas]                 = useState<NfSaidaRow[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState<StatusNf | 'todas'>('todas')
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [emitente, setEmitente]           = useState<Emitente | null>(null)
  const [danfeNota, setDanfeNota]         = useState<NfSaidaRow | null>(null)
  const [sortDir, setSortDir]             = useState<'desc' | 'asc'>('desc')
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // ── Cancelamento ─────────────────────────────────────────────────────────
  const [cancelandoNota, setCancelandoNota] = useState<NfSaidaRow | null>(null)
  const [cancelLoading, setCancelLoading]   = useState(false)

  // ── Inutilização ─────────────────────────────────────────────────────────
  const [inutilizandoNota, setInutilizandoNota]     = useState<NfSaidaRow | null>(null)
  const [inutilizacaoLoading, setInutilizacaoLoading] = useState(false)

  // ── Emitente ─────────────────────────────────────────────────────────────
  const fetchEmitente = useCallback(async () => {
    if (!companyId) return
    const { data, error } = await supabase
      .from('fiscal_configs')
      .select('razao_social, cnpj, ie, crt, codigo_ibge, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone, ambiente')
      .eq('company_id', companyId)
      .maybeSingle()

    if (error) { onError?.(`Erro ao carregar config fiscal: ${error.message}`); return }
    if (!data)  { onError?.('Nenhuma configuração fiscal encontrada.'); return }

    setEmitente({
      razao_social: data.razao_social,
      cnpj:         data.cnpj,
      ie:           data.ie ?? '',
      crt:          data.crt ?? 1,
      codigo_ibge:  data.codigo_ibge ?? '',
      logradouro:   data.logradouro,
      numero:       data.numero,
      complemento:  data.complemento ?? null,
      bairro:       data.bairro,
      municipio:    data.municipio,
      uf:           data.uf?.trim(),
      cep:          data.cep,
      telefone:     data.telefone ?? null,
      ambiente:     data.ambiente ?? 2,
    })
  }, [companyId])

  useEffect(() => { fetchEmitente() }, [fetchEmitente])

  // ── Notas ─────────────────────────────────────────────────────────────────
  const fetchNotas = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('nf_saida')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: sortDir === 'asc' })

    if (error) onError?.(error.message)
    else setNotas((data ?? []) as NfSaidaRow[])
    setLoading(false)
  }, [companyId, sortDir])

  useEffect(() => { fetchNotas() }, [fetchNotas])

  async function handleRefreshAll() {
    await Promise.all([fetchNotas(), fetchEmitente()])
  }

  // ── Filtros ───────────────────────────────────────────────────────────────
  const notasFiltradas = notas.filter(n => {
    const matchStatus = statusFilter === 'todas' || n.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q
      || n.dest_nome?.toLowerCase().includes(q)
      || n.numero?.includes(q)
      || n.dest_cpf_cnpj?.includes(q)
      || n.natureza_operacao?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  // ── Download XML ──────────────────────────────────────────────────────────
  async function handleDownloadXml(nota: NfSaidaRow) {
    if (!emitente) { onError?.('Configuração fiscal não carregada.'); return }
    setDownloadingId(nota.id)
    try {
      if (nota.xml_url) {
        await downloadXmlNfe(nota.xml_url, nota.numero || nota.id)
      } else {
        const xml  = gerarXmlRascunho(nota, emitente)
        const blob = new Blob([xml], { type: 'application/xml' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = nota.numero ? `nfe-rascunho-${nota.numero}.xml` : `nfe-rascunho-${nota.id.slice(0, 8)}.xml`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e: any) {
      onError?.(e.message ?? 'Erro ao baixar XML')
    } finally {
      setDownloadingId(null)
    }
  }

  // ── Deletar rascunho ──────────────────────────────────────────────────────
async function handleDelete(id: string) {
  if (!confirm('Excluir esta nota? Esta ação não pode ser desfeita.')) return
  setDeletingId(id)
  const { error } = await supabase
    .from('nf_saida')
    .delete()
    .eq('id', id)
    // ✅ Permite excluir rascunho OU pendente sem número
    .in('status', ['rascunho', 'pendente'])
    .is('numero', null)  // segurança: só deleta se número ainda for nulo
  if (error) onError?.(error.message)
  else setNotas(prev => prev.filter(n => n.id !== id))
  setDeletingId(null)
}

  // ── Emitir ────────────────────────────────────────────────────────────────
  async function handleEmitir(nota: NfSaidaRow) {
    const { data, error } = await supabase.functions.invoke('emitir-nfe', {
      body: { nf_saida_id: nota.id },
    })
    if (error) { onError?.(error.message); return }
    if (!data?.ok) { onError?.(data?.error ?? 'Erro na emissão'); return }
    fetchNotas()
  }

  // ── Cancelar ──────────────────────────────────────────────────────────────
  async function handleCancelar(motivo: string) {
    if (!cancelandoNota) return
    setCancelLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('cancelar-nfe', {
        body: { nf_saida_id: cancelandoNota.id, motivo },
      })
      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error ?? 'Erro no cancelamento')
      setNotas(prev => prev.map(n =>
        n.id === cancelandoNota.id ? { ...n, status: 'cancelada' as StatusNf } : n
      ))
      setCancelandoNota(null)
    } catch (e: any) {
      onError?.(e.message ?? 'Erro ao cancelar NF-e')
    } finally {
      setCancelLoading(false)
    }
  }

  // ── Inutilizar ────────────────────────────────────────────────────────────
  async function handleInutilizar(motivo: string) {
    if (!inutilizandoNota) return
    setInutilizacaoLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('inutilizar-nfe', {
        body: {
          company_id: companyId,
          serie:      inutilizandoNota.serie,
          n_inicio:   parseInt(inutilizandoNota.numero),
          n_fim:      parseInt(inutilizandoNota.numero),
          motivo,
        },
      })
      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error ?? 'Erro na inutilização')
      setNotas(prev => prev.filter(n => n.id !== inutilizandoNota.id))
      setInutilizandoNota(null)
    } catch (e: any) {
      onError?.(e.message ?? 'Erro ao inutilizar numeração')
    } finally {
      setInutilizacaoLoading(false)
    }
  }

  // ── buildFormFromRow ──────────────────────────────────────────────────────
  function buildFormFromRow(row: NfSaidaRow): NfSaidaForm {
    return {
      tipo_nota:           row.tipo_nota,
      natureza_operacao:   row.natureza_operacao,
      cfop_padrao:         row.itens?.[0]?.cfop ?? '',
      finalidade:          ([1,2,3,4].includes(row.finalidade) ? row.finalidade : 1) as 1|2|3|4,
      serie:               row.serie,
      destinatario: {
        tipo:             (row.dest_tipo as any) ?? 'fisica',
        nome:              row.dest_nome ?? '',
        cpf:               row.dest_tipo !== 'juridica' ? row.dest_cpf_cnpj ?? '' : '',
        cnpj:              row.dest_tipo === 'juridica' ? row.dest_cpf_cnpj ?? '' : '',
        ie:                row.dest_ie ?? '',
        email:             row.dest_email ?? '',
        telefone:          row.dest_telefone ?? '',
        cep:               row.dest_cep ?? '',
        logradouro:        row.dest_logradouro ?? '',
        numero:            row.dest_numero ?? '',
        complemento:       row.dest_complemento ?? '',
        bairro:            row.dest_bairro ?? '',
        municipio:         row.dest_municipio ?? '',
        codigo_municipio:  row.dest_codigo_mun ?? '',
        uf:                row.dest_uf ?? 'PB',
        contribuinte:      '',
        ind_ie_dest:       (row.dest_ind_ie as any) ?? 9,
      },
      itens:                  row.itens ?? [],
      valor_desconto:         row.valor_desconto ?? 0,
      valor_frete:            row.valor_frete ?? 0,
      forma_pagamento:        (row.forma_pagamento as any) ?? 'boleto',
      informacoes_adicionais: row.informacoes_adicionais ?? '',
      chave_ref:              row.chave_ref ?? '',
    }
  }

  const totalAutorizadas = notas
    .filter(n => n.status === 'autorizada')
    .reduce((s, n) => s + n.valor_total, 0)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {danfeNota && emitente && (
        <DanfePreview
          form={buildFormFromRow(danfeNota)}
          numero={danfeNota.numero}
          serie={danfeNota.serie}
          emitente={emitente}
          onClose={() => setDanfeNota(null)}
        />
      )}

      {cancelandoNota && (
        <ModalCancelamento
          nota={cancelandoNota}
          onClose={() => !cancelLoading && setCancelandoNota(null)}
          onConfirm={handleCancelar}
          loading={cancelLoading}
        />
      )}

      {inutilizandoNota && (
        <ModalInutilizacao
          nota={inutilizandoNota}
          onClose={() => !inutilizacaoLoading && setInutilizandoNota(null)}
          onConfirm={handleInutilizar}
          loading={inutilizacaoLoading}
        />
      )}

      <div className="flex flex-col gap-4">

        {/* ── Cabeçalho ── */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-[18px] font-semibold text-[#f0f2f4] m-0">Notas Fiscais de Saída</h2>
            <p className="text-[12px] text-[#7a7f86] mt-0.5">
              {notasFiltradas.length} nota{notasFiltradas.length !== 1 ? 's' : ''} encontrada{notasFiltradas.length !== 1 ? 's' : ''}
              {statusFilter !== 'todas' ? ` · filtro: ${STATUS_CONFIG[statusFilter]?.label}` : ''}
            </p>
          </div>
          <button
            onClick={handleRefreshAll}
            disabled={loading}
            className="flex items-center gap-1.5 bg-[#22262b] border border-[#3a3d42] rounded-lg px-3.5 py-1.5 text-[12px] text-[#a0a5ad] cursor-pointer disabled:opacity-50 transition-opacity"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* ── Busca + filtros ── */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5a5f66] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por destinatário, número ou CNPJ/CPF…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#1a1d20] border border-[#2e3238] rounded-lg py-1.5 pl-8 pr-8 text-[12px] text-[#e0e2e5] outline-none placeholder:text-[#3a4050] focus:border-[#3a4a6a]"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5a5f66] hover:text-[#9095a0]">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex gap-1 flex-wrap">
            {(['todas', 'rascunho', 'pendente', 'autorizada', 'cancelada', 'rejeitada'] as const).map(s => {
              const active = statusFilter === s
              const cfg    = s !== 'todas' ? STATUS_CONFIG[s] : null
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] cursor-pointer transition-all border
                    ${active
                      ? s === 'todas'
                        ? 'bg-[#2a3040] border-[#4a5a80] text-[#6c9fd4] font-semibold'
                        : `${cfg!.bgCls} ${cfg!.borderCls} ${cfg!.textCls} font-semibold`
                      : 'bg-[#1a1d20] border-[#2a2d30] text-[#5a5f66]'
                    }`}
                >
                  {s === 'todas' ? <Filter size={10} /> : cfg!.icon}
                  {s === 'todas' ? 'Todas' : cfg!.label}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 bg-[#1a1d20] border border-[#2a2d30] rounded-md px-2.5 py-1 text-[11px] text-[#6a6f78] cursor-pointer"
          >
            {sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            {sortDir === 'desc' ? 'Mais recentes' : 'Mais antigas'}
          </button>
        </div>

        {/* ── Lista ── */}
        <div className="flex flex-col gap-1">
          {loading && (
            <div className="text-center py-10 text-[#5a5f66] text-[13px]">
              <RefreshCw size={18} className="animate-spin mx-auto mb-2" />
              Carregando notas…
            </div>
          )}

          {!loading && notasFiltradas.length === 0 && (
            <div className="text-center py-12 border border-dashed border-[#2e3238] rounded-xl text-[#5a5f66] text-[13px]">
              <FileText size={28} className="mx-auto mb-2.5 opacity-40" />
              {search || statusFilter !== 'todas'
                ? 'Nenhuma nota encontrada com os filtros aplicados.'
                : 'Nenhuma nota fiscal emitida ainda.'}
            </div>
          )}

          {!loading && notasFiltradas.map(nota => {
            const expanded = expandedId === nota.id

            // ── Lógica de ações por status ──────────────────────────────
            const podeInutilizar = ['rascunho', 'pendente', 'rejeitada'].includes(nota.status) && !!nota.numero
            const podeCancelar   = nota.status === 'autorizada' && dentroDoPrazoCancelamento(nota)
            const foraDosPrazo   = nota.status === 'autorizada' && !dentroDoPrazoCancelamento(nota)

            return (
              <div
                key={nota.id}
                className={`bg-[#1a1d20] border ${expanded ? 'border-[#3a4050]' : 'border-[#252830]'} rounded-xl overflow-hidden transition-colors`}
              >
                {/* Linha principal */}
                <div
                  onClick={() => setExpandedId(expanded ? null : nota.id)}
                  className="grid gap-3 px-3.5 py-3 cursor-pointer select-none"
                  style={{ gridTemplateColumns: '110px 1fr 1fr 120px 110px 110px auto' }}
                >
                  <div>
                    <p className="text-[11px] text-[#5a5f66] mb-0.5">NF-e</p>
                    <p className="text-[13px] font-semibold text-[#c0c5cc] font-mono tracking-wide">{nota.numero || '—'}</p>
                    <p className="text-[10px] text-[#4a4f56]">Série {nota.serie}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#d0d5dc] truncate">{nota.dest_nome || '—'}</p>
                    <p className="text-[11px] text-[#5a5f66] mt-0.5">{fmtDoc(nota.dest_cpf_cnpj)} · {nota.dest_uf}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#5a5f66] mb-0.5">Natureza</p>
                    <p className="text-[12px] text-[#9095a0] truncate">{nota.natureza_operacao}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#5a5f66] mb-0.5">Emissão</p>
                    <p className="text-[12px] text-[#9095a0]">{fmtDate(nota.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[#5a5f66] mb-0.5">Valor total</p>
                    <p className="text-[13px] font-semibold text-[#c0c5cc]">R$ {fmt(nota.valor_total)}</p>
                  </div>
                  <div><StatusBadge status={nota.status} /></div>
                  <div className="text-[#3a3d42]">
                    {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </div>

                {/* ── Painel expandido ── */}
                {expanded && (
                  <div className="border-t border-[#252830] p-3.5 bg-[#161820]">
                    <div className="grid grid-cols-3 gap-3 mb-3.5">
                      {/* Destinatário */}
                      <div className="bg-[#1a1d20] border border-[#252830] rounded-lg p-3">
                        <SectionTitle>Destinatário</SectionTitle>
                        <InfoLine label="Nome"     value={nota.dest_nome} />
                        <InfoLine label="CNPJ/CPF" value={fmtDoc(nota.dest_cpf_cnpj)} />
                        <InfoLine label="IE"       value={nota.dest_ie || 'ISENTO'} />
                        <InfoLine label="E-mail"   value={nota.dest_email} />
                        <InfoLine label="Telefone" value={nota.dest_telefone} />
                      </div>
                      {/* Endereço */}
                      <div className="bg-[#1a1d20] border border-[#252830] rounded-lg p-3">
                        <SectionTitle>Endereço</SectionTitle>
                        <InfoLine label="Logradouro" value={`${nota.dest_logradouro ?? ''}${nota.dest_numero ? `, ${nota.dest_numero}` : ''}`} />
                        <InfoLine label="Bairro"     value={nota.dest_bairro} />
                        <InfoLine label="Município"  value={`${nota.dest_municipio ?? ''} — ${nota.dest_uf ?? ''}`} />
                        <InfoLine label="CEP"        value={nota.dest_cep} />
                      </div>
                      {/* Valores */}
                      <div className="bg-[#1a1d20] border border-[#252830] rounded-lg p-3">
                        <SectionTitle>Valores</SectionTitle>
                        <InfoLine label="Produtos" value={`R$ ${fmt(nota.valor_produtos ?? nota.valor_total)}`} />
                        <InfoLine label="Frete"    value={`R$ ${fmt(nota.valor_frete)}`} />
                        <InfoLine label="Desconto" value={`R$ ${fmt(nota.valor_desconto)}`} />
                        <div className="border-t border-[#252830] mt-1.5 pt-1.5 flex justify-between">
                          <span className="text-[11px] text-[#5a5f66]">Total</span>
                          <span className="text-[13px] font-bold text-[#60c080]">R$ {fmt(nota.valor_total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Autorização SEFAZ */}
                    {nota.status === 'autorizada' && (nota.chave_acesso || nota.xml_protocolo) && (
                      <div className="bg-[#102a18] border border-[#1a4a28] rounded-lg px-3.5 py-2.5 mb-3.5">
                        <SectionTitle color="text-[#3a7a48]">Autorização SEFAZ</SectionTitle>
                        <InfoLine label="Protocolo"       value={nota.xml_protocolo} />
                        <InfoLine label="Chave de acesso" value={nota.chave_acesso} mono />
                      </div>
                    )}

                    {/* Fora do prazo — aviso nota anulatória */}
                    {foraDosPrazo && (
                      <div className="bg-[#2a1a08] border border-[#5a3a10] rounded-lg px-3.5 py-2.5 mb-3.5 text-[12px] text-[#d09050]">
                        ⚠ Esta nota foi autorizada há mais de 24 horas e <strong>não pode ser cancelada</strong>.
                        Para anular os efeitos fiscais, emita uma <strong>Nota Anulatória</strong> referenciando
                        a chave de acesso desta NF-e.
                      </div>
                    )}

                    {/* Motivo rejeição */}
                    {nota.status === 'rejeitada' && nota.sefaz_motivo && (
                      <div className="bg-[#2a1010] border border-[#4a2020] rounded-lg px-3.5 py-2.5 mb-3.5">
                        <SectionTitle color="text-[#8a4040]">Motivo da Rejeição</SectionTitle>
                        <p className="text-[12px] text-[#c08080] m-0">{nota.sefaz_motivo}</p>
                      </div>
                    )}

                    {/* Itens */}
                    {nota.itens?.length > 0 && (
                      <div className="mb-3.5">
                        <p className="text-[10px] text-[#4a4f56] uppercase tracking-wide font-semibold mb-1.5">
                          Itens ({nota.itens.length})
                        </p>
                        <div className="border border-[#252830] rounded-lg overflow-hidden">
                          <table className="w-full border-collapse text-[11px]">
                            <thead>
                              <tr className="bg-[#1e2125]">
                                {['Descrição', 'NCM', 'CFOP', 'Un.', 'Qtd.', 'Vl. Unit.', 'Vl. Total'].map(h => (
                                  <th key={h} className={`px-2.5 py-1.5 text-[#4a4f56] font-semibold text-[10px] uppercase tracking-wide ${h === 'Descrição' ? 'text-left' : 'text-right'}`}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {nota.itens.map((item: any, i: number) => (
                                <tr key={i} className="border-t border-[#1e2125]">
                                  <td className="px-2.5 py-1.5 text-[#9095a0]">{item.produto_desc || '—'}</td>
                                  <td className="px-2.5 py-1.5 text-right text-[#6a6f78]">{item.ncm || '—'}</td>
                                  <td className="px-2.5 py-1.5 text-right text-[#6a6f78]">{item.cfop || '—'}</td>
                                  <td className="px-2.5 py-1.5 text-right text-[#6a6f78]">UN</td>
                                  <td className="px-2.5 py-1.5 text-right text-[#9095a0]">{item.quantidade}</td>
                                  <td className="px-2.5 py-1.5 text-right text-[#9095a0]">R$ {fmt(item.valor_unit)}</td>
                                  <td className="px-2.5 py-1.5 text-right text-[#c0c5cc] font-semibold">R$ {fmt(item.valor_total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ── Ações ── */}
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-[#3a3f46]">ID: {nota.id}</p>
                      <div className="flex gap-1.5">

                        <ActionBtn icon={<Eye size={13} />} label="Ver DANFE"
                          onClick={() => setDanfeNota(nota)} variant="default" />

                        <ActionBtn
                          icon={downloadingId === nota.id
                            ? <RefreshCw size={13} className="animate-spin" />
                            : nota.xml_url ? <Download size={13} /> : <FileCode size={13} />
                          }
                          label={downloadingId === nota.id ? 'Baixando…' : nota.xml_url ? 'XML assinado' : 'XML rascunho'}
                          title={nota.xml_url ? 'Baixar XML assinado' : 'Baixar XML de rascunho (sem assinatura)'}
                          onClick={() => handleDownloadXml(nota)}
                          variant="default"
                          disabled={downloadingId === nota.id}
                        />

                        {(nota.status === 'rascunho' || nota.status === 'pendente') && (
                          <ActionBtn icon={<Send size={13} />} label="Emitir"
                            onClick={() => handleEmitir(nota)} variant="primary" />
                        )}

                        {/* Cancelar — só autorizada dentro de 24h */}
                        {podeCancelar && (
                          <ActionBtn icon={<XCircle size={13} />} label="Cancelar"
                            onClick={() => setCancelandoNota(nota)} variant="danger" />
                        )}

                        {/* Inutilizar — rascunho, pendente ou rejeitada com número */}
                        {podeInutilizar && (
                          <ActionBtn icon={<Hash size={13} />} label="Inutilizar"
                            onClick={() => setInutilizandoNota(nota)} variant="warning" />
                        )}

                        {/* Excluir — só rascunho (sem número ainda, não precisa inutilizar) */}
                        {['rascunho', 'pendente'].includes(nota.status) && !nota.numero && (
                          <ActionBtn
                            icon={<Trash2 size={13} />}
                            label={deletingId === nota.id ? 'Excluindo…' : 'Excluir'}
                            onClick={() => handleDelete(nota.id)}
                            variant="danger"
                            disabled={deletingId === nota.id}
                          />
                        )}

                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Rodapé ── */}
        {!loading && notas.length > 0 && (
          <div className="flex justify-end gap-6 border-t border-[#2e3238] pt-3 mt-1">
            <Stat label="Total de notas"        value={String(notas.length)} />
            <Stat label="Autorizadas"            value={String(notas.filter(n => n.status === 'autorizada').length)} color="text-[#60c080]" />
            <Stat label="Canceladas"             value={String(notas.filter(n => n.status === 'cancelada').length)}  color="text-[#f08080]" />
            <Stat label="Rascunhos"              value={String(notas.filter(n => n.status === 'rascunho').length)}   color="text-[#a0a5ad]" />
            <Stat label="Faturado (autorizadas)" value={`R$ ${fmt(totalAutorizadas)}`} color="text-[#6c9fd4]" />
          </div>
        )}
      </div>
    </>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function SectionTitle({ children, color = 'text-[#4a4f56]' }: { children: React.ReactNode; color?: string }) {
  return (
    <p className={`text-[10px] ${color} uppercase tracking-wide font-semibold mb-1.5`}>
      {children}
    </p>
  )
}

function InfoLine({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 mb-0.5">
      <span className="text-[11px] text-[#4a4f56] shrink-0">{label}</span>
      <span className={`text-[11px] text-[#8a8f98] text-right truncate ${mono ? 'font-mono tracking-wide' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}

function ActionBtn({ icon, label, title, onClick, variant = 'default', disabled = false }: {
  icon: React.ReactNode
  label: string
  title?: string
  onClick: () => void
  variant?: 'default' | 'primary' | 'danger' | 'warning'
  disabled?: boolean
}) {
  const variants = {
    default: 'bg-[#22262b] border-[#3a3d42] text-[#9095a0]',
    primary: 'bg-[#1e4a7a] border-[#2a6aad] text-[#90c8f0]',
    danger:  'bg-[#2a1010] border-[#5a2020] text-[#f08080]',
    warning: 'bg-[#1a1a2a] border-[#3a3a7a] text-[#9090f0]',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer transition-opacity disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]}`}
    >
      {icon} {label}
    </button>
  )
}

function Stat({ label, value, color = 'text-[#7a7f86]' }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-right">
      <p className="text-[10px] text-[#4a4f56] mb-0.5">{label}</p>
      <p className={`text-[14px] font-semibold ${color}`}>{value}</p>
    </div>
  )
}