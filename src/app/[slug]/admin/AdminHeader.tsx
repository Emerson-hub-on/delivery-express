'use client'
import { Tab } from './types'

interface AdminHeaderProps {
  tab: Tab
  productCount: number
  categoryCount: number
  motoboyCount: number
  onNewProduct: () => void
  onNewCategory: () => void
  onNewMotoboy: () => void
  showProductForm: boolean
  showCategoryForm: boolean
  showMotoboyForm: boolean
  orderSearch?: string
  onOrderSearchChange?: (v: string) => void
}

export function AdminHeader({
  tab,
  productCount,
  categoryCount,
  motoboyCount,
  onNewProduct,
  onNewCategory,
  onNewMotoboy,
  showProductForm,
  showCategoryForm,
  showMotoboyForm,
  orderSearch = '',
  onOrderSearchChange,
}: AdminHeaderProps) {
  const subtitle: Record<Tab, string | null> = {
    products: `${productCount} produtos cadastrados`,
    categories: `${categoryCount} categorias cadastradas`,
    motoboys: `${motoboyCount} motoboys cadastrados`,
    orders: null,
    reports: null,
    fiscal: 'Emita e gerencie cupons fiscais (NFC-e)',
    settings: 'Personalize o visual da sua loja',
    cash: 'Abertura e fechamento de caixa',
    ifood: null,
  }

  return (
    <div className="flex flex-col md:flex-row justify-between mb-6">
      <div>
        <h1 className="pl-20 text-2xl font-semibold text-gray-900">Admin</h1>
        {subtitle[tab] && (
          <p className="text-sm text-gray-500 mt-1">{subtitle[tab]}</p>
        )}
      </div>
      <div className="md:ml-auto mt-3 md:mt-0 flex items-center gap-2">
        {tab === 'orders' && (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Buscar pedido #..."
              value={orderSearch}
              onChange={e => onOrderSearchChange?.(e.target.value.replace(/\D/g, ''))}
              className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 w-48"
            />
            {orderSearch && (
              <button
                onClick={() => onOrderSearchChange?.('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs"
              >✕</button>
            )}
          </div>
        )}
        {tab === 'products' && !showProductForm && (
          <button onClick={onNewProduct}
            className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            + Novo produto
          </button>
        )}
        {tab === 'categories' && !showCategoryForm && (
          <button onClick={onNewCategory}
            className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            + Nova categoria
          </button>
        )}
        {tab === 'motoboys' && !showMotoboyForm && (
          <button onClick={onNewMotoboy}
            className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            + Novo motoboy
          </button>
        )}
      </div>
    </div>
  )
}