// stores/cart-store.ts
import { create } from 'zustand'
import { Product } from '@/types/product'
import { CartAddon } from '@/types/addon'
import { Cart } from '@/types/cart'


type States = {
  cart: Cart[]
}

type Actions = {
  addToCart: (product: Product, quantity: number, addons: CartAddon[], observation: string) => void
  upsertCartItem: (product: Product, quantity: number) => void  // mantido para compatibilidade
  removeFromCart: (cartId: string) => void
  updateQty: (cartId: string, quantity: number) => void
  clearCart: () => void
}

function calcTotal(product: Product, qty: number, addons: CartAddon[]): number {
  const addonsTotal = addons.reduce((s, a) => s + a.subtotal, 0)
  return (product.price + addonsTotal) * qty
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const useCartStore = create<States & Actions>()((set) => ({
  cart: [],

  addToCart: (product, quantity, addons, observation) =>
    set(state => {
      const totalWithAddons = calcTotal(product, quantity, addons)
      const newItem: Cart = {
        id: genId(),
        product,
        quantity,
        addons,
        observation,
        totalWithAddons,
      }
      return { cart: [...state.cart, newItem] }
    }),

  // Compatibilidade com código antigo — adiciona sem adicionais
  upsertCartItem: (product, quantity) =>
    set(state => {
      let newCart = [...state.cart]
      const idx = newCart.findIndex(
        item => item.product.id === product.id && item.addons.length === 0
      )
      if (idx < 0) {
        newCart.push({
          id: genId(),
          product,
          quantity,
          addons: [],
          observation: '',
          totalWithAddons: product.price * quantity,
        })
      } else {
        const updated = { ...newCart[idx] }
        updated.quantity += quantity
        updated.totalWithAddons = calcTotal(product, updated.quantity, [])
        newCart[idx] = updated
      }
      newCart = newCart.filter(item => item.quantity > 0)
      return { cart: newCart }
    }),

  removeFromCart: (cartId) =>
    set(state => ({ cart: state.cart.filter(item => item.id !== cartId) })),

  updateQty: (cartId, quantity) =>
    set(state => ({
      cart: state.cart
        .map(item => item.id === cartId
          ? { ...item, quantity, totalWithAddons: calcTotal(item.product, quantity, item.addons) }
          : item
        )
        .filter(item => item.quantity > 0),
    })),

  clearCart: () => set({ cart: [] }),
}))
