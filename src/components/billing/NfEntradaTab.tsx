'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────

interface NfEntrada {
  id?: string
  chave: string
  numero: string
  serie: string
  emitente_razao: string
  emitente_cnpj: string
  valor_total: number
  data_emissao: string
  status: 'pendente' | 'confirmada' | 'cancelada' | 'recusada'
  xml_url?: string | null
  itens_nota?: ItemNota[]
  created_at?: string
}

interface ItemNota {
  ean: string
  codigo: string
  descricao: string
  unidade: string
  quantidade: number
  valor_unitario: number
  valor_total: number
  produto_id: number | null
  produto_nome: string | null
}

interface ProdutoBusca {
  id: number
  name: string
  ean?: string | null
  code: number
  price: number
  cost_price?: number | null
  stock?: number | null
}

// Estado por item após vínculo
interface ItemVinculado {
  produto: ProdutoBusca
  atualizarPrecoVenda: boolean | null // null = ainda não perguntou
}

interface Props {
  companyId: string
  onError: (msg: string) => void
}

type Evento = 'ciencia' | 'confirmacao' | 'recusa' | 'cancelamento' | 'reabrir'

// ── Constantes ────────────────────────────────────────────────

const STATUS_LABEL: Record<NfEntrada['status'], string> = {
  pendente:   'Pendente',
  confirmada: 'Confirmada',
  cancelada:  'Cancelada',
  recusada:   'Recusada',
}

const STATUS_COLOR: Record<NfEntrada['status'], string> = {
  pendente:   'bg-yellow-100 text-yellow-700',
  confirmada: 'bg-green-100 text-green-700',
  cancelada:  'bg-red-100 text-red-700',
  recusada:   'bg-gray-100 text-gray-500',
}

const CONFIRM_MESSAGES: Partial<Record<Evento, string>> = {
  recusa:       'Tem certeza que deseja recusar esta nota?',
  cancelamento: 'Tem certeza que deseja cancelar esta nota?',
}

// ── Componente de vinculação de itens ─────────────────────────

function VincularItensCard({
  companyId,
  nota,
  onConfirmado,
  onDismiss,
}: {
  companyId: string
  nota: NfEntrada
  onConfirmado: () => void
  onDismiss: () => void
}) {
  const todosItens     = nota.itens_nota ?? []
  const itensPendentes = todosItens.filter(i => i.produto_id === null)

  const [buscas, setBuscas]         = useState<Record<string, string>>({})
  const [resultados, setResultados] = useState<Record<string, ProdutoBusca[]>>({})
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null)
  const [vinculados, setVinculados] = useState<Record<string, ItemVinculado>>({})
  const [vinculando, setVinculando] = useState<Record<string, boolean>>({})
  const [confirmando, setConfirmando] = useState(false)
  const [timers, setTimers]         = useState<Record<string, ReturnType<typeof setTimeout>>>({})

  const buscarProdutos = useCallback(async (codigo: string, termo: string) => {
    if (!termo || termo.length < 2) {
      setResultados(r => ({ ...r, [codigo]: [] }))
      return
    }
    const { data } = await supabase
      .from('products')
      .select('id, name, ean, code, price, cost_price, stock')
      .eq('company_id', companyId)
      .eq('active', true)
      .or(`name.ilike.%${termo}%,ean.ilike.%${termo}%`)
      .limit(6)
    setResultados(r => ({ ...r, [codigo]: (data ?? []) as ProdutoBusca[] }))
  }, [companyId])

  const handleBusca = (codigo: string, valor: string) => {
    setBuscas(b => ({ ...b, [codigo]: valor }))
    setDropdownAberto(codigo)
    if (timers[codigo]) clearTimeout(timers[codigo])
    const t = setTimeout(() => buscarProdutos(codigo, valor), 300)
    setTimers(prev => ({ ...prev, [codigo]: t }))
  }

  // Seleciona o produto do dropdown — ainda não vincula, só pré-seleciona
  const handleSelecionarProduto = (item: ItemNota, produto: ProdutoBusca) => {
    setBuscas(b => ({ ...b, [item.codigo]: produto.name }))
    setResultados(r => ({ ...r, [item.codigo]: [produto] })) // mantém só o selecionado
    setDropdownAberto(null)
  }

  // Vincula de fato: chama API, atualiza custo/estoque, pergunta preço de venda
  const handleVincular = async (item: ItemNota) => {
    const lista = resultados[item.codigo] ?? []
    if (lista.length === 0) return
    const produto = lista[0]

    setVinculando(v => ({ ...v, [item.codigo]: true }))
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
      if (!res.ok) throw new Error('Erro ao vincular')

      // Marca como vinculado e define se deve perguntar sobre preço de venda
      // O preço de custo da nota é item.valor_unitario
      // Só pergunta se o novo custo for diferente do atual
      setVinculados(v => ({
        ...v,
        [item.codigo]: {
          produto,
          atualizarPrecoVenda: null, // null = ainda não decidiu
        },
      }))
      setDropdownAberto(null)
    } catch {
      // silencia — pai tem onError
    } finally {
      setVinculando(v => ({ ...v, [item.codigo]: false }))
    }
  }

  const handleDecidirPrecoVenda = (codigo: string, atualizar: boolean) => {
    setVinculados(v => ({
      ...v,
      [codigo]: { ...v[codigo], atualizarPrecoVenda: atualizar },
    }))
  }

  // Todos pendentes vinculados E todos com decisão de preço tomada
  const todosVinculados = itensPendentes.every(i => vinculados[i.codigo] !== undefined)
  const todosDecididos  = itensPendentes.every(
    i => vinculados[i.codigo] && vinculados[i.codigo].atualizarPrecoVenda !== null
  )
  const prontoParaConfirmar = todosVinculados && todosDecididos

  const handleConfirmarEntrada = async () => {
    setConfirmando(true)
    try {
      // Monta as atualizações de preço de venda para os que aceitaram
      const atualizacoes = itensPendentes
        .filter(i => vinculados[i.codigo]?.atualizarPrecoVenda === true)
        .map(i => ({
          produtoId:      vinculados[i.codigo].produto.id,
          novoPrecoVenda: i.valor_unitario, // ou aplicar markup — aqui usa o custo direto
        }))

      const res = await fetch('/api/fiscal/nf-entrada/confirmar-entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          chave: nota.chave,
          atualizacoes,
        }),
      })
      if (!res.ok) throw new Error('Erro ao confirmar entrada')

      onConfirmado()
    } catch {
      // silencia — pai tem onError
    } finally {
      setConfirmando(false)
    }
  }

  if (itensPendentes.length === 0) return null

  return (
    <div className="bg-white border border-orange-200 rounded-xl shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-orange-50 border-b border-orange-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔗</span>
          <div>
            <p className="text-sm font-semibold text-orange-800">
              Produtos não identificados — {nota.emitente_razao}
            </p>
            <p className="text-xs text-orange-600 mt-0.5">
              {itensPendentes.length} item{itensPendentes.length !== 1 ? 'ns' : ''} da nota não
              foram encontrados no cadastro. Vincule-os para atualizar o estoque automaticamente.
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-orange-400 hover:text-orange-600 transition-colors text-lg leading-none ml-4 shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Itens */}
      <div className="divide-y divide-gray-50">
        {itensPendentes.map(item => {
          const vinculo    = vinculados[item.codigo]
          const jaVinculou = vinculo !== undefined
          const decidiu    = vinculo?.atualizarPrecoVenda !== null && vinculo?.atualizarPrecoVenda !== undefined
          const custoNota  = item.valor_unitario

          return (
            <div key={item.codigo} className="px-4 py-4 space-y-3">

              {/* Info do item */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.descricao}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Código: {item.codigo}
                    {item.ean ? ` · EAN: ${item.ean}` : ''}
                    {' · '}{item.quantidade} {item.unidade}
                    {' · '}R$ {custoNota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {jaVinculou && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                    ✓ Vinculado a {vinculo.produto.name}
                  </span>
                )}
              </div>

              {/* Busca + botão Vincular */}
              {!jaVinculou && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Buscar produto por nome ou EAN…"
                      value={buscas[item.codigo] ?? ''}
                      onChange={e => handleBusca(item.codigo, e.target.value)}
                      onFocus={() => {
                        if ((resultados[item.codigo] ?? []).length > 0)
                          setDropdownAberto(item.codigo)
                      }}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                        focus:outline-none focus:ring-2 focus:ring-orange-200"
                    />

                    {/* Dropdown */}
                    {dropdownAberto === item.codigo && (resultados[item.codigo] ?? []).length > 0 && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200
                        rounded-lg shadow-lg overflow-hidden">
                        {resultados[item.codigo].map((produto: ProdutoBusca) => (
                          <button
                            key={produto.id}
                            onMouseDown={() => handleSelecionarProduto(item, produto)}
                            className="w-full flex items-center justify-between px-3 py-2.5
                              hover:bg-orange-50 transition-colors text-left"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-800">{produto.name}</p>
                              <p className="text-xs text-gray-400">
                                {produto.ean ? `EAN: ${produto.ean} · ` : ''}
                                Cód: {produto.code}
                                {produto.stock != null ? ` · Estoque: ${produto.stock}` : ''}
                                {produto.cost_price != null
                                  ? ` · Custo atual: R$ ${produto.cost_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                  : ''}
                              </p>
                            </div>
                            <span className="text-xs text-orange-500 ml-3 shrink-0">Selecionar</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Botão Vincular */}
                  <button
                    onClick={() => handleVincular(item)}
                    disabled={!buscas[item.codigo] || (resultados[item.codigo] ?? []).length === 0 || vinculando[item.codigo]}
                    className="shrink-0 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600
                      text-white text-sm px-4 py-2 rounded-lg transition-colors
                      disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {vinculando[item.codigo]
                      ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : '🔗'
                    }
                    Vincular
                  </button>
                </div>
              )}

              {/* Pergunta sobre preço de venda */}
              {jaVinculou && !decidiu && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 flex
                  flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-xs text-blue-700">
                    Deseja atualizar o <strong>preço de venda</strong> de{' '}
                    <strong>{vinculo.produto.name}</strong>?{' '}
                    Novo custo: <strong>R$ {custoNota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    {vinculo.produto.price != null && (
                      <> · Venda atual: <strong>R$ {vinculo.produto.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></>
                    )}
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleDecidirPrecoVenda(item.codigo, true)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      Sim, atualizar
                    </button>
                    <button
                      onClick={() => handleDecidirPrecoVenda(item.codigo, false)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      Não
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmação da decisão */}
              {jaVinculou && decidiu && (
                <p className="text-xs text-gray-400">
                  {vinculo.atualizarPrecoVenda
                    ? '✓ Preço de venda será atualizado ao confirmar.'
                    : '✓ Preço de venda mantido.'}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer — botão confirmar entrada */}
      <div className={`px-4 py-3 border-t flex items-center justify-between gap-3
        ${prontoParaConfirmar ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
        <p className="text-xs text-gray-500">
          {prontoParaConfirmar
            ? 'Tudo pronto! Clique em confirmar para registrar a entrada no sistema.'
            : `Vincule todos os itens para liberar a confirmação. (${
                itensPendentes.filter(i => vinculados[i.codigo] !== undefined).length
              }/${itensPendentes.length} vinculados)`
          }
        </p>
        <button
          onClick={handleConfirmarEntrada}
          disabled={!prontoParaConfirmar || confirmando}
          className="shrink-0 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white
            text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {confirmando
            ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : '✓'
          }
          {confirmando ? 'Confirmando…' : 'Confirmar entrada'}
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────

export function NfEntradaTab({ companyId, onError }: Props) {
  const [notas, setNotas]         = useState<NfEntrada[]>([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ importados: number; erros: number } | null>(null)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<NfEntrada['status'] | 'todas'>('todas')
  const [cfg, setCfg]             = useState<{ cpf?: string | null } | null>(null)

  const [notasParaVincular, setNotasParaVincular] = useState<NfEntrada[]>([])
  const [cardsDescartados, setCardsDescartados]   = useState<Set<string>>(new Set())

  const xmlInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase
      .from('fiscal_config')
      .select('cpf')
      .eq('company_id', companyId)
      .single()
      .then(({ data }) => setCfg(data))
  }, [companyId])

  const loadNotas = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('nf_entrada')
        .select('*')
        .eq('company_id', companyId)
        .order('data_emissao', { ascending: false })
      if (error) throw error

      const lista = data ?? []
      setNotas(lista)

      const comItensPendentes = lista.filter(
        n =>
          n.status === 'pendente' &&
          Array.isArray(n.itens_nota) &&
          n.itens_nota.some((i: any) => i.produto_id === null)
      )

      if (comItensPendentes.length > 0) {
        setNotasParaVincular(prev => {
          const mapa = new Map(prev.map(n => [n.chave, n]))
          comItensPendentes.forEach(n => mapa.set(n.chave, n))
          return Array.from(mapa.values())
        })
        setCardsDescartados(prev => {
          const next = new Set(prev)
          comItensPendentes.forEach(n => next.delete(n.chave))
          return next
        })
      }
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { loadNotas() }, [loadNotas])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/fiscal/nf-entrada/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message ?? 'Erro ao consultar SEFAZ')
      }
      await loadNotas()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setSyncing(false)
    }
  }

  const handleImportXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    setImporting(true)
    setImportResult(null)
    let importados = 0
    let erros = 0
    const novasNotasParaVincular: NfEntrada[] = []

    for (const file of files) {
      try {
        const xmlContent = await file.text()
        const res = await fetch('/api/fiscal/nf-entrada/import-xml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, xmlContent }),
        })
        if (!res.ok) {
          const err = await res.json()
          console.error(`Erro em ${file.name}:`, err.message)
          erros++
        } else {
          const result = await res.json()
          importados++
          if (result.nao_encontrados?.length > 0) {
            novasNotasParaVincular.push({
              ...result.nota,
              itens_nota: result.nao_encontrados.map((i: any) => ({
                ...i,
                produto_id:   null,
                produto_nome: null,
              })),
            })
          }
        }
      } catch {
        erros++
      }
    }

    if (xmlInputRef.current) xmlInputRef.current.value = ''
    setImportResult({ importados, erros })
    if (erros > 0 && importados === 0) {
      onError(`Nenhuma nota importada. ${erros} arquivo(s) com erro.`)
    }

    await loadNotas()

    if (novasNotasParaVincular.length > 0) {
      setNotasParaVincular(prev => {
        const existentes = new Set(prev.map(n => n.chave))
        return [...prev, ...novasNotasParaVincular.filter(n => !existentes.has(n.chave))]
      })
    }

    setImporting(false)
  }

  const handleManifestar = async (chave: string, evento: Evento) => {
    const confirmMsg = CONFIRM_MESSAGES[evento]
    if (confirmMsg && !window.confirm(`${confirmMsg} Esta ação pode ser desfeita reabrindo a nota.`)) {
      return
    }
    try {
      const res = await fetch('/api/fiscal/nf-entrada/manifestar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, chave, evento }),
      })
      if (!res.ok) throw new Error('Erro ao manifestar')
      await loadNotas()
    } catch (e: any) {
      onError(e.message)
    }
  }

  const handleDismissCard = (chave: string) => {
    setCardsDescartados(prev => new Set([...prev, chave]))
  }

  const handleConfirmado = (chave: string) => {
    // Remove o card e recarrega a lista
    setCardsDescartados(prev => new Set([...prev, chave]))
    loadNotas()
  }

  const cardsVisiveis = notasParaVincular.filter(n => !cardsDescartados.has(n.chave))

  const filtered = notas.filter(n => {
    const matchStatus = statusFilter === 'todas' || n.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      n.emitente_razao.toLowerCase().includes(q) ||
      n.emitente_cnpj.includes(q) ||
      n.numero.includes(q) ||
      n.chave.includes(q)
    return matchStatus && matchSearch
  })

  const totalValor = filtered.reduce((s, n) => s + n.valor_total, 0)

  return (
    <div className="space-y-5">

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Entrada de Nota Fiscal</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Notas fiscais recebidas (NF-e / NFC-e) destinadas à empresa
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cfg?.cpf && (
            <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full px-3 py-0.5">
              🧪 Modo teste — consultando por CPF
            </span>
          )}

          <label className={`flex items-center gap-2 border border-gray-200 text-gray-600
            bg-white hover:bg-gray-50 text-sm px-4 py-2 rounded-lg transition-colors
            cursor-pointer select-none ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
            {importing
              ? <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              : '📂'
            }
            {importing ? 'Importando…' : 'Importar XML'}
            <input
              ref={xmlInputRef}
              type="file"
              accept=".xml"
              multiple
              className="hidden"
              onChange={handleImportXml}
            />
          </label>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white
              text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {syncing
              ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : '🔄'
            }
            {syncing ? 'Consultando SEFAZ…' : 'Consultar SEFAZ'}
          </button>
        </div>
      </div>

      {/* Cards de vinculação */}
      {cardsVisiveis.map(nota => (
        <VincularItensCard
          key={nota.chave}
          companyId={companyId}
          nota={nota}
          onConfirmado={() => handleConfirmado(nota.chave)}
          onDismiss={() => handleDismissCard(nota.chave)}
        />
      ))}

      {/* Resultado da importação */}
      {importResult && (
        <div className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm
          ${importResult.erros > 0 && importResult.importados === 0
            ? 'bg-red-50 border border-red-100 text-red-700'
            : importResult.erros > 0
            ? 'bg-yellow-50 border border-yellow-100 text-yellow-700'
            : 'bg-green-50 border border-green-100 text-green-700'
          }`}>
          <span>
            {importResult.importados > 0 && (
              <>{importResult.importados} nota{importResult.importados !== 1 ? 's' : ''} importada{importResult.importados !== 1 ? 's' : ''} com sucesso{importResult.erros > 0 ? ` — ` : '.'}</>
            )}
            {importResult.erros > 0 && (
              <>{importResult.erros} arquivo{importResult.erros !== 1 ? 's' : ''} com erro.</>
            )}
          </span>
          <button
            onClick={() => setImportResult(null)}
            className="text-xs opacity-60 hover:opacity-100 transition-opacity"
          >✕</button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Buscar por emitente, CNPJ, número ou chave…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value as any)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-200"
        >
          <option value="todas">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="confirmada">Confirmada</option>
          <option value="cancelada">Cancelada</option>
          <option value="recusada">Recusada</option>
        </select>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: 'Total encontradas', value: notas.length,                                              color: 'text-gray-700' },
          { label: 'Pendentes',         value: notas.filter(n => n.status === 'pendente').length,         color: 'text-yellow-600' },
          { label: 'Confirmadas',       value: notas.filter(n => n.status === 'confirmada').length,       color: 'text-green-600' },
          { label: 'Valor filtrado',    value: `R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'text-blue-600' },
        ] as const).map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400">{card.label}</p>
            <p className={`text-xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16
          flex flex-col items-center gap-3 text-gray-400">
          <span className="text-4xl">📥</span>
          <p className="text-sm font-medium">Nenhuma nota encontrada</p>
          <p className="text-xs text-center">
            Clique em "Consultar SEFAZ" para buscar notas destinadas à empresa,
            ou em "Importar XML" para carregar arquivos manualmente
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">NF / Série</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Emitente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Emissão</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(nota => (
                  <tr key={nota.chave} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">Nº {nota.numero} / {nota.serie}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-40" title={nota.chave}>
                        {nota.chave}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-50">{nota.emitente_razao}</p>
                      <p className="text-xs text-gray-400">
                        {nota.emitente_cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(nota.data_emissao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">
                      R$ {nota.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[nota.status]}`}>
                        {STATUS_LABEL[nota.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {nota.status === 'pendente' && (
                          <>
                            <button onClick={() => handleManifestar(nota.chave, 'ciencia')}
                              className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            >Ciência</button>
                            <button onClick={() => handleManifestar(nota.chave, 'confirmacao')}
                              className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                            >Confirmar</button>
                            <button onClick={() => handleManifestar(nota.chave, 'recusa')}
                              className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >Recusar</button>
                            <button onClick={() => handleManifestar(nota.chave, 'cancelamento')}
                              className="text-xs px-2 py-1 rounded bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                            >Cancelar</button>
                          </>
                        )}
                        {nota.status === 'confirmada' && (
                          <button onClick={() => handleManifestar(nota.chave, 'cancelamento')}
                            className="text-xs px-2 py-1 rounded bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                          >Cancelar</button>
                        )}
                        {(nota.status === 'recusada' || nota.status === 'cancelada') && (
                          <button onClick={() => handleManifestar(nota.chave, 'reabrir')}
                            className="text-xs px-2 py-1 rounded bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors"
                          >Reabrir</button>
                        )}
                        {nota.xml_url && (
                          <a href={nota.xml_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          >XML</a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-50 px-4 py-2.5 text-xs text-gray-400">
            {filtered.length} nota{filtered.length !== 1 ? 's' : ''} exibida{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}