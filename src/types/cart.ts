import { Product } from "@/types/product";
import { CartAddon } from "@/types/addon";

export type Cart = {
  id: string
  product: Product
  quantity: number
  addons: CartAddon[]
  observation: string
  selectedSize?: string
  selectedColor?: string   // ← novo
  variantLabel?: string    // ← "AMARELO / M" — usado no carrinho e no pedido
  totalWithAddons: number
}