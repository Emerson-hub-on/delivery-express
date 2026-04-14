import { Product } from "@/types/product";
import { CartAddon } from "@/types/addon";

export type Cart = {
  id: string
  product: Product
  quantity: number
  addons: CartAddon[]
  observation: string
  totalWithAddons: number
}