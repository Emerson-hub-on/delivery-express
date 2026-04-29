'use client'
import { useEffect, useState } from 'react'
import { AddonGroup, AddonItem } from '@/types/addon'
import {
  getAddonGroupsByProductAdmin,
  createAddonGroup, updateAddonGroup, deleteAddonGroup,
  createAddonItem, updateAddonItem, deleteAddonItem,
} from '@/services/addons'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black'

interface Props {
  productId: number
}

const EMPTY_ITEM = {
  name: '',
  price: 0,
  price_from_qty: 2,
  price_after: null as number | null,
  max_qty: 1,
  sort_order: 0,
}

export function AddonSection({ productId }: Props) {
  const [groups, setGroups] = useState<AddonGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [groupForm, setGroupForm] = useState({ name: '', min_select: 0, max_select: '' as string | number })
  const [savingGroup, setSavingGroup] = useState(false)
  const [editingItemGroupId, setEditingItemGroupId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)
  const [useProgressivePrice, setUseProgressivePrice] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!productId) return
    getAddonGroupsByProductAdmin(productId)
      .then(setGroups)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [productId])

  // ── Toggle ativo/inativo do item ──────────────────────────
  const handleToggleItem = async (groupId: string, item: AddonItem) => {
    try {
      setTogglingItemId(item.id)
      setError(null)
      await updateAddonItem(item.id, { active: !item.active })
      setGroups(prev => prev.map(g => g.id === groupId
        ? { ...g, items: g.items.map(i => i.id === item.id ? { ...i, active: !i.active } : i) }
        : g
      ))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setTogglingItemId(null)
    }
  }

  // ── Grupo ─────────────────────────────────────────────────
  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) return setError('Informe o nome do grupo.')
    try {
      setSavingGroup(true)
      setError(null)
      const max = groupForm.max_select === '' ? null : Number(groupForm.max_select)
      if (editingGroupId) {
        await updateAddonGroup(editingGroupId, {
          name: groupForm.name,
          min_select: Number(groupForm.min_select),
          max_select: max,
        })
        setGroups(prev => prev.map(g => g.id === editingGroupId
          ? { ...g, name: groupForm.name, min_select: Number(groupForm.min_select), max_select: max }
          : g
        ))
      } else {
        const created = await createAddonGroup(productId, {
          name: groupForm.name,
          min_select: Number(groupForm.min_select),
          max_select: max,
          sort_order: groups.length,
        })
        setGroups(prev => [...prev, created])
      }
      resetGroupForm()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingGroup(false)
    }
  }

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Excluir grupo e todos os seus itens?')) return
    try {
      await deleteAddonGroup(id)
      setGroups(prev => prev.filter(g => g.id !== id))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const resetGroupForm = () => {
    setShowGroupForm(false)
    setEditingGroupId(null)
    setGroupForm({ name: '', min_select: 0, max_select: '' })
  }

  const startEditGroup = (g: AddonGroup) => {
    setEditingGroupId(g.id)
    setGroupForm({ name: g.name, min_select: g.min_select, max_select: g.max_select ?? '' })
    setShowGroupForm(true)
  }

  // ── Item ──────────────────────────────────────────────────
  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) return setError('Informe o nome do adicional.')
    if (!editingItemGroupId) return
    try {
      setSavingItem(true)
      setError(null)
      const payload = {
        name: itemForm.name,
        price: Number(itemForm.price),
        price_from_qty: useProgressivePrice ? Number(itemForm.price_from_qty) : 1,
        price_after: useProgressivePrice ? Number(itemForm.price_after) : null,
        max_qty: Number(itemForm.max_qty),
        sort_order: itemForm.sort_order,
      }
      if (editingItemId) {
        await updateAddonItem(editingItemId, payload)
        setGroups(prev => prev.map(g => g.id === editingItemGroupId
          ? { ...g, items: g.items.map(i => i.id === editingItemId ? { ...i, ...payload } : i) }
          : g
        ))
      } else {
        const created = await createAddonItem(editingItemGroupId, {
          ...payload,
          sort_order: groups.find(g => g.id === editingItemGroupId)?.items.length ?? 0,
        })
        setGroups(prev => prev.map(g => g.id === editingItemGroupId
          ? { ...g, items: [...g.items, created] }
          : g
        ))
      }
      resetItemForm()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingItem(false)
    }
  }

  const handleDeleteItem = async (groupId: string, itemId: string) => {
    if (!confirm('Excluir este adicional?')) return
    try {
      await deleteAddonItem(itemId)
      setGroups(prev => prev.map(g => g.id === groupId
        ? { ...g, items: g.items.filter(i => i.id !== itemId) }
        : g
      ))
    } catch (e: any) {
      setError(e.message)
    }
  }

  const startAddItem = (groupId: string) => {
    setEditingItemGroupId(groupId)
    setEditingItemId(null)
    setItemForm(EMPTY_ITEM)
    setUseProgressivePrice(false)
  }

  const startEditItem = (groupId: string, item: AddonItem) => {
    setEditingItemGroupId(groupId)
    setEditingItemId(item.id)
    setItemForm({
      name: item.name,
      price: item.price,
      price_from_qty: item.price_from_qty,
      price_after: item.price_after,
      max_qty: item.max_qty,
      sort_order: item.sort_order,
    })
    setUseProgressivePrice(item.price_after !== null)
  }

  const resetItemForm = () => {
    setEditingItemGroupId(null)
    setEditingItemId(null)
    setItemForm(EMPTY_ITEM)
    setUseProgressivePrice(false)
  }

  if (loading) return <div className="text-sm text-gray-400 py-4">Carregando adicionais...</div>

  return (
    <div className="mt-6 border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50">
        <span className="text-sm font-medium text-gray-700">Adicionais</span>
        {!showGroupForm && (
          <button
            type="button"
            onClick={() => { resetGroupForm(); setShowGroupForm(true) }}
            className="text-xs text-gray-500 hover:text-gray-900 underline transition-colors"
          >
            + Novo grupo
          </button>
        )}
      </div>

      {error && (
        <div className="px-5 py-2 bg-red-50 text-xs text-red-600">{error}</div>
      )}

      {showGroupForm && (
        <div className="px-5 py-4 bg-white border-b border-gray-100 flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {editingGroupId ? 'Editar grupo' : 'Novo grupo'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Nome do grupo *</label>
              <input
                type="text"
                placeholder="Ex: Molhos, Acompanhamentos"
                value={groupForm.name}
                onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mínimo obrigatório</label>
              <input type="number" min={0} value={groupForm.min_select}
                onChange={e => setGroupForm(f => ({ ...f, min_select: Number(e.target.value) }))}
                className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">0 = opcional</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Máximo permitido</label>
              <input type="number" min={1} placeholder="Sem limite" value={groupForm.max_select}
                onChange={e => setGroupForm(f => ({ ...f, max_select: e.target.value }))}
                className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">Vazio = sem limite</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleSaveGroup} disabled={savingGroup}
              className="bg-black text-white text-xs px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {savingGroup ? 'Salvando...' : editingGroupId ? 'Salvar grupo' : 'Criar grupo'}
            </button>
            <button type="button" onClick={resetGroupForm}
              className="text-xs px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 && !showGroupForm && (
        <div className="px-5 py-6 text-center text-sm text-gray-400">
          Nenhum grupo de adicionais. Clique em "+ Novo grupo" para começar.
        </div>
      )}

      {groups.map(group => (
        <div key={group.id} className="border-b border-gray-100 last:border-0">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50/50">
            <div>
              <span className="text-sm font-medium text-gray-800">{group.name}</span>
              <span className="ml-2 text-xs text-gray-400">
                {group.min_select > 0 ? `Obrigatório · mín. ${group.min_select}` : 'Opcional'}
                {group.max_select ? ` · máx. ${group.max_select}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => startEditGroup(group)}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Editar</button>
              <button type="button" onClick={() => handleDeleteGroup(group.id)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors">Excluir</button>
            </div>
          </div>

          <div className="px-5 py-2 flex flex-col gap-1">
            {group.items.map(item => (
              <div
                key={item.id}
                className={`flex items-center justify-between py-2 border-b border-gray-50 last:border-0
                  ${!item.active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Badge inativo */}
                  {!item.active && (
                    <span className="shrink-0 text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                      Inativo
                    </span>
                  )}
                  <div>
                    <span className="text-sm text-gray-700">{item.name}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {item.price === 0 ? 'Grátis' : fmtBRL(item.price)}
                      {item.price_after !== null && ` · a partir do ${item.price_from_qty}º: ${fmtBRL(item.price_after)}`}
                      {' · '}máx. {item.max_qty}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {/* Toggle ativo/inativo */}
                  <button
                    type="button"
                    disabled={togglingItemId === item.id}
                    onClick={() => handleToggleItem(group.id, item)}
                    className={`text-xs font-medium transition-colors disabled:opacity-40
                      ${item.active
                        ? 'text-amber-500 hover:text-amber-700'
                        : 'text-green-600 hover:text-green-800'
                      }`}
                  >
                    {togglingItemId === item.id
                      ? '...'
                      : item.active ? 'Inativar' : 'Ativar'}
                  </button>
                  <button type="button" onClick={() => startEditItem(group.id, item)}
                    className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Editar</button>
                  <button type="button" onClick={() => handleDeleteItem(group.id, item.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors">Excluir</button>
                </div>
              </div>
            ))}

            {editingItemGroupId === group.id && (
              <div className="mt-2 mb-1 p-3 bg-gray-50 rounded-xl flex flex-col gap-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {editingItemId ? 'Editar adicional' : 'Novo adicional'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nome *</label>
                    <input type="text" placeholder="Ex: Molho extra"
                      value={itemForm.name}
                      onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Preço (R$)</label>
                    <input type="number" min={0} step="0.01" placeholder="0,00"
                      value={itemForm.price}
                      onChange={e => setItemForm(f => ({ ...f, price: Number(e.target.value) }))}
                      className={inputCls} />
                    <p className="text-xs text-gray-400 mt-1">0 = grátis</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Qtd. máxima</label>
                    <input type="number" min={1}
                      value={itemForm.max_qty}
                      onChange={e => setItemForm(f => ({ ...f, max_qty: Number(e.target.value) }))}
                      className={inputCls} />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={useProgressivePrice}
                    onChange={e => setUseProgressivePrice(e.target.checked)}
                    className="w-4 h-4 accent-black" />
                  <span className="text-xs text-gray-600">Preço progressivo (ex: 1º grátis, a partir do 2º cobra)</span>
                </label>

                {useProgressivePrice && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">A partir do Nº</label>
                      <input type="number" min={2} value={itemForm.price_from_qty}
                        onChange={e => setItemForm(f => ({ ...f, price_from_qty: Number(e.target.value) }))}
                        className={inputCls} />
                      <p className="text-xs text-gray-400 mt-1">Ex: 2 = a partir do 2º item</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Preço a partir do Nº (R$)</label>
                      <input type="number" min={0} step="0.01" value={itemForm.price_after ?? ''}
                        onChange={e => setItemForm(f => ({ ...f, price_after: Number(e.target.value) }))}
                        className={inputCls} />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button type="button" onClick={handleSaveItem} disabled={savingItem}
                    className="bg-black text-white text-xs px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors">
                    {savingItem ? 'Salvando...' : editingItemId ? 'Salvar' : 'Adicionar'}
                  </button>
                  <button type="button" onClick={resetItemForm}
                    className="text-xs px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {editingItemGroupId !== group.id && (
              <button type="button" onClick={() => startAddItem(group.id)}
                className="text-xs text-gray-400 hover:text-gray-700 py-2 text-left transition-colors">
                + Adicionar item
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}