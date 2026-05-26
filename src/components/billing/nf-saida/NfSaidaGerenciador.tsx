'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { DanfePreview } from './DanfePreview'
import type { NfSaidaForm } from './types'
import {
  FileText, Search, RefreshCw, ChevronDown, ChevronUp,
  Eye, Trash2, Send, X, CheckCircle2, Clock, AlertCircle,
  Ban, Filter, Download,
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
  dest_tipo: string
  dest_ie: string | null
  dest_email: string | null
  dest_telefone: string | null
  dest_logradouro: string | null
  dest_numero: string | null
  dest_complemento: string | null
  dest_bairro: string | null
  dest_municipio: string | null
  dest_codigo_mun: string | null
  dest_uf2: string | null
  dest_cep: string | null
  informacoes_adicionais: string | null
  chave_ref: string | null
  finalidade: number
}

interface Emitente {
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

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<StatusNf, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  rascunho:  { label: 'Rascunho',  color: '#a0a5ad', bg: '#22262b', border: '#3a3d42', icon: <Clock size={11} /> },
  pendente:  { label: 'Pendente',  color: '#f0c060', bg: '#2a2410', border: '#5a4a10', icon: <AlertCircle size={11} /> },
  autorizada:{ label: 'Autorizada',color: '#60c080', bg: '#102a18', border: '#205a30', icon: <CheckCircle2 size={11} /> },
  cancelada: { label: 'Cancelada', color: '#f08080', bg: '#2a1010', border: '#5a2020', icon: <Ban size={11} /> },
  rejeitada: { label: 'Rejeitada', color: '#f08080', bg: '#2a1010', border: '#5a2020', icon: <X size={11} /> },
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
  const [notas, setNotas]           = useState<NfSaidaRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusNf | 'todas'>('todas')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [emitente, setEmitente]     = useState<Emitente | null>(null)
  const [danfeNota, setDanfeNota]   = useState<NfSaidaRow | null>(null)
  const [sortDir, setSortDir]       = useState<'desc' | 'asc'>('desc')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Busca emitente ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('fiscal_config')
      .select('razao_social, cnpj, ie, logradouro, numero, bairro, municipio, uf, cep, telefone')
      .eq('company_id', companyId)
      .single()
      .then(({ data }) => {
        if (data) setEmitente({
          razao_social: data.razao_social,
          cnpj:         data.cnpj,
          ie:           data.ie ?? '',
          logradouro:   data.logradouro,
          numero:       data.numero,
          bairro:       data.bairro,
          municipio:    data.municipio,
          uf:           data.uf?.trim(),
          cep:          data.cep,
          fone:         data.telefone ?? undefined,
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

    if (error) {
      onError?.(error.message)
    } else {
      setNotas((data ?? []) as NfSaidaRow[])
    }
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

  // ── Deletar rascunho ────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Excluir este rascunho? Esta ação não pode ser desfeita.')) return
    setDeletingId(id)
    const { error } = await supabase.from('nf_saida').delete().eq('id', id)
    if (error) onError?.(error.message)
    else setNotas(prev => prev.filter(n => n.id !== id))
    setDeletingId(null)
  }

  // ── Montar form para o DanfePreview a partir de uma linha salva ─────────
  function buildFormFromRow(row: NfSaidaRow): NfSaidaForm {
    return {
      tipo_nota:          row.tipo_nota,
      natureza_operacao:  row.natureza_operacao,
      cfop_padrao:        row.itens?.[0]?.cfop ?? '',
      finalidade:         row.finalidade ?? 1,
      serie:              row.serie,
      destinatario: {
        tipo:             row.dest_tipo as any ?? 'fisica',
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
        ind_ie_dest:      1,
      },
      itens:                row.itens ?? [],
      valor_desconto:       row.valor_desconto ?? 0,
      valor_frete:          row.valor_frete ?? 0,
      forma_pagamento:      'boleto',
      informacoes_adicionais: row.informacoes_adicionais ?? '',
      chave_ref:            row.chave_ref ?? '',
    }
  }

  // ── Totais do rodapé ────────────────────────────────────────────────────
  const totalAutorizadas = notas.filter(n => n.status === 'autorizada').reduce((s, n) => s + n.valor_total, 0)
  const totalNotas = notasFiltradas.length

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Modal DANFE */}
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

        {/* ── Cabeçalho da tela ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f0f2f4', margin: 0 }}>
              Notas Fiscais de Saída
            </h2>
            <p style={{ fontSize: '12px', color: '#7a7f86', marginTop: '2px' }}>
              {totalNotas} nota{totalNotas !== 1 ? 's' : ''} encontrada{totalNotas !== 1 ? 's' : ''}
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

        {/* ── Barra de busca + filtros ── */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Search */}
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

          {/* Filtro de status */}
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

          {/* Ordenação */}
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

        {/* ── Lista de notas ── */}
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
            const s = STATUS_CONFIG[nota.status] ?? STATUS_CONFIG.rascunho

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
                  {/* Número */}
                  <div>
                    <div style={{ fontSize: '11px', color: '#5a5f66', marginBottom: '2px' }}>NF-e</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#c0c5cc', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                      {nota.numero || '—'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#4a4f56' }}>Série {nota.serie}</div>
                  </div>

                  {/* Destinatário */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#d0d5dc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nota.dest_nome || '—'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#5a5f66', marginTop: '2px' }}>
                      {fmtDoc(nota.dest_cpf_cnpj)} · {nota.dest_uf}
                    </div>
                  </div>

                  {/* Natureza */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: '#5a5f66', marginBottom: '2px' }}>Natureza</div>
                    <div style={{ fontSize: '12px', color: '#9095a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nota.natureza_operacao}
                    </div>
                  </div>

                  {/* Data */}
                  <div>
                    <div style={{ fontSize: '11px', color: '#5a5f66', marginBottom: '2px' }}>Emissão</div>
                    <div style={{ fontSize: '12px', color: '#9095a0' }}>{fmtDate(nota.created_at)}</div>
                  </div>

                  {/* Valor */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#5a5f66', marginBottom: '2px' }}>Valor total</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#c0c5cc' }}>R$ {fmt(nota.valor_total)}</div>
                  </div>

                  {/* Status */}
                  <div>
                    <StatusBadge status={nota.status} />
                  </div>

                  {/* Chevron */}
                  <div style={{ color: '#3a3d42' }}>
                    {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </div>

                {/* ── Painel expandido ── */}
                {expanded && (
                  <div style={{ borderTop: '1px solid #252830', padding: '14px', background: '#161820' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>

                      {/* Bloco destinatário */}
                      <div style={{ background: '#1a1d20', border: '1px solid #252830', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '10px', color: '#4a4f56', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 600 }}>
                          Destinatário
                        </div>
                        <InfoLine label="Nome" value={nota.dest_nome} />
                        <InfoLine label="CNPJ/CPF" value={fmtDoc(nota.dest_cpf_cnpj)} />
                        <InfoLine label="IE" value={nota.dest_ie || 'ISENTO'} />
                        <InfoLine label="E-mail" value={nota.dest_email} />
                        <InfoLine label="Telefone" value={nota.dest_telefone} />
                      </div>

                      {/* Bloco endereço */}
                      <div style={{ background: '#1a1d20', border: '1px solid #252830', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '10px', color: '#4a4f56', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 600 }}>
                          Endereço
                        </div>
                        <InfoLine label="Logradouro" value={`${nota.dest_logradouro ?? ''}${nota.dest_numero ? `, ${nota.dest_numero}` : ''}`} />
                        <InfoLine label="Bairro" value={nota.dest_bairro} />
                        <InfoLine label="Município" value={`${nota.dest_municipio ?? ''} — ${nota.dest_uf ?? ''}`} />
                        <InfoLine label="CEP" value={nota.dest_cep} />
                      </div>

                      {/* Bloco financeiro */}
                      <div style={{ background: '#1a1d20', border: '1px solid #252830', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ fontSize: '10px', color: '#4a4f56', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 600 }}>
                          Valores
                        </div>
                        <InfoLine label="Produtos" value={`R$ ${fmt(nota.valor_total + nota.valor_desconto - nota.valor_frete)}`} />
                        <InfoLine label="Frete" value={`R$ ${fmt(nota.valor_frete)}`} />
                        <InfoLine label="Desconto" value={`R$ ${fmt(nota.valor_desconto)}`} />
                        <div style={{ borderTop: '1px solid #252830', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', color: '#5a5f66' }}>Total</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#60c080' }}>R$ {fmt(nota.valor_total)}</span>
                        </div>
                      </div>
                    </div>

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
                      <div style={{ fontSize: '10px', color: '#3a3f46' }}>
                        ID: {nota.id}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {/* Visualizar DANFE */}
                        <ActionBtn
                          icon={<Eye size={13} />}
                          label="Ver DANFE"
                          onClick={() => setDanfeNota(nota)}
                          variant="default"
                        />

                        {/* Download (placeholder) */}
                        <ActionBtn
                          icon={<Download size={13} />}
                          label="XML"
                          onClick={() => onError?.('Download de XML disponível apenas para NF-e autorizadas.')}
                          variant="default"
                          disabled={nota.status !== 'autorizada'}
                        />

                        {/* Emitir (apenas rascunho/pendente) */}
                        {(nota.status === 'rascunho' || nota.status === 'pendente') && (
                          <ActionBtn
                            icon={<Send size={13} />}
                            label="Emitir"
                            onClick={async () => {
                              const { error } = await supabase.functions.invoke('emitir-nfe', { body: { nf_saida_id: nota.id } })
                              if (error) onError?.(error.message)
                              else fetchNotas()
                            }}
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

        {/* ── Rodapé com totais ── */}
        {!loading && notas.length > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: '24px',
            borderTop: '1px solid #2e3238', paddingTop: '12px', marginTop: '4px',
          }}>
            <Stat label="Total de notas" value={String(notas.length)} />
            <Stat label="Autorizadas" value={String(notas.filter(n => n.status === 'autorizada').length)} color="#60c080" />
            <Stat label="Rascunhos" value={String(notas.filter(n => n.status === 'rascunho').length)} color="#a0a5ad" />
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
function InfoLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
      <span style={{ fontSize: '11px', color: '#4a4f56', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '11px', color: '#8a8f98', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value || '—'}
      </span>
    </div>
  )
}

function ActionBtn({
  icon, label, onClick, variant = 'default', disabled = false,
}: {
  icon: React.ReactNode
  label: string
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
