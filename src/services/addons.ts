// services/addons.ts
import { supabase } from '@/lib/supabase'
import { AddonGroup, AddonItem } from '@/types/addon'

// ── Leitura (cardápio público) ────────────────────────────────
// Versão admin — retorna itens ativos E inativos
export const getAddonGroupsByProductAdmin = async (productId: number): Promise<AddonGroup[]> => {
  const { data, error } = await supabase
    .from('addon_groups')
    .select(`*, items:addon_items(*)`)
    .eq('product_id', productId)
    .order('sort_order')

  if (error) throw new Error(error.message)

  return (data ?? []).map(g => ({
    ...g,
    items: (g.items ?? []).sort((a: AddonItem, b: AddonItem) => a.sort_order - b.sort_order),
  }))
}
export const getAddonGroupsByProduct = async (productId: number): Promise<AddonGroup[]> => {
  const { data, error } = await supabase
    .from('addon_groups')
    .select(`
      *,
      items:addon_items(*)
    `)
    .eq('product_id', productId)
    .order('sort_order')

  if (error) throw new Error(error.message)

  return (data ?? []).map(g => ({
    ...g,
    items: (g.items ?? [])
      .filter((i: AddonItem) => i.active)
      .sort((a: AddonItem, b: AddonItem) => a.sort_order - b.sort_order),
  }))
}

// ── Admin: grupos ─────────────────────────────────────────────

export const createAddonGroup = async (
  productId: number,
  data: { name: string; min_select: number; max_select: number | null; sort_order: number }
): Promise<AddonGroup> => {
  const { data: row, error } = await supabase
    .from('addon_groups')
    .insert({ product_id: productId, ...data })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return { ...row, items: [] }
}

export const updateAddonGroup = async (
  id: string,
  data: Partial<{ name: string; min_select: number; max_select: number | null; sort_order: number }>
): Promise<void> => {
  const { error } = await supabase
    .from('addon_groups')
    .update(data)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export const deleteAddonGroup = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('addon_groups')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Admin: itens ──────────────────────────────────────────────

export const createAddonItem = async (
  groupId: string,
  data: {
    name: string
    price: number
    price_from_qty: number
    price_after: number | null
    max_qty: number
    sort_order: number
  }
): Promise<AddonItem> => {
  const { data: row, error } = await supabase
    .from('addon_items')
    .insert({ group_id: groupId, active: true, ...data })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return row as AddonItem
}

export const updateAddonItem = async (
  id: string,
  data: Partial<Omit<AddonItem, 'id' | 'group_id'>>
): Promise<void> => {
  const { error } = await supabase
    .from('addon_items')
    .update(data)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export const deleteAddonItem = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('addon_items')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Helper: calcula preço de um addon com regra progressiva ───

export function calcAddonItemPrice(item: AddonItem, qty: number): number {
  if (qty <= 0) return 0
  if (!item.price_after || qty < item.price_from_qty) {
    return item.price * qty
  }
  // Unidades antes do threshold: preço normal
  const qtyBefore = item.price_from_qty - 1
  const qtyAfter  = qty - qtyBefore
  return (item.price * qtyBefore) + (item.price_after * qtyAfter)
}
