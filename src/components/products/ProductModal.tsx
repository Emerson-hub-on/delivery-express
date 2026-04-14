'use client'
import { useEffect, useMemo, useState } from 'react'
import { Product } from '@/types/product'
import { AddonGroup, AddonItem, CartAddon } from '@/types/addon'
import { getAddonGroupsByProduct, calcAddonItemPrice } from '@/services/addons'
import { useCartStore } from '@/stores/cart-store'
import { toast } from 'sonner'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Props {
  product: Product
  onClose: () => void
}

export function ProductModal({ product, onClose }: Props) {
  const { addToCart } = useCartStore()
  const [groups, setGroups] = useState<AddonGroup[]>([])
  const [loading, setLoading] = useState(true)

  // qty por addon item: { [itemId]: number }
  const [addonQtys, setAddonQtys] = useState<Record<string, number>>({})
  const [observation, setObservation] = useState('')
  const [qty, setQty] = useState(1)

  useEffect(() => {
    getAddonGroupsByProduct(product.id)
      .then(setGroups)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [product.id])

  // Valida grupos obrigatórios
  const groupErrors = useMemo(() => {
    const errors: Record<string, string> = {}
    groups.forEach(g => {
      if (g.min_select <= 0) return
      const selected = g.items.reduce((s, i) => s + (addonQtys[i.id] ?? 0), 0)
      if (selected < g.min_select) {
        errors[g.id] = `Escolha pelo menos ${g.min_select} ${g.min_select === 1 ? 'opção' : 'opções'}`
      }
    })
    return errors
  }, [groups, addonQtys])

  const canAdd = Object.keys(groupErrors).length === 0

  // Constrói CartAddon[] a partir das qtys selecionadas
  const selectedAddons = useMemo((): CartAddon[] => {
    const result: CartAddon[] = []
    groups.forEach(g => {
      g.items.forEach(item => {
        const q = addonQtys[item.id] ?? 0
        if (q <= 0) return
        const subtotal = calcAddonItemPrice(item, q)
        result.push({
          groupId: g.id,
          groupName: g.name,
          itemId: item.id,
          itemName: item.name,
          qty: q,
          unitPrice: subtotal / q,
          subtotal,
        })
      })
    })
    return result
  }, [groups, addonQtys])

  const addonsTotal = selectedAddons.reduce((s, a) => s + a.subtotal, 0)
  const unitTotal = product.price + addonsTotal
  const grandTotal = unitTotal * qty

  const handleChangeQty = (groupId: string, item: AddonItem, delta: number) => {
    const group = groups.find(g => g.id === groupId)!
    const current = addonQtys[item.id] ?? 0
    const next = Math.max(0, Math.min(item.max_qty, current + delta))

    // Verifica max_select do grupo
    if (delta > 0 && group.max_select !== null) {
      const groupTotal = group.items.reduce((s, i) => s + (addonQtys[i.id] ?? 0), 0)
      if (groupTotal >= group.max_select) return
    }

    setAddonQtys(prev => ({ ...prev, [item.id]: next }))
  }

  const handleAdd = () => {
    if (!canAdd) return
    addToCart(product, qty, selectedAddons, observation)
    toast.success('Adicionado ao carrinho!', { description: product.name })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Card */}
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Imagem + botão fechar */}
        <div className="relative shrink-0">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-48 object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Conteúdo scrollável */}
        <div className="overflow-y-auto flex-1">
          {/* Nome e preço base */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
            {product.description && (
              <p className="text-sm text-gray-500 mt-1">{product.description}</p>
            )}
            <p className="text-base font-medium text-gray-800 mt-2">{fmtBRL(product.price)}</p>
          </div>

          {loading && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Carregando opções...</div>
          )}

          {/* Grupos de adicionais */}
          {!loading && groups.map(group => {
            const groupSelected = group.items.reduce((s, i) => s + (addonQtys[i.id] ?? 0), 0)
            const hasError = !!groupErrors[group.id]

            return (
              <div key={group.id} className="border-b border-gray-100">
                {/* Cabeçalho do grupo */}
                <div className="px-5 py-3 bg-gray-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{group.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {group.min_select > 0 ? (
                        <span className={hasError ? 'text-red-500' : 'text-gray-400'}>
                          Obrigatório · {group.min_select === group.max_select
                            ? `Escolha ${group.min_select}`
                            : group.max_select
                              ? `${group.min_select} a ${group.max_select} opções`
                              : `Mínimo ${group.min_select}`}
                        </span>
                      ) : (
                        <span>
                          Opcional{group.max_select ? ` · até ${group.max_select}` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                  {group.max_select && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                      ${groupSelected >= (group.max_select ?? 0)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'}`}>
                      {groupSelected}/{group.max_select}
                    </span>
                  )}
                </div>

                {/* Itens do grupo */}
                {group.items.map(item => {
                  const currentQty = addonQtys[item.id] ?? 0
                  const atMax = currentQty >= item.max_qty
                  const groupAtMax = group.max_select !== null && groupSelected >= group.max_select

                  // Label de preço
                  const priceLabel = (() => {
                    if (item.price === 0 && !item.price_after) return 'Grátis'
                    if (item.price === 0 && item.price_after) {
                      return `Grátis · a partir do ${item.price_from_qty}º: ${fmtBRL(item.price_after)}`
                    }
                    if (item.price_after && item.price_after !== item.price) {
                      return `${fmtBRL(item.price)} · a partir do ${item.price_from_qty}º: ${fmtBRL(item.price_after)}`
                    }
                    return fmtBRL(item.price)
                  })()

                  return (
                    <div key={item.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                      <div className="min-w-0 mr-4">
                        <p className="text-sm text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{priceLabel}</p>
                      </div>

                      {/* Controle de quantidade */}
                      <div className="flex items-center gap-3 shrink-0">
                        {currentQty > 0 ? (
                          <>
                            <button
                              onClick={() => handleChangeQty(group.id, item, -1)}
                              className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="5" y1="12" x2="19" y2="12"/>
                              </svg>
                            </button>
                            <span className="text-sm font-semibold w-4 text-center">{currentQty}</span>
                            <button
                              onClick={() => handleChangeQty(group.id, item, 1)}
                              disabled={atMax || groupAtMax}
                              className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                              </svg>
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleChangeQty(group.id, item, 1)}
                            disabled={groupAtMax}
                            className="w-7 h-7 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 hover:border-gray-900 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Erro de validação */}
                {hasError && (
                  <p className="px-5 pb-3 text-xs text-red-500">{groupErrors[group.id]}</p>
                )}
              </div>
            )
          })}

          {/* Observação */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800 mb-2">Alguma observação?</p>
            <textarea
              rows={2}
              placeholder="Ex: sem cebola, ponto da carne bem passado..."
              value={observation}
              onChange={e => setObservation(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
            />
          </div>
        </div>

        {/* Footer fixo — quantidade + botão */}
        <div className="shrink-0 px-5 py-4 bg-white border-t border-gray-100 flex items-center gap-4">
          {/* Seletor de quantidade do produto */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <span className="text-base font-semibold w-5 text-center">{qty}</span>
            <button
              onClick={() => setQty(q => q + 1)}
              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>

          {/* Botão adicionar */}
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="flex-1 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-between px-4"
          >
            <span>Adicionar</span>
            <span>{fmtBRL(grandTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
