'use client'
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  type NfEntrada,
  type ItemEntrada,
  type ProdutoBusca,
  type ItemVinculado,
} from './types'

export function VincularItensCard({
  companyId,
  nota,
  onConfirmado,
  onDismiss,
  onError,
}: {
  companyId: string
  nota: NfEntrada
  onConfirmado: () => void
  onDismiss: () => void
  onError: (msg: string) => void
}) {
  const [itensPendentes, setItensPendentes] = useState<ItemEntrada[]>([])
  const [loadingItens,   setLoadingItens]   = useState(true)

  // ── Carrega itens sem vínculo da tabela relacional ─────────
  useEffect(() => {
    if (!nota.id) return
    supabase
      .from('nf_entrada_itens')
      .select('*')
      .eq('nf_entrada_id', nota.id)
      .is('produto_id', null)
      .order('id')
      .then(({ data, error }) => {
        if (error) onError(error.message)
        setItensPendentes((data ?? []) as ItemEntrada[])
        setLoadingItens(false)
      })
  }, [nota.id])

  const [itemSelecionado, setItemSelecionado] = useState<string | null>(null)

  // Inicializa item selecionado quando os itens carregam
  useEffect(() => {
    if (itensPendentes.length > 0 && !itemSelecionado) {
      setItemSelecionado(itensPendentes[0].id)
    }
  }, [itensPendentes])

  const [buscas,          setBuscas]          = useState<Record<string, string>>({})
  const [resultados,      setResultados]      = useState<Record<string, ProdutoBusca[]>>({})
  const [dropdownAberto,  setDropdownAberto]  = useState<string | null>(null)
  const [vinculados,      setVinculados]      = useState<Record<string, ItemVinculado>>({})
  const [vinculando,      setVinculando]      = useState<Record<string, boolean>>({})
  const [confirmando,     setConfirmando]     = useState(false)
  const [timers,          setTimers]          = useState<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── Busca de produtos ──────────────────────────────────────

  const buscarProdutos = useCallback(async (itemId: string, termo: string) => {
    if (!termo || termo.length < 2) {
      setResultados(r => ({ ...r, [itemId]: [] }))
      return
    }
    const { data } = await supabase
      .from('products')
      .select('id, name, ean, code, price, cost_price, stock, fator_conversao, unidade_estoque')
      .eq('company_id', companyId)
      .eq('active', true)
      .or(`name.ilike.%${termo}%,ean.ilike.%${termo}%`)
      .limit(6)
    setResultados(r => ({ ...r, [itemId]: (data ?? []) as ProdutoBusca[] }))
  }, [companyId])

  const handleBusca = (itemId: string, valor: string) => {
    setBuscas(b => ({ ...b, [itemId]: valor }))
    setDropdownAberto(itemId)
    if (timers[itemId]) clearTimeout(timers[itemId])
    const t = setTimeout(() => buscarProdutos(itemId, valor), 300)
    setTimers(prev => ({ ...prev, [itemId]: t }))
  }

  const handleSelecionarProduto = (item: ItemEntrada, produto: ProdutoBusca) => {
    setBuscas(b => ({ ...b, [item.id]: produto.name }))
    setResultados(r => ({ ...r, [item.id]: [produto] }))
    setDropdownAberto(null)
  }

  // ── Vínculo ────────────────────────────────────────────────

  const handleVincular = async (item: ItemEntrada) => {
    const lista = resultados[item.id] ?? []
    if (lista.length === 0) return
    const produto = lista[0]

    setVinculando(v => ({ ...v, [item.id]: true }))
    try {
      const res = await fetch('/api/fiscal/nf-entrada/vincular-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          chave:      nota.chave,
          itemId:     item.id,       // id da tabela relacional
          itemCodigo: item.codigo,   // mantém compatibilidade
          produtoId:  produto.id,
        }),
      })
      if (!res.ok) throw new Error('Erro ao vincular')

      const { produto: produtoAtualizado } = await res.json() as { produto: ProdutoBusca }
      const prod = produtoAtualizado ?? produto

      setVinculados(v => ({
        ...v,
        [item.id]: {
          produto:             prod,
          atualizarPrecoVenda: null,
          novoPrecoVenda:      '',
          fatorConversao:      prod.fator_conversao ?? 1,
          fatorAlterado:       false,
        },
      }))
      setDropdownAberto(null)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao vincular')
    } finally {
      setVinculando(v => ({ ...v, [item.id]: false }))
    }
  }

  // ── Handlers de estado ─────────────────────────────────────

  const handleFatorConversao = (itemId: string, valor: string) => {
    const num = parseInt(valor, 10)
    setVinculados(v => ({
      ...v,
      [itemId]: {
        ...v[itemId],
        fatorConversao: isNaN(num) || num < 1 ? 1 : num,
        fatorAlterado:  true,
      },
    }))
  }

  const handleDecidirPrecoVenda = (itemId: string, atualizar: boolean) => {
    setVinculados(v => ({
      ...v,
      [itemId]: {
        ...v[itemId],
        atualizarPrecoVenda: atualizar,
        novoPrecoVenda: atualizar ? String(v[itemId].produto.price ?? '') : '',
      },
    }))
  }

  const handleNovoPreco = (itemId: string, valor: string) => {
    setVinculados(v => ({ ...v, [itemId]: { ...v[itemId], novoPrecoVenda: valor } }))
  }

  // ── Helpers ────────────────────────────────────────────────

  const itemEstaCompleto = (itemId: string): boolean => {
    const v = vinculados[itemId]
    if (!v || v.atualizarPrecoVenda === null) return false
    if (v.atualizarPrecoVenda === true) {
      const preco = parseFloat(v.novoPrecoVenda.replace(',', '.'))
      return !isNaN(preco) && preco > 0
    }
    return true
  }

  const proximoItemPendente = (): string | null => {
    if (!itemSelecionado) return null
    const idx = itensPendentes.findIndex(i => i.id === itemSelecionado)
    for (let i = idx + 1; i < itensPendentes.length; i++) {
      if (!itemEstaCompleto(itensPendentes[i].id)) return itensPendentes[i].id
    }
    return null
  }

  const handleAvancar = () => {
    const prox = proximoItemPendente()
    if (prox) setItemSelecionado(prox)
  }

  // ── Validação do footer ────────────────────────────────────

  const todosVinculados     = itensPendentes.every(i => vinculados[i.id] !== undefined)
  const todosDecididos      = itensPendentes.every(i => itemEstaCompleto(i.id))
  const prontoParaConfirmar = todosVinculados && todosDecididos

  // ── Confirmação final ──────────────────────────────────────

  const handleConfirmarEntrada = async () => {
    setConfirmando(true)
    try {
      const atualizacoes = itensPendentes
        .filter(i => vinculados[i.id]?.atualizarPrecoVenda === true)
        .map(i => ({
          produtoId:      vinculados[i.id].produto.id,
          novoPrecoVenda: parseFloat(vinculados[i.id].novoPrecoVenda.replace(',', '.')),
        }))

      const fatores = itensPendentes.map(i => ({
        itemId:         i.id,       // usa id da tabela relacional
        itemCodigo:     i.codigo,   // mantém compatibilidade com a rota confirmar-entrada
        fatorConversao: vinculados[i.id]?.fatorConversao ?? 1,
      }))

      const res = await fetch('/api/fiscal/nf-entrada/confirmar-entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, chave: nota.chave, atualizacoes, fatores }),
      })
      if (!res.ok) throw new Error('Erro ao confirmar entrada')
      onConfirmado()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao confirmar entrada')
    } finally {
      setConfirmando(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────

  if (loadingItens) {
    return (
      <div className="bg-white border border-orange-200 rounded-xl shadow-sm p-6 flex items-center justify-center gap-3">
        <span className="inline-block w-5 h-5 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
        <span className="text-sm text-orange-600">Carregando itens…</span>
      </div>
    )
  }

  if (itensPendentes.length === 0) return null

  const itemAtivo   = itensPendentes.find(i => i.id === itemSelecionado)
  const vinculoAtivo = itemAtivo ? vinculados[itemAtivo.id] : undefined

  // ── Painel de configuração ─────────────────────────────────

  const renderPainelConfiguracao = () => {
    if (!itemAtivo) return null

    const jaVinculou     = vinculoAtivo !== undefined
    const unidadeEstoque = vinculoAtivo?.produto.unidade_estoque ?? 'UN'
    const fator          = vinculoAtivo?.fatorConversao ?? 1
    const qtdReal        = itemAtivo.quantidade * fator

    return (
      <div className="border-b border-orange-100 bg-orange-50/40">

        {/* Cabeçalho do item selecionado */}
        <div className="px-4 pt-3 pb-2">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">
            Configurando item
          </p>
          <p className="text-sm font-semibold text-gray-800 break-words">{itemAtivo.descricao}</p>
          <p className="text-xs text-gray-400 mt-0.5 break-all">
            Código: {itemAtivo.codigo}
            {itemAtivo.ean ? ` · EAN: ${itemAtivo.ean}` : ''}
            {' · '}{itemAtivo.quantidade} {itemAtivo.unidade}
            {' · '}R$ {itemAtivo.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Busca + botão Vincular */}
        {!jaVinculou && (
          <div className="px-4 pb-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Buscar produto por nome ou EAN…"
                  value={buscas[itemAtivo.id] ?? ''}
                  onChange={e => handleBusca(itemAtivo.id, e.target.value)}
                  onFocus={() => {
                    if ((resultados[itemAtivo.id] ?? []).length > 0)
                      setDropdownAberto(itemAtivo.id)
                  }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                    focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
                {dropdownAberto === itemAtivo.id && (resultados[itemAtivo.id] ?? []).length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {resultados[itemAtivo.id].map((produto: ProdutoBusca) => (
                      <button
                        key={produto.id}
                        onMouseDown={() => handleSelecionarProduto(itemAtivo, produto)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-orange-50 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{produto.name}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {produto.ean ? `EAN: ${produto.ean} · ` : ''}
                            Cód: {produto.code}
                            {produto.stock != null ? ` · Estoque: ${produto.stock}` : ''}
                            {produto.cost_price != null
                              ? ` · Custo: R$ ${produto.cost_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              : ''}
                            {produto.fator_conversao && produto.fator_conversao > 1
                              ? ` · 1 ${produto.unidade_estoque ?? 'CX'} = ${produto.fator_conversao} UN`
                              : ''}
                          </p>
                        </div>
                        <span className="text-xs text-orange-500 ml-3 shrink-0">Selecionar</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleVincular(itemAtivo)}
                disabled={!buscas[itemAtivo.id] || (resultados[itemAtivo.id] ?? []).length === 0 || vinculando[itemAtivo.id]}
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5
                  bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {vinculando[itemAtivo.id]
                  ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : '🔗'
                }
                Vincular
              </button>
            </div>
          </div>
        )}

        {/* Painel de conversão + preço (após vínculo) */}
        {jaVinculou && vinculoAtivo && (
          <div className="px-4 pb-3 space-y-3">

            <div className="bg-white border border-amber-200 rounded-lg px-3 py-2.5 space-y-2">
              <p className="text-xs font-semibold text-amber-800">📦 Quantidade no estoque</p>
              <div className="grid grid-cols-5 gap-2 items-end">

                <div className="space-y-1">
                  <label className="text-[10px] text-amber-700 font-medium uppercase tracking-wide">
                    Qtd nota ({itemAtivo.unidade})
                  </label>
                  <div className="text-sm font-semibold text-amber-900 border border-amber-200 rounded-lg px-2 py-1.5 bg-amber-50 text-center">
                    {itemAtivo.quantidade}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-amber-700 font-medium uppercase tracking-wide">
                    Por {itemAtivo.unidade}
                  </label>
                  <input
                    type="number" min="1" step="1" value={fator}
                    onChange={e => handleFatorConversao(itemAtivo.id, e.target.value)}
                    className="w-full text-sm border border-amber-300 rounded-lg px-2 py-1.5 text-center
                      focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-amber-700 font-medium uppercase tracking-wide">
                    Qtd {unidadeEstoque}
                  </label>
                  <div className="text-sm font-bold text-green-700 border border-green-200 rounded-lg px-2 py-1.5 bg-green-50 text-center">
                    {qtdReal}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Preço custo</label>
                  <div className="text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-center">
                    {vinculoAtivo.produto.cost_price != null
                      ? `R$ ${vinculoAtivo.produto.cost_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Preço de venda</label>
                  {vinculoAtivo.atualizarPrecoVenda === true ? (
                    <input
                      type="number" min="0.01" step="0.01"
                      value={vinculoAtivo.novoPrecoVenda}
                      onChange={e => handleNovoPreco(itemAtivo.id, e.target.value)}
                      placeholder="0,00"
                      className="w-full text-sm border border-blue-300 rounded-lg px-2 py-1.5 text-center
                        focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white font-semibold"
                    />
                  ) : (
                    <div className="text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-center">
                      {vinculoAtivo.produto.price != null
                        ? `R$ ${vinculoAtivo.produto.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-amber-600">
                {fator === 1
                  ? `Sem conversão — ${itemAtivo.quantidade} ${itemAtivo.unidade} entrará diretamente no estoque.`
                  : `${itemAtivo.quantidade} ${itemAtivo.unidade} × ${fator} = ${qtdReal} ${unidadeEstoque} entrarão no estoque.`}
              </p>
            </div>

            {vinculoAtivo.atualizarPrecoVenda === null && (
              <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <p className="text-xs text-blue-700">
                  Atualizar <strong>preço de venda</strong> de <strong>{vinculoAtivo.produto.name}</strong>?
                  {vinculoAtivo.produto.price != null && (
                    <> Atual: <strong>R$ {vinculoAtivo.produto.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></>
                  )}
                </p>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleDecidirPrecoVenda(itemAtivo.id, true)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                    Sim
                  </button>
                  <button onClick={() => handleDecidirPrecoVenda(itemAtivo.id, false)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                    Não
                  </button>
                </div>
              </div>
            )}

            {vinculoAtivo.atualizarPrecoVenda === true && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-blue-600">Digite o novo preço de venda no campo acima.</p>
                <button onClick={() => handleDecidirPrecoVenda(itemAtivo.id, false)}
                  className="text-xs px-2 py-1 rounded-lg bg-white border border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors whitespace-nowrap">
                  Manter atual
                </button>
              </div>
            )}

            {itemEstaCompleto(itemAtivo.id) && (
              <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-xs text-green-700 font-medium">
                  ✓ Item configurado com sucesso!
                  {proximoItemPendente() && ' Selecione o próximo item para configurar.'}
                </p>
                {proximoItemPendente() && (
                  <button onClick={handleAvancar}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors whitespace-nowrap shrink-0">
                    Próximo →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="bg-white border border-orange-200 rounded-xl shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 bg-orange-50 border-b border-orange-100 gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-lg shrink-0 mt-0.5">🔗</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-orange-800 leading-snug">
              Produtos não identificados — {nota.emitente_razao}
            </p>
            <p className="text-xs text-orange-600 mt-0.5">
              {itensPendentes.length} item{itensPendentes.length !== 1 ? 'ns' : ''} da nota não foram encontrados no cadastro.
              Clique em cada item e configure o vínculo.
            </p>
          </div>
        </div>
        <button onClick={onDismiss}
          className="text-orange-400 hover:text-orange-600 transition-colors text-lg leading-none shrink-0">
          ✕
        </button>
      </div>

      {/* Painel de configuração fixo */}
      {renderPainelConfiguracao()}

      {/* Lista de itens */}
      <div className="divide-y divide-gray-50">
        {itensPendentes.map((item, idx) => {
          const completo    = itemEstaCompleto(item.id)
          const selecionado = item.id === itemSelecionado
          const vinculo     = vinculados[item.id]

          return (
            <button
              key={item.id}
              onClick={() => setItemSelecionado(item.id)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors
                ${selecionado
                  ? 'bg-orange-50 border-l-2 border-orange-400'
                  : 'hover:bg-gray-50 border-l-2 border-transparent'
                }`}
            >
              <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold
                ${completo ? 'bg-green-100 text-green-700' : selecionado ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                {completo ? '✓' : idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${selecionado ? 'text-orange-800' : 'text-gray-800'}`}>
                  {item.descricao}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {item.quantidade} {item.unidade}
                  {' · '}R$ {item.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  {vinculo && ` · → ${vinculo.produto.name}`}
                </p>
              </div>
              <div className="shrink-0">
                {completo ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Pronto</span>
                ) : vinculo ? (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Vinculado</span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Pendente</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className={`px-4 py-3 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3
        ${prontoParaConfirmar ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
        <p className="text-xs text-gray-500">
          {prontoParaConfirmar
            ? 'Tudo pronto! Clique em confirmar para registrar a entrada no sistema.'
            : `Configure todos os itens para liberar a confirmação. (${
                itensPendentes.filter(i => itemEstaCompleto(i.id)).length
              }/${itensPendentes.length} prontos)`
          }
        </p>
        <button
          onClick={handleConfirmarEntrada}
          disabled={!prontoParaConfirmar || confirmando}
          className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2
            bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg
            transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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