'use client'
import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  type NfEntrada,
  type ItemNota,
  type Evento,
  STATUS_LABEL,
  CONFIRM_MESSAGES,
} from './types'
import { ConversaoRegrasManager } from './ConversaoRegrasManager'

type ItemConvertido = {
  cfop_origem: string
  cst_origem: string | number
  finalidade: string
  cfop_entrada: string
  cst_entrada: string | number
  convertido: boolean
}

type ItemOverride = {
  cfop_entrada: string
  cst_entrada: string
}

type ProdutoBusca = {
  id: number
  name: string
  ean: string | null
  code: number
  stock: number | null
  cost_price: number | null
  price: number | null
}

const FINALIDADES = [
  { value: 'revenda',          label: 'Compra para revenda' },
  { value: 'uso_consumo',      label: 'Uso e consumo' },
  { value: 'ativo',            label: 'Ativo imobilizado' },
  { value: 'industrializacao', label: 'Industrialização' },
  { value: 'devolucao',        label: 'Devolução' },
  { value: 'bonificacao',      label: 'Bonificação / Brinde' },
] as const

type Finalidade = typeof FINALIDADES[number]['value']

function fmtCnpj(v: string) {
  return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}
function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}
function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

const STATUS_BADGE: Record<NfEntrada['status'], { bg: string; text: string; dot: string }> = {
  pendente:   { bg: 'bg-yellow-50 border border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  confirmada: { bg: 'bg-green-50 border border-green-200',   text: 'text-green-700',  dot: 'bg-green-500'  },
  cancelada:  { bg: 'bg-red-50 border border-red-200',       text: 'text-red-700',    dot: 'bg-red-500'    },
  recusada:   { bg: 'bg-gray-100 border border-gray-200',    text: 'text-gray-600',   dot: 'bg-gray-400'   },
}

// ─── Modal de conversão ────────────────────────────────────────────────────────

function ConversaoModal({ onClose, onError }: { onClose: () => void; onError: (msg: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-10 pb-6 overflow-y-auto">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-4xl shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl z-10">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Regras de conversão CFOP / CST</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              As novas regras serão aplicadas imediatamente ao recalcular a finalidade
            </p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-lg hover:bg-gray-100 text-lg leading-none"
            aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="p-5 pb-6">
          <ConversaoRegrasManager onError={onError} />
        </div>
      </div>
    </div>
  )
}

// ─── Modal de vínculo de produto ──────────────────────────────────────────────

function ModalVincularProduto({
  companyId,
  item,
  onVincular,
  onClose,
}: {
  companyId: string
  item: ItemNota
  onVincular: (produto: ProdutoBusca) => void
  onClose: () => void
}) {
  const [busca,      setBusca]      = useState('')
  const [resultados, setResultados] = useState<ProdutoBusca[]>([])
  const [buscando,   setBuscando]   = useState(false)

  const handleBusca = async (termo: string) => {
    setBusca(termo)
    if (termo.length < 2) { setResultados([]); return }
    setBuscando(true)
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, ean, code, stock, cost_price, price')
        .eq('company_id', companyId)
        .eq('active', true)
        .or(`name.ilike.%${termo}%,ean.ilike.%${termo}%`)
        .limit(8)
      setResultados((data ?? []) as ProdutoBusca[])
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900">Vincular produto</p>
            <p className="text-xs text-gray-400 truncate max-w-xs" title={item.descricao}>
              {item.descricao}
            </p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none p-1 rounded hover:bg-gray-100 transition-colors">
            ✕
          </button>
        </div>

        {/* Busca */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <input
              autoFocus
              type="text"
              placeholder="Buscar por nome, EAN ou código…"
              value={busca}
              onChange={e => handleBusca(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 pr-8"
            />
            {buscando && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="w-4 h-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </span>
            )}
          </div>
        </div>

        {/* Resultados */}
        <div className="px-4 pb-4 space-y-1 max-h-72 overflow-y-auto">
          {busca.length < 2 && (
            <p className="text-xs text-gray-400 text-center py-6">
              Digite pelo menos 2 caracteres para buscar.
            </p>
          )}
          {busca.length >= 2 && !buscando && resultados.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">Nenhum produto encontrado.</p>
          )}
          {resultados.map(produto => (
            <button
              key={produto.id}
              onClick={() => onVincular(produto)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                hover:bg-blue-50 border border-transparent hover:border-blue-200
                transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{produto.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  Cód: {produto.code}
                  {produto.ean ? ` · EAN: ${produto.ean}` : ''}
                  {produto.stock != null ? ` · Estoque: ${produto.stock}` : ''}
                  {produto.cost_price != null
                    ? ` · Custo: R$ ${fmtMoney(produto.cost_price)}`
                    : ''}
                </p>
              </div>
              <span className="text-xs text-blue-600 font-medium ml-3 shrink-0">Selecionar</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  nota: NfEntrada
  companyId: string
  onBack: () => void
  onUpdated: (nota: NfEntrada) => void
  onDeleted: (chave: string) => void
  onError: (msg: string) => void
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export function NfEntradaDetalhe({ nota, companyId, onBack, onUpdated, onDeleted, onError }: Props) {
  const [loading,            setLoading]            = useState<string | null>(null)
  const [copied,             setCopied]             = useState(false)
  const [finalidade,         setFinalidade]         = useState<Finalidade>(
    (nota.finalidade as Finalidade) ?? 'revenda'
  )
  const [recalculando,       setRecalculando]       = useState(false)
  const [itensConvertidos,   setItensConvertidos]   = useState<ItemConvertido[]>(
    (nota.itens_convertidos as ItemConvertido[]) ?? []
  )
  const [overrides,          setOverrides]          = useState<Record<number, ItemOverride>>({})
  const [fatores,            setFatores]            = useState<Record<number, number>>(() =>
    Object.fromEntries((nota.itens_nota ?? []).map((_, idx) => [idx, 1]))
  )
  const [showConversaoModal, setShowConversaoModal] = useState(false)
  const [modalVinculo,       setModalVinculo]       = useState<{ idx: number; item: ItemNota } | null>(null)
  const [vinculando,         setVinculando]         = useState<number | null>(null)

  const badge      = STATUS_BADGE[nota.status]
  const itens      = (nota.itens_nota ?? []) as ItemNota[]
  const totalItens = itens.reduce((s, i) => s + i.valor_total, 0)

  const isPending      = nota.status === 'pendente'
  const isConfirmed    = nota.status === 'confirmada'
  const isClosed       = nota.status === 'cancelada' || nota.status === 'recusada'
  const itensPendentes = itens.filter(i => i.produto_id === null).length

  const conversaoMap = useMemo(() => {
    const m: Record<string, ItemConvertido> = {}
    for (const ic of itensConvertidos) m[String(ic.cfop_origem)] = ic
    return m
  }, [itensConvertidos])

  const handleCopiarChave = async () => {
    try {
      await navigator.clipboard.writeText(nota.chave)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { onError('Erro ao copiar chave') }
  }

  const handleFinalidadeChange = async (nova: Finalidade) => {
    if (nova === finalidade) return
    setFinalidade(nova)
    setRecalculando(true)
    try {
      const res = await fetch('/api/fiscal/nf-entrada/recalcular-conversao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, chave: nota.chave, finalidade: nova }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Erro ao recalcular conversão')
      }
      const { itens_convertidos: novaConversao, requer_revisao } = await res.json()
      setItensConvertidos(novaConversao)
      setOverrides({})
      onUpdated({ ...nota, finalidade: nova, itens_convertidos: novaConversao, requer_revisao })
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao recalcular conversão')
      setFinalidade((nota.finalidade as Finalidade) ?? 'revenda')
    } finally {
      setRecalculando(false)
    }
  }

  const getOverride = (idx: number, item: ItemNota): ItemOverride => {
    if (overrides[idx]) return overrides[idx]
    const conv = conversaoMap[item.cfop]
    return {
      cfop_entrada: conv?.cfop_entrada ?? item.cfop,
      cst_entrada:  String(conv?.cst_entrada ?? item.cst),
    }
  }

  const handleOverride = (idx: number, field: keyof ItemOverride, value: string) => {
    setOverrides(prev => ({
      ...prev,
      [idx]: { ...getOverride(idx, itens[idx]), [field]: value },
    }))
  }

  const handleFatorChange = (idx: number, value: string) => {
    const num = Math.max(1, parseInt(value) || 1)
    setFatores(prev => ({ ...prev, [idx]: num }))
  }

  const handleVincularProduto = async (produto: ProdutoBusca) => {
    if (!modalVinculo) return
    const { idx, item } = modalVinculo
    setVinculando(idx)
    try {
      const res = await fetch('/api/fiscal/nf-entrada/vincular-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          chave: nota.chave,
          itemCodigo: item.codigo,
          produtoId: produto.id,
        }),
      })
      if (!res.ok) throw new Error('Erro ao vincular produto')

      // Atualiza localmente sem recarregar
      const itensAtualizados = itens.map((it, i) =>
        i === idx ? { ...it, produto_id: produto.id, produto_nome: produto.name } : it
      )
      onUpdated({ ...nota, itens_nota: itensAtualizados })
      setModalVinculo(null)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao vincular produto')
    } finally {
      setVinculando(null)
    }
  }

  const handleManifestar = async (evento: Evento) => {
    const confirmMsg = CONFIRM_MESSAGES[evento]
    if (confirmMsg && !window.confirm(`${confirmMsg} Esta ação pode ser desfeita reabrindo a nota.`)) return
    setLoading(evento)
    try {
      const res = await fetch('/api/fiscal/nf-entrada/manifestar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          chave: nota.chave,
          evento,
          fatores: evento === 'confirmacao' ? fatores : undefined,
        }),
      })
      if (!res.ok) throw new Error('Erro ao manifestar')
      const statusMap: Partial<Record<Evento, NfEntrada['status']>> = {
        confirmacao: 'confirmada', recusa: 'recusada',
        cancelamento: 'cancelada', reabrir: 'pendente',
      }
      const novoStatus = statusMap[evento]
      if (novoStatus) onUpdated({ ...nota, status: novoStatus })
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao manifestar')
    } finally { setLoading(null) }
  }

  const handleExcluir = async () => {
    if (!window.confirm('Excluir esta nota permanentemente? Esta ação não pode ser desfeita.')) return
    setLoading('excluir')
    try {
      const res = await fetch('/api/fiscal/nf-entrada/excluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, chave: nota.chave }),
      })
      if (!res.ok) throw new Error('Erro ao excluir nota')
      onDeleted(nota.chave)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao excluir')
    } finally { setLoading(null) }
  }

  return (
    <>
      <div className="space-y-5">

        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <button onClick={onBack}
              className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800
                transition-colors border border-gray-200 rounded-lg px-3 py-1.5 shrink-0">
              ← Voltar
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-gray-900">
                  NF-e Nº {nota.numero} / Série {nota.serie}
                </h2>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                  {STATUS_LABEL[nota.status]}
                </span>
                {nota.requer_revisao && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
                    bg-orange-50 border border-orange-200 text-orange-700">
                    ⚠ Revisão pendente
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Emitida em {fmtDate(nota.data_emissao)}
                {nota.created_at && ` · Importada em ${new Date(nota.created_at).toLocaleDateString('pt-BR')}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {nota.xml_url && (
              <a href={nota.xml_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200
                  text-gray-600 hover:bg-gray-50 transition-colors">
                📄 XML
              </a>
            )}
            <button onClick={handleExcluir} disabled={loading === 'excluir'}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-200
                text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40">
              {loading === 'excluir' ? '...' : '🗑 Excluir'}
            </button>
          </div>
        </div>

        {/* Emitente */}
        <Section icon="🏭" title="Emitente">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            <Field label="Razão social" value={nota.emitente_razao} span={2} />
            <Field label="CNPJ" value={fmtCnpj(nota.emitente_cnpj)} />
            <Field label="Finalidade importada" value={nota.finalidade ?? '—'} />
          </div>
        </Section>

        {/* Dados da nota */}
        <Section icon="📋" title="Dados da nota">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            <Field label="Número"       value={nota.numero} />
            <Field label="Série"        value={nota.serie} />
            <Field label="Data emissão" value={fmtDate(nota.data_emissao)} />
            <Field label="Valor total"  value={`R$ ${fmtMoney(nota.valor_total)}`} highlight />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Chave de acesso</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              <span className="font-mono text-[11px] text-gray-600 flex-1 break-all leading-relaxed">
                {nota.chave}
              </span>
              <button onClick={handleCopiarChave}
                className="shrink-0 text-xs px-2.5 py-1 rounded border border-gray-200
                  bg-white text-gray-500 hover:bg-gray-100 transition-colors">
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        </Section>

        {/* Finalidade */}
        <Section icon="🎯" title="Finalidade da entrada">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-2">
                Define como os CFOPs e CSTs da nota serão convertidos para entrada.
                Ao alterar, o sistema recalcula automaticamente com base na tabela de conversão.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative inline-block">
                  <select
                    value={finalidade}
                    onChange={e => handleFinalidadeChange(e.target.value as Finalidade)}
                    disabled={recalculando}
                    className="appearance-none border border-gray-300 rounded-lg px-4 py-2.5 pr-8
                      text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200
                      focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {FINALIDADES.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▾</span>
                </div>
                <button
                  onClick={() => setShowConversaoModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-lg border
                    border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800
                    transition-colors whitespace-nowrap"
                >
                  ⚙ Gerenciar conversões
                </button>
              </div>
            </div>
            {recalculando && (
              <div className="flex items-center gap-2 text-xs text-blue-600">
                <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                Recalculando conversão…
              </div>
            )}
            {!recalculando && itensConvertidos.some(i => !i.convertido) && (
              <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50
                border border-orange-200 rounded-lg px-3 py-2">
                ⚠ {itensConvertidos.filter(i => !i.convertido).length} item(s) sem conversão encontrada
              </div>
            )}
          </div>
        </Section>

        {/* Itens */}
        <Section icon="📦" title="Itens da nota"
          badge={itensPendentes > 0 ? `${itensPendentes} sem vínculo` : undefined}
          badgeColor="orange">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-xs min-w-[960px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[
                    ['Produto / Descrição', 'left'],
                    ['CFOP orig.',          'left'],
                    ['CST orig.',           'left'],
                    ['CFOP entrada',        'left'],
                    ['CST entrada',         'left'],
                    ['Qtd NF',              'right'],
                    ['Por Caixa',           'center'],
                    ['Qtd Final',           'center'],
                    ['Vlr unit.',           'right'],
                    ['Total',               'right'],
                    ['Vínculo',             'center'],
                  ].map(([h, align]) => (
                    <th key={h as string}
                      className={`px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-${align}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {itens.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-8 text-gray-400">Nenhum item</td></tr>
                ) : itens.map((item, idx) => {
                  const conv        = conversaoMap[item.cfop]
                  const override    = getOverride(idx, item)
                  const semConv     = conv && !conv.convertido
                  const hasOverride = !!overrides[idx]
                  const fator       = fatores[idx] ?? 1
                  const qtdFinal    = item.quantidade * fator
                  const isVinculando = vinculando === idx

                  return (
                    <tr key={idx} className={`transition-colors ${semConv ? 'bg-orange-50/40' : 'hover:bg-gray-50'}`}>
                      <td className="px-3 py-2.5 text-gray-800 max-w-[180px]">
                        <p className="truncate font-medium" title={item.descricao}>{item.descricao}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{item.codigo}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                          {item.cfop}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                          {item.cst}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 w-28">
                        <div className="relative">
                          <input
                            type="text"
                            maxLength={4}
                            value={override.cfop_entrada}
                            onChange={e => handleOverride(idx, 'cfop_entrada', e.target.value)}
                            className={`w-full font-mono text-xs px-2 py-1.5 rounded border text-center
                              focus:outline-none focus:ring-2 transition-colors
                              ${semConv && !hasOverride
                                ? 'border-orange-300 bg-orange-50 text-orange-800 focus:ring-orange-200'
                                : hasOverride
                                ? 'border-blue-300 bg-blue-50 text-blue-800 focus:ring-blue-200'
                                : 'border-gray-200 bg-white text-gray-700 focus:ring-gray-200'
                              }`}
                          />
                          {semConv && !hasOverride && (
                            <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-orange-400 text-white
                              rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold leading-none">!</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 w-28">
                        <input
                          type="text"
                          maxLength={4}
                          value={override.cst_entrada}
                          onChange={e => handleOverride(idx, 'cst_entrada', e.target.value)}
                          className={`w-full font-mono text-xs px-2 py-1.5 rounded border text-center
                            focus:outline-none focus:ring-2 transition-colors
                            ${semConv && !hasOverride
                              ? 'border-orange-300 bg-orange-50 text-orange-800 focus:ring-orange-200'
                              : hasOverride
                              ? 'border-blue-300 bg-blue-50 text-blue-800 focus:ring-blue-200'
                              : 'border-gray-200 bg-white text-gray-700 focus:ring-gray-200'
                            }`}
                        />
                      </td>

                      {/* Qtd NF */}
                      <td className="px-3 py-2.5 text-gray-700 text-right whitespace-nowrap">
                        {item.quantidade} {item.unidade}
                      </td>

                      {/* Por Caixa */}
                      <td className="px-3 py-2.5 text-center w-24">
                        <input
                          type="number"
                          min={1}
                          value={fator}
                          onChange={e => handleFatorChange(idx, e.target.value)}
                          className={`w-16 border rounded px-2 py-1 text-xs text-center font-mono
                            focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400
                            transition-colors
                            ${fator > 1
                              ? 'border-blue-300 bg-blue-50 text-blue-800'
                              : 'border-gray-200 bg-white text-gray-700'
                            }`}
                        />
                      </td>

                      {/* Qtd Final */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 font-medium
                          ${fator > 1 ? 'text-blue-700' : 'text-gray-700'}`}>
                          {qtdFinal} {item.unidade}
                          {fator > 1 && (
                            <span className="text-[10px] text-blue-400 font-normal">
                              ({item.quantidade}×{fator})
                            </span>
                          )}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-gray-700 text-right whitespace-nowrap">
                        R$ {fmtMoney(item.valor_unitario)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-900 font-medium text-right whitespace-nowrap">
                        R$ {fmtMoney(item.valor_total)}
                      </td>

                      {/* Vínculo */}
                      <td className="px-3 py-2.5 text-center">
                        {item.produto_id !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full
                              bg-green-50 text-green-700 border border-green-200 font-medium whitespace-nowrap">
                              ✓ {item.produto_nome ?? 'Vinculado'}
                            </span>
                            <button
                              onClick={() => setModalVinculo({ idx, item })}
                              disabled={isVinculando}
                              className="text-[10px] text-gray-400 hover:text-blue-600 underline transition-colors disabled:opacity-40"
                            >
                              Alterar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setModalVinculo({ idx, item })}
                            disabled={isVinculando}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg
                              bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100
                              font-medium transition-colors whitespace-nowrap disabled:opacity-40"
                          >
                            {isVinculando
                              ? <span className="inline-block w-3 h-3 border border-orange-500 border-t-transparent rounded-full animate-spin" />
                              : '🔗'
                            }
                            Vincular
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border border-gray-200 bg-white inline-block" />
              Convertido automaticamente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border border-orange-300 bg-orange-50 inline-block" />
              Sem conversão — edite manualmente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border border-blue-300 bg-blue-50 inline-block" />
              Editado manualmente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border border-blue-300 bg-blue-50 inline-block" />
              Por caixa &gt; 1 — quantidade convertida
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <span className="text-gray-500 text-right">Produtos</span>
              <span className="text-gray-800 text-right font-medium">R$ {fmtMoney(totalItens)}</span>
              <span className="text-gray-500 text-right">Desconto</span>
              <span className="text-gray-800 text-right">R$ 0,00</span>
              <span className="text-gray-500 text-right">Frete</span>
              <span className="text-gray-800 text-right">R$ 0,00</span>
              <span className="text-gray-700 text-right font-semibold pt-1 border-t border-gray-100">Total NF-e</span>
              <span className="text-green-700 text-right font-bold text-base pt-1 border-t border-gray-100">
                R$ {fmtMoney(nota.valor_total)}
              </span>
            </div>
          </div>
        </Section>

        {/* Manifestação */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row
          items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Manifestação do destinatário</p>
            <p className="text-xs text-gray-400 mt-0.5">Registre sua posição sobre esta nota fiscal junto à SEFAZ</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isPending && (
              <>
                <ActionBtn label="Ciência"               color="blue"   loading={loading === 'ciencia'}      onClick={() => handleManifestar('ciencia')} />
                <ActionBtn label="Confirmar recebimento" color="green"  loading={loading === 'confirmacao'}  onClick={() => handleManifestar('confirmacao')} />
                <ActionBtn label="Recusar"               color="red"    loading={loading === 'recusa'}       onClick={() => handleManifestar('recusa')} />
                <ActionBtn label="Cancelar"              color="orange" loading={loading === 'cancelamento'} onClick={() => handleManifestar('cancelamento')} />
              </>
            )}
            {isConfirmed && (
              <ActionBtn label="Cancelar nota" color="orange" loading={loading === 'cancelamento'} onClick={() => handleManifestar('cancelamento')} />
            )}
            {isClosed && (
              <ActionBtn label="Reabrir nota" color="yellow" loading={loading === 'reabrir'} onClick={() => handleManifestar('reabrir')} />
            )}
          </div>
        </div>

      </div>

      {/* Modal conversão CFOP/CST */}
      {showConversaoModal && (
        <ConversaoModal
          onClose={() => setShowConversaoModal(false)}
          onError={onError}
        />
      )}

      {/* Modal vínculo de produto */}
      {modalVinculo && (
        <ModalVincularProduto
          companyId={companyId}
          item={modalVinculo.item}
          onVincular={handleVincularProduto}
          onClose={() => setModalVinculo(null)}
        />
      )}
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ icon, title, badge, badgeColor = 'gray', children }: {
  icon: string; title: string; badge?: string
  badgeColor?: 'gray' | 'orange' | 'green' | 'red'; children: React.ReactNode
}) {
  const badgeColors = {
    gray:   'bg-gray-100 text-gray-600',
    orange: 'bg-orange-50 text-orange-700 border border-orange-200',
    green:  'bg-green-50 text-green-700 border border-green-200',
    red:    'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</span>
        {badge && (
          <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeColors[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Field({ label, value, span = 1, highlight = false }: {
  label: string; value: string; span?: number; highlight?: boolean
}) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-green-700' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}

const actionColors = {
  blue:   'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  green:  'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
  red:    'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
}

function ActionBtn({ label, color, loading, onClick }: {
  label: string; color: keyof typeof actionColors; loading: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed ${actionColors[color]}`}>
      {loading ? '...' : label}
    </button>
  )
}