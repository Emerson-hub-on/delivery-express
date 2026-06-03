'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { DanfePreview } from './DanfePreview'
import { downloadXmlNfe } from '@/app/api/fiscal/nf-saida'
import type { NfSaidaForm } from './types'
import {
  FileText, Search, RefreshCw, ChevronDown, ChevronUp,
  Eye, Trash2, Send, X, CheckCircle2, Clock, AlertCircle,
  Ban, Filter, Download, FileCode,
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

// ── Geração de XML de rascunho (preview, sem assinatura) ─────────────────────
// Usado quando a nota ainda não foi transmitida e não tem xml_url no Storage.
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
const STATUS_CONFIG: Record<StatusNf, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  rascunho:  { label: 'Rascunho',   color: '#a0a5ad', bg: '#22262b', border: '#3a3d42', icon: <Clock size={11} /> },
  pendente:  { label: 'Pendente',   color: '#f0c060', bg: '#2a2410', border: '#5a4a10', icon: <AlertCircle size={11} /> },
  autorizada:{ label: 'Autorizada', color: '#60c080', bg: '#102a18', border: '#205a30', icon: <CheckCircle2 size={11} /> },
  cancelada: { label: 'Cancelada',  color: '#f08080', bg: '#2a1010', border: '#5a2020', icon: <Ban size={11} /> },
  rejeitada: { label: 'Rejeitada',  color: '#f08080', bg: '#2a1010', border: '#5a2020', icon: <X size={11} /> },
}

function StatusBadge({ status }: { status: StatusNf }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.rascunho
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 500,
    }}>
      {c.icon} {c.label}
    </span>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function NfSaidaGerenciador({ companyId, onError }: Props) {
  const [notas, setNotas]               = useState<NfSaidaRow[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusNf | 'todas'>('todas')
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [emitente, setEmitente]         = useState<Emitente | null>(null)
  const [danfeNota, setDanfeNota]       = useState<NfSaidaRow | null>(null)
  const [sortDir, setSortDir]           = useState<'desc' | 'asc'>('desc')
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // ── FIX: tabela correta é fiscal_configs (não fiscal_config) ─────────────
useEffect(() => {
  if (!companyId) {
    console.warn('[FiscalConfig] companyId ausente')
    return
  }

  supabase
    .from('fiscal_configs')
    .select('razao_social, cnpj, ie, crt, codigo_ibge, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone, ambiente')
    .eq('company_id', companyId)
    .maybeSingle()                        // ← não estoura erro se não achar
    .then(({ data, error }) => {
      console.log('[FiscalConfig] data:', data, '| error:', error, '| companyId:', companyId)

      if (error) {
        onError?.(`Erro ao carregar config fiscal: ${error.message}`)
        return
      }
      if (!data) {
        onError?.('Nenhuma configuração fiscal encontrada para esta empresa.')
        return
      }

      setEmitente({
        razao_social:     data.razao_social,
        cnpj:             data.cnpj,
        ie:               data.ie ?? '',
        crt:              data.crt ?? 1,
        codigo_ibge:      data.codigo_ibge ?? '',
        logradouro:       data.logradouro,
        numero:           data.numero,
        complemento:      data.complemento ?? null,
        bairro:           data.bairro,
        municipio:        data.municipio,
        uf:               data.uf?.trim(),
        cep:              data.cep,
        telefone:         data.telefone ?? null,
        ambiente:         data.ambiente ?? 2,
      })
    })
}, [companyId])

  // ── Busca notas ─────────────────────────────────────────────────────────
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

  // ── Filtros ─────────────────────────────────────────────────────────────
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

  // ── Download XML ─────────────────────────────────────────────────────────
  // Se a nota tem xml_url (foi transmitida), baixa do Storage via service.
  // Caso contrário (rascunho puro), gera o XML localmente para conferência.
  async function handleDownloadXml(nota: NfSaidaRow) {
    if (!emitente) { onError?.('Configuração fiscal não carregada.'); return }
    setDownloadingId(nota.id)
    try {
      if (nota.xml_url) {
        // Nota já transmitida → baixa o XML assinado do Storage
        await downloadXmlNfe(nota.xml_url, nota.numero || nota.id)
      } else {
        // Rascunho / pendente sem transmissão → gera XML de conferência no browser
        const xml      = gerarXmlRascunho(nota, emitente)
        const blob     = new Blob([xml], { type: 'application/xml' })
        const url      = URL.createObjectURL(blob)
        const a        = document.createElement('a')
        const filename = nota.numero
          ? `nfe-rascunho-${nota.numero}.xml`
          : `nfe-rascunho-${nota.id.slice(0, 8)}.xml`
        a.href = url; a.download = filename; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e: any) {
      onError?.(e.message ?? 'Erro ao baixar XML')
    } finally {
      setDownloadingId(null)
    }
  }

  // ── Deletar rascunho ────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Excluir este rascunho? Esta ação não pode ser desfeita.')) return
    setDeletingId(id)
    const { error } = await supabase
      .from('nf_saida').delete()
      .eq('id', id).eq('status', 'rascunho') // garante só rascunho
    if (error) onError?.(error.message)
    else setNotas(prev => prev.filter(n => n.id !== id))
    setDeletingId(null)
  }

  // ── Emitir pelo gerenciador ─────────────────────────────────────────────
  async function handleEmitir(nota: NfSaidaRow) {
    const { data, error } = await supabase.functions.invoke('emitir-nfe', {
      body: { nf_saida_id: nota.id },
    })
    if (error) { onError?.(error.message); return }
    if (!data?.ok) { onError?.(data?.error ?? 'Erro na emissão'); return }
    fetchNotas()
  }

  // ── Montar form para DanfePreview ────────────────────────────────────────
  function buildFormFromRow(row: NfSaidaRow): NfSaidaForm {
    return {
      tipo_nota:          row.tipo_nota,
      natureza_operacao:  row.natureza_operacao,
      cfop_padrao:        row.itens?.[0]?.cfop ?? '',
      finalidade:         ([1, 2, 3, 4].includes(row.finalidade) ? row.finalidade : 1) as 1 | 2 | 3 | 4,
      serie:              row.serie,
      destinatario: {
        tipo:             (row.dest_tipo as any) ?? 'fisica',
        nome:             row.dest_nome ?? '',
        cpf:              row.dest_tipo !== 'juridica' ? row.dest_cpf_cnpj ?? '' : '',
        cnpj:             row.dest_tipo === 'juridica' ? row.dest_cpf_cnpj ?? '' : '',
        ie:               row.dest_ie ?? '',
        email:            row.dest_email ?? '',
        telefone:         row.dest_telefone ?? '',
        cep:              row.dest_cep ?? '',
        logradouro:       row.dest_logradouro ?? '',
        numero:           row.dest_numero ?? '',
        complemento:      row.dest_complemento ?? '',
        bairro:           row.dest_bairro ?? '',
        municipio:        row.dest_municipio ?? '',
        codigo_municipio: row.dest_codigo_mun ?? '',
        uf:               row.dest_uf ?? 'PB',
        contribuinte:     '',
        ind_ie_dest:      (row.dest_ind_ie as any) ?? 9,
      },
      itens:                 row.itens ?? [],
      valor_desconto:        row.valor_desconto ?? 0,
      valor_frete:           row.valor_frete ?? 0,
      forma_pagamento:       (row.forma_pagamento as any) ?? 'boleto',
      informacoes_adicionais: row.informacoes_adicionais ?? '',
      chave_ref:             row.chave_ref ?? '',
    }
  }

  // ── Totais do rodapé ────────────────────────────────────────────────────
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Cabeçalho ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f0f2f4', margin: 0 }}>
              Notas Fiscais de Saída
            </h2>
            <p style={{ fontSize: '12px', color: '#7a7f86', marginTop: '2px' }}>
              {notasFiltradas.length} nota{notasFiltradas.length !== 1 ? 's' : ''} encontrada{notasFiltradas.length !== 1 ? 's' : ''}
              {statusFilter !== 'todas' ? ` · filtro: ${STATUS_CONFIG[statusFilter]?.label}` : ''}
            </p>
          </div>
          <button
            onClick={fetchNotas}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#22262b', border: '1px solid #3a3d42',
              borderRadius: '8px', padding: '7px 14px',
              fontSize: '12px', color: '#a0a5ad', cursor: 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
        </div>

        {/* ── Busca + filtros ── */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#5a5f66', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Buscar por destinatário, número ou CNPJ/CPF…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', background: '#1a1d20', border: '1px solid #2e3238',
                borderRadius: '8px', padding: '7px 10px 7px 30px',
                fontSize: '12px', color: '#e0e2e5', outline: 'none',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#5a5f66' }}>
                <X size={12} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {(['todas', 'rascunho', 'pendente', 'autorizada', 'cancelada', 'rejeitada'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '5px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                  fontWeight: statusFilter === s ? 600 : 400,
                  background: statusFilter === s
                    ? (s === 'todas' ? '#2a3040' : STATUS_CONFIG[s]?.bg ?? '#22262b')
                    : '#1a1d20',
                  border: statusFilter === s
                    ? `1px solid ${s === 'todas' ? '#4a5a80' : STATUS_CONFIG[s]?.border ?? '#3a3d42'}`
                    : '1px solid #2a2d30',
                  color: statusFilter === s
                    ? (s === 'todas' ? '#6c9fd4' : STATUS_CONFIG[s]?.color ?? '#a0a5ad')
                    : '#5a5f66',
                  transition: 'all 0.15s',
                }}
              >
                {s === 'todas' ? <Filter size={10} /> : STATUS_CONFIG[s]?.icon}
                {s === 'todas' ? 'Todas' : STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: '#1a1d20', border: '1px solid #2a2d30',
              borderRadius: '6px', padding: '5px 10px',
              fontSize: '11px', color: '#6a6f78', cursor: 'pointer',
            }}
          >
            {sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            {sortDir === 'desc' ? 'Mais recentes' : 'Mais antigas'}
          </button>
        </div>

        {/* ── Lista ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#5a5f66', fontSize: '13px' }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
              Carregando notas…
            </div>
          )}

          {!loading && notasFiltradas.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '48px 20px',
              border: '1px dashed #2e3238', borderRadius: '12px',
              color: '#5a5f66', fontSize: '13px',
            }}>
              <FileText size={28} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
              {search || statusFilter !== 'todas'
                ? 'Nenhuma nota encontrada com os filtros aplicados.'
                : 'Nenhuma nota fiscal emitida ainda.'}
            </div>
          )}

          {!loading && notasFiltradas.map(nota => {
            const expanded = expandedId === nota.id

            return (
              <div key={nota.id} style={{
                background: '#1a1d20',
                border: `1px solid ${expanded ? '#3a4050' : '#252830'}`,
                borderRadius: '10px',
                overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}>
                {/* Linha principal */}
                <div
                  onClick={() => setExpandedId(expanded ? null : nota.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr 1fr 120px 110px 110px auto',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: '#5a5f66', marginBottom: '2px' }}>NF-e</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#c0c5cc', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                      {nota.numero || '—'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#4a4f56' }}>Série {nota.serie}</div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#d0d5dc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nota.dest_nome || '—'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#5a5f66', marginTop: '2px' }}>
                      {fmtDoc(nota.dest_cpf_cnpj)} · {nota.dest_uf}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: '#5a5f66', marginBottom: '2px' }}>Natureza</div>
                    <div style={{ fontSize: '12px', color: '#9095a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nota.natureza_operacao}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#5a5f66', marginBottom: '2px' }}>Emissão</div>
                    <div style={{ fontSize: '12px', color: '#9095a0' }}>{fmtDate(nota.created_at)}</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#5a5f66', marginBottom: '2px' }}>Valor total</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#c0c5cc' }}>R$ {fmt(nota.valor_total)}</div>
                  </div>

                  <div><StatusBadge status={nota.status} /></div>

                  <div style={{ color: '#3a3d42' }}>
                    {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </div>

                {/* ── Painel expandido ── */}
                {expanded && (
                  <div style={{ borderTop: '1px solid #252830', padding: '14px', background: '#161820' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>

                      {/* Destinatário */}
                      <div style={{ background: '#1a1d20', border: '1px solid #252830', borderRadius: '8px', padding: '10px 12px' }}>
                        <SectionTitle>Destinatário</SectionTitle>
                        <InfoLine label="Nome"     value={nota.dest_nome} />
                        <InfoLine label="CNPJ/CPF" value={fmtDoc(nota.dest_cpf_cnpj)} />
                        <InfoLine label="IE"       value={nota.dest_ie || 'ISENTO'} />
                        <InfoLine label="E-mail"   value={nota.dest_email} />
                        <InfoLine label="Telefone" value={nota.dest_telefone} />
                      </div>

                      {/* Endereço */}
                      <div style={{ background: '#1a1d20', border: '1px solid #252830', borderRadius: '8px', padding: '10px 12px' }}>
                        <SectionTitle>Endereço</SectionTitle>
                        <InfoLine label="Logradouro" value={`${nota.dest_logradouro ?? ''}${nota.dest_numero ? `, ${nota.dest_numero}` : ''}`} />
                        <InfoLine label="Bairro"     value={nota.dest_bairro} />
                        <InfoLine label="Município"  value={`${nota.dest_municipio ?? ''} — ${nota.dest_uf ?? ''}`} />
                        <InfoLine label="CEP"        value={nota.dest_cep} />
                      </div>

                      {/* Financeiro */}
                      <div style={{ background: '#1a1d20', border: '1px solid #252830', borderRadius: '8px', padding: '10px 12px' }}>
                        <SectionTitle>Valores</SectionTitle>
                        <InfoLine label="Produtos" value={`R$ ${fmt(nota.valor_produtos ?? nota.valor_total)}`} />
                        <InfoLine label="Frete"    value={`R$ ${fmt(nota.valor_frete)}`} />
                        <InfoLine label="Desconto" value={`R$ ${fmt(nota.valor_desconto)}`} />
                        <div style={{ borderTop: '1px solid #252830', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', color: '#5a5f66' }}>Total</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#60c080' }}>R$ {fmt(nota.valor_total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Protocolo / chave — só para autorizadas */}
                    {nota.status === 'autorizada' && (nota.chave_acesso || nota.xml_protocolo) && (
                      <div style={{
                        background: '#102a18', border: '1px solid #1a4a28',
                        borderRadius: '8px', padding: '10px 14px', marginBottom: '14px',
                      }}>
                        <SectionTitle color="#3a7a48">Autorização SEFAZ</SectionTitle>
                        <InfoLine label="Protocolo"      value={nota.xml_protocolo} />
                        <InfoLine label="Chave de acesso" value={nota.chave_acesso} mono />
                      </div>
                    )}

                    {/* Motivo rejeição */}
                    {nota.status === 'rejeitada' && nota.sefaz_motivo && (
                      <div style={{
                        background: '#2a1010', border: '1px solid #4a2020',
                        borderRadius: '8px', padding: '10px 14px', marginBottom: '14px',
                      }}>
                        <SectionTitle color="#8a4040">Motivo da Rejeição</SectionTitle>
                        <p style={{ fontSize: '12px', color: '#c08080', margin: 0 }}>{nota.sefaz_motivo}</p>
                      </div>
                    )}

                    {/* Itens */}
                    {nota.itens?.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '10px', color: '#4a4f56', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 600 }}>
                          Itens ({nota.itens.length})
                        </div>
                        <div style={{ border: '1px solid #252830', borderRadius: '8px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                            <thead>
                              <tr style={{ background: '#1e2125' }}>
                                {['Descrição', 'NCM', 'CFOP', 'Un.', 'Qtd.', 'Vl. Unit.', 'Vl. Total'].map(h => (
                                  <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Descrição' ? 'left' : 'right', color: '#4a4f56', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {nota.itens.map((item: any, i: number) => (
                                <tr key={i} style={{ borderTop: '1px solid #1e2125' }}>
                                  <td style={{ padding: '7px 10px', color: '#9095a0' }}>{item.produto_desc || '—'}</td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6a6f78' }}>{item.ncm || '—'}</td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6a6f78' }}>{item.cfop || '—'}</td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6a6f78' }}>UN</td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#9095a0' }}>{item.quantidade}</td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#9095a0' }}>R$ {fmt(item.valor_unit)}</td>
                                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#c0c5cc', fontWeight: 600 }}>R$ {fmt(item.valor_total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Ações */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '10px', color: '#3a3f46' }}>ID: {nota.id}</div>
                      <div style={{ display: 'flex', gap: '6px' }}>

                        {/* Ver DANFE */}
                        <ActionBtn
                          icon={<Eye size={13} />}
                          label="Ver DANFE"
                          onClick={() => setDanfeNota(nota)}
                          variant="default"
                        />

                        {/* Download XML — disponível para QUALQUER status */}
                        <ActionBtn
                          icon={downloadingId === nota.id
                            ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                            : nota.xml_url ? <Download size={13} /> : <FileCode size={13} />
                          }
                          label={
                            downloadingId === nota.id ? 'Baixando…'
                            : nota.xml_url            ? 'XML assinado'
                            :                           'XML rascunho'
                          }
                          title={
                            nota.xml_url
                              ? 'Baixar XML assinado transmitido à SEFAZ'
                              : 'Baixar XML de rascunho para conferência (sem assinatura)'
                          }
                          onClick={() => handleDownloadXml(nota)}
                          variant="default"
                          disabled={downloadingId === nota.id}
                        />

                        {/* Emitir (rascunho ou pendente) */}
                        {(nota.status === 'rascunho' || nota.status === 'pendente') && (
                          <ActionBtn
                            icon={<Send size={13} />}
                            label="Emitir"
                            onClick={() => handleEmitir(nota)}
                            variant="primary"
                          />
                        )}

                        {/* Excluir rascunho */}
                        {nota.status === 'rascunho' && (
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
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: '24px',
            borderTop: '1px solid #2e3238', paddingTop: '12px', marginTop: '4px',
          }}>
            <Stat label="Total de notas"        value={String(notas.length)} />
            <Stat label="Autorizadas"            value={String(notas.filter(n => n.status === 'autorizada').length)} color="#60c080" />
            <Stat label="Rascunhos"              value={String(notas.filter(n => n.status === 'rascunho').length)}   color="#a0a5ad" />
            <Stat label="Faturado (autorizadas)" value={`R$ ${fmt(totalAutorizadas)}`} color="#6c9fd4" />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #3a4050; }
        input:focus { border-color: #3a4a6a !important; }
      `}</style>
    </>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function SectionTitle({ children, color = '#4a4f56' }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: '10px', color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 600 }}>
      {children}
    </div>
  )
}

function InfoLine({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
      <span style={{ fontSize: '11px', color: '#4a4f56', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: '11px', color: '#8a8f98', textAlign: 'right',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontFamily: mono ? 'monospace' : undefined, letterSpacing: mono ? '0.5px' : undefined,
      }}>
        {value || '—'}
      </span>
    </div>
  )
}

function ActionBtn({
  icon, label, title, onClick, variant = 'default', disabled = false,
}: {
  icon: React.ReactNode
  label: string
  title?: string
  onClick: () => void
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: '#22262b', border: '1px solid #3a3d42', color: '#9095a0' },
    primary: { background: '#1e4a7a', border: '1px solid #2a6aad', color: '#90c8f0' },
    danger:  { background: '#2a1010', border: '1px solid #5a2020', color: '#f08080' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '6px 12px', borderRadius: '7px', fontSize: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500,
        opacity: disabled ? 0.4 : 1, transition: 'opacity 0.15s',
        ...styles[variant],
      }}
    >
      {icon} {label}
    </button>
  )
}

function Stat({ label, value, color = '#7a7f86' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '10px', color: '#4a4f56', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 600, color }}>{value}</div>
    </div>
  )
}