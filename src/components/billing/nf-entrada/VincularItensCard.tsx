'use client'
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  type NfEntrada,
  type ItemNota,
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
  const itensPendentes = (nota.itens_nota ?? []).filter(i => i.produto_id === null)

  const [itemSelecionado, setItemSelecionado] = useState<string | null>(
    itensPendentes[0]?.codigo ?? null
  )
  const [buscas, setBuscas]                 = useState<Record<string, string>>({})
  const [resultados, setResultados]         = useState<Record<string, ProdutoBusca[]>>({})
  const [dropdownAberto, setDropdownAberto] = useState<string | null>(null)
  const [vinculados, setVinculados]         = useState<Record<string, ItemVinculado>>({})
  const [vinculando, setVinculando]         = useState<Record<string, boolean>>({})
  const [confirmando, setConfirmando]       = useState(false)
  const [timers, setTimers]                 = useState<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── Busca de produtos ──────────────────────────────────────

  const buscarProdutos = useCallback(async (codigo: string, termo: string) => {
    if (!termo || termo.length < 2) {
      setResultados(r => ({ ...r, [codigo]: [] }))
      return
    }
    const { data } = await supabase
      .from('products')
      .select('id, name, ean, code, price, cost_price, stock, fator_conversao, unidade_estoque')
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

  const handleSelecionarProduto = (item: ItemNota, produto: ProdutoBusca) => {
    setBuscas(b => ({ ...b, [item.codigo]: produto.name }))
    setResultados(r => ({ ...r, [item.codigo]: [produto] }))
    setDropdownAberto(null)
  }

  // ── Vínculo ────────────────────────────────────────────────

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

      const { produto: produtoAtualizado } = await res.json() as { produto: ProdutoBusca }
      const prod = produtoAtualizado ?? produto

      setVinculados(v => ({
        ...v,
        [item.codigo]: {
          produto: prod,
          atualizarPrecoVenda: null,
          novoPrecoVenda: '',
          fatorConversao: prod.fator_conversao ?? 1,
          fatorAlterado: false,
        },
      }))
      setDropdownAberto(null)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Erro ao vincular')
    } finally {
      setVinculando(v => ({ ...v, [item.codigo]: false }))
    }
  }

  // ── Handlers de estado ─────────────────────────────────────

  const handleFatorConversao = (codigo: string, valor: string) => {
    const num = parseInt(valor, 10)
    setVinculados(v => ({
      ...v,
      [codigo]: {
        ...v[codigo],
        fatorConversao: isNaN(num) || num < 1 ? 1 : num,
        fatorAlterado: true,
      },
    }))
  }

  const handleDecidirPrecoVenda = (codigo: string, atualizar: boolean) => {
    setVinculados(v => ({
      ...v,
      [codigo]: {
        ...v[codigo],
        atualizarPrecoVenda: atualizar,
        novoPrecoVenda: atualizar ? String(v[codigo].produto.price ?? '') : '',
      },
    }))
  }

  const handleNovoPreco = (codigo: string, valor: string) => {
    setVinculados(v => ({ ...v, [codigo]: { ...v[codigo], novoPrecoVenda: valor } }))
  }

  // ── Helpers ────────────────────────────────────────────────

  const itemEstaCompleto = (codigo: string): boolean => {
    const v = vinculados[codigo]
    if (!v || v.atualizarPrecoVenda === null) return false
    if (v.atualizarPrecoVenda === true) {
      const preco = parseFloat(v.novoPrecoVenda.replace(',', '.'))
      return !isNaN(preco) && preco > 0
    }
    return true
  }

  const proximoItemPendente = (): string | null => {
    if (!itemSelecionado) return null
    const idx = itensPendentes.findIndex(i => i.codigo === itemSelecionado)
    for (let i = idx + 1; i < itensPendentes.length; i++) {
      if (!itemEstaCompleto(itensPendentes[i].codigo)) return itensPendentes[i].codigo
    }
    return null
  }

  const handleAvancar = () => {
    const prox = proximoItemPendente()
    if (prox) setItemSelecionado(prox)
  }

  // ── Validação do footer ────────────────────────────────────

  const todosVinculados  = itensPendentes.every(i => vinculados[i.codigo] !== undefined)
  const todosDecididos   = itensPendentes.every(i => itemEstaCompleto(i.codigo))
  const prontoParaConfirmar = todosVinculados && todosDecididos

  // ── Confirmação final ──────────────────────────────────────

  const handleConfirmarEntrada = async () => {
    setConfirmando(true)
    try {
      const atualizacoes = itensPendentes
        .filter(i => vinculados[i.codigo]?.atualizarPrecoVenda === true)
        .map(i => ({
          produtoId:      vinculados[i.codigo].produto.id,
          novoPrecoVenda: parseFloat(vinculados[i.codigo].novoPrecoVenda.replace(',', '.')),
        }))

      const fatores = itensPendentes.map(i => ({
        itemCodigo:     i.codigo,
        fatorConversao: vinculados[i.codigo]?.fatorConversao ?? 1,
      }))

      const res = await fetch('/api/fiscal/nf-entrada/confirmar-entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, chave: nota.chave, atualizacoes, fatores }),
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

  const itemAtivo = itensPendentes.find(i => i.codigo === itemSelecionado)
  const vinculoAtivo = itemAtivo ? vinculados[itemAtivo.codigo] : undefined

  // ── Painel de configuração (dados do item ativo) ───────────

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
                  value={buscas[itemAtivo.codigo] ?? ''}
                  onChange={e => handleBusca(itemAtivo.codigo, e.target.value)}
                  onFocus={() => {
                    if ((resultados[itemAtivo.codigo] ?? []).length > 0)
                      setDropdownAberto(itemAtivo.codigo)
                  }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                    focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
                {dropdownAberto === itemAtivo.codigo && (resultados[itemAtivo.codigo] ?? []).length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200
                    rounded-lg shadow-lg overflow-hidden">
                    {resultados[itemAtivo.codigo].map((produto: ProdutoBusca) => (
                      <button
                        key={produto.id}
                        onMouseDown={() => handleSelecionarProduto(itemAtivo, produto)}
                        className="w-full flex items-center justify-between px-3 py-2.5
                          hover:bg-orange-50 transition-colors text-left"
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
                disabled={!buscas[itemAtivo.codigo] || (resultados[itemAtivo.codigo] ?? []).length === 0 || vinculando[itemAtivo.codigo]}
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5
                  bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {vinculando[itemAtivo.codigo]
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

            {/* Quantidade no estoque */}
            <div className="bg-white border border-amber-200 rounded-lg px-3 py-2.5 space-y-2">
              <p className="text-xs font-semibold text-amber-800">📦 Quantidade no estoque</p>
              <div className="grid grid-cols-5 gap-2 items-end">
                {/* Qtd nota */}
                <div className="space-y-1">
                  <label className="text-[10px] text-amber-700 font-medium uppercase tracking-wide">
                    Qtd nota ({itemAtivo.unidade})
                  </label>
                  <div className="text-sm font-semibold text-amber-900 border border-amber-200 rounded-lg px-2 py-1.5 bg-amber-50 text-center">
                    {itemAtivo.quantidade}
                  </div>
                </div>

                {/* Por embalagem */}
                <div className="space-y-1">
                  <label className="text-[10px] text-amber-700 font-medium uppercase tracking-wide">
                    Por {itemAtivo.unidade}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={fator}
                    onChange={e => handleFatorConversao(itemAtivo.codigo, e.target.value)}
                    className="w-full text-sm border border-amber-300 rounded-lg px-2 py-1.5 text-center
                      focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white font-semibold"
                  />
                </div>

                {/* Qtd estoque */}
                <div className="space-y-1">
                  <label className="text-[10px] text-amber-700 font-medium uppercase tracking-wide">
                    Qtd {unidadeEstoque}
                  </label>
                  <div className="text-sm font-bold text-green-700 border border-green-200 rounded-lg px-2 py-1.5 bg-green-50 text-center">
                    {qtdReal}
                  </div>
                </div>

                {/* Preço custo */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                    Preço custo
                  </label>
                  <div className="text-sm text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-center">
                    {vinculoAtivo.produto.cost_price != null
                      ? `R$ ${vinculoAtivo.produto.cost_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </div>
                </div>

                {/* Preço de venda */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                    Preço de venda
                  </label>
                  {vinculoAtivo.atualizarPrecoVenda === true ? (
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={vinculoAtivo.novoPrecoVenda}
                      onChange={e => handleNovoPreco(itemAtivo.codigo, e.target.value)}
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

            {/* Pergunta sobre preço de venda */}
            {vinculoAtivo.atualizarPrecoVenda === null && (
              <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <p className="text-xs text-blue-700">
                  Atualizar <strong>preço de venda</strong> de{' '}
                  <strong>{vinculoAtivo.produto.name}</strong>?
                  {vinculoAtivo.produto.price != null && (
                    <> Atual: <strong>
                      R$ {vinculoAtivo.produto.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong></>
                  )}
                </p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleDecidirPrecoVenda(itemAtivo.codigo, true)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >Sim</button>
                  <button
                    onClick={() => handleDecidirPrecoVenda(itemAtivo.codigo, false)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                  >Não</button>
                </div>
              </div>
            )}

            {/* Botão "cancelar novo preço" quando decidiu atualizar */}
            {vinculoAtivo.atualizarPrecoVenda === true && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-blue-600">
                  Digite o novo preço de venda no campo acima.
                </p>
                <button
                  onClick={() => handleDecidirPrecoVenda(itemAtivo.codigo, false)}
                  className="text-xs px-2 py-1 rounded-lg bg-white border border-blue-200 text-blue-500 hover:bg-blue-50 transition-colors whitespace-nowrap"
                >
                  Manter atual
                </button>
              </div>
            )}

            {/* Item configurado — botão avançar */}
            {itemEstaCompleto(itemAtivo.codigo) && (
              <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-xs text-green-700 font-medium">
                  ✓ Item configurado com sucesso!
                  {proximoItemPendente() && ' Selecione o próximo item para configurar.'}
                </p>
                {proximoItemPendente() && (
                  <button
                    onClick={handleAvancar}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors whitespace-nowrap shrink-0"
                  >
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
              {itensPendentes.length} item{itensPendentes.length !== 1 ? 'ns' : ''} da nota não
              foram encontrados no cadastro. Clique em cada item e configure o vínculo.
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-orange-400 hover:text-orange-600 transition-colors text-lg leading-none shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Painel de configuração fixo (item selecionado) */}
      {renderPainelConfiguracao()}

      {/* Lista de itens */}
      <div className="divide-y divide-gray-50">
        {itensPendentes.map((item, idx) => {
          const completo    = itemEstaCompleto(item.codigo)
          const selecionado = item.codigo === itemSelecionado
          const vinculo     = vinculados[item.codigo]

          return (
            <button
              key={item.codigo}
              onClick={() => setItemSelecionado(item.codigo)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors
                ${selecionado
                  ? 'bg-orange-50 border-l-2 border-orange-400'
                  : 'hover:bg-gray-50 border-l-2 border-transparent'
                }`}
            >
              {/* Índice / check */}
              <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold
                ${completo
                  ? 'bg-green-100 text-green-700'
                  : selecionado
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-500'
                }`}>
                {completo ? '✓' : idx + 1}
              </div>

              {/* Descrição */}
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

              {/* Badge de status */}
              <div className="shrink-0">
                {completo ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Pronto
                  </span>
                ) : vinculo ? (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    Vinculado
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    Pendente
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className={`px-4 py-3 border-t flex flex-col sm:flex-row items-start sm:items-center
        justify-between gap-3 ${prontoParaConfirmar ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
        <p className="text-xs text-gray-500">
          {prontoParaConfirmar
            ? 'Tudo pronto! Clique em confirmar para registrar a entrada no sistema.'
            : `Configure todos os itens para liberar a confirmação. (${
                itensPendentes.filter(i => itemEstaCompleto(i.codigo)).length
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