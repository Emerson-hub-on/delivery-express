// types/addon.ts

export type AddonGroup = {
  id: string
  product_id: number
  name: string
  min_select: number      // 0 = opcional, >0 = obrigatório
  max_select: number | null  // null = sem limite
  sort_order: number
  items: AddonItem[]
}

export type AddonItem = {
  id: string
  group_id: string
  name: string
  price: number           // preço da 1ª unidade (0 = grátis)
  price_from_qty: number  // a partir de qual qty o preço muda (default 1)
  price_after: number | null  // preço a partir de price_from_qty (null = mesmo preço)
  max_qty: number         // quantidade máxima por item
  active: boolean
  sort_order: number
}

// Seleção feita pelo cliente no card de adicionais
export type SelectedAddon = {
  item: AddonItem
  qty: number
  subtotal: number  // calculado considerando preço progressivo
}

// Carrinho com adicionais
export type CartAddon = {
  groupId: string
  groupName: string
  itemId: string
  itemName: string
  qty: number
  unitPrice: number   // preço efetivo cobrado
  subtotal: number
}
