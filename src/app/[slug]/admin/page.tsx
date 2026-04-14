'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

import { Product, CategoryItem, Order } from '@/types/product'
import { getAllProducts } from '@/services/product'
import { getAllCategories } from '@/services/category'
import { getAllOrders, getOrdersByDateRange } from '@/services/orders'
import { getAllMotoboys } from '@/services/motoboys'
import { Motoboy } from '@/types/motoboy'
import { IfoodSync } from '@/components/ifood/ifood-sync'

import { Tab } from './types'
import { AdminHeader } from './AdminHeader'
import { AdminTabs } from './AdminTabs'
import { ProductsTab } from './products/ProductsTab'
import { CategoriesTab } from './categories/CategoriesTab'
import { OrdersTab } from './orders/OrdersTab'
import { ReportsTab } from './reports/ReportsTab'
import { MotoboyTab } from '@/components/motoboy/motoboy-tab'
import { FiscalTab } from './fiscal/FiscalTab'
import { SettingsTab } from '@/settings/SettingsTab'
import { CashTab } from './cash/CashTab'

function todayLocalISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('products')
  const [error, setError] = useState<string | null>(null)

  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [showProductForm, setShowProductForm] = useState(false)

  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [showCatForm, setShowCatForm] = useState(false)

  const [orders, setOrders] = useState<Order[]>([])
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [dateFrom, setDateFrom] = useState(todayLocalISO)
  const [dateTo, setDateTo] = useState(todayLocalISO)
  const [reportSubTab, setReportSubTab] = useState<'overview' | 'products' | 'categories'>('overview')

  const [motoboys, setMotoboys] = useState<Motoboy[]>([])
  const [loadingMotoboys, setLoadingMotoboys] = useState(false)
  const [showMotoboyForm, setShowMotoboyForm] = useState(false)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true)
        setProducts(await getAllProducts())
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoadingProducts(false)
      }
    }

    const fetchCategories = async () => {
      try {
        setLoadingCats(true)
        setCategories(await getAllCategories())
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoadingCats(false)
      }
    }

    fetchProducts()
    fetchCategories()
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      setLoadingOrders(true)
      if (dateFrom && dateTo) {
        const filtered = await getOrdersByDateRange(dateFrom, dateTo)
        setOrders(filtered)
      } else {
        const all = await getAllOrders()
        setOrders(all)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingOrders(false)
    }
  }, [dateFrom, dateTo])

  const fetchAllOrders = useCallback(async () => {
    try {
      const all = await getAllOrders()
      setAllOrders(all)
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  const fetchOrdersRef = useRef(fetchOrders)
  useEffect(() => { fetchOrdersRef.current = fetchOrders }, [fetchOrders])

  useEffect(() => {
    if (tab === 'orders' || tab === 'reports') {
      fetchOrdersRef.current()
      if (allOrders.length === 0) fetchAllOrders()
    }
  }, [tab])

  useEffect(() => {
    if (tab !== 'motoboys') return
    const fetch = async () => {
      try {
        setLoadingMotoboys(true)
        setMotoboys(await getAllMotoboys())
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoadingMotoboys(false)
      }
    }
    fetch()
  }, [tab])

  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new as Order
          setOrders(prev => [newOrder, ...prev])
          setAllOrders(prev => [newOrder, ...prev])
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          const incoming = payload.new as Order
          const patch = (prev: Order[]) => prev.map(o => {
            if (o.id !== incoming.id) return o
            const updates = Object.fromEntries(
              Object.entries(incoming).filter(([_, v]) => v !== undefined)
            )
            return { ...o, ...updates }
          })
          setOrders(patch)
          setAllOrders(patch)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab)
    setError(null)
    setShowProductForm(false)
    setShowCatForm(false)
    setShowMotoboyForm(false)
  }

  const handleClearFilter = () => {
    const today = todayLocalISO()
    setDateFrom(today)
    setDateTo(today)
  }

  return (
    <div className="min-h-screen bg-gray-50 text-black flex items-stretch">
      <AdminTabs
        tab={tab}
        onChange={handleTabChange}
        reportSubTab={reportSubTab}
        onReportSubTabChange={setReportSubTab}
      />

      <div className="flex-1 px-8 py-8">
        <AdminHeader
          tab={tab}
          productCount={products.length}
          categoryCount={categories.length}
          motoboyCount={motoboys.length}
          onNewProduct={() => setShowProductForm(true)}
          onNewCategory={() => setShowCatForm(true)}
          onNewMotoboy={() => setShowMotoboyForm(true)}
          showProductForm={showProductForm}
          showCategoryForm={showCatForm}
          showMotoboyForm={showMotoboyForm}
        />

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 shrink-0 text-xs">✕</button>
          </div>
        )}

        {tab === 'products' && (
          <ProductsTab
            products={products}
            setProducts={setProducts}
            categories={categories}
            loadingCats={loadingCats}
            loading={loadingProducts}
            showForm={showProductForm}
            setShowForm={setShowProductForm}
            onError={setError}
            onGoToCategories={() => handleTabChange('categories')}
          />
        )}

        {tab === 'categories' && (
          <CategoriesTab
            categories={categories}
            setCategories={setCategories}
            products={products}
            setProducts={setProducts}
            loading={loadingCats}
            showForm={showCatForm}
            setShowForm={setShowCatForm}
            onError={setError}
          />
        )}

        {tab === 'orders' && (
          <OrdersTab
            orders={orders}
            setOrders={setOrders}
            loading={loadingOrders}
            onError={setError}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onFilter={fetchOrders}
            onClearFilter={handleClearFilter}
          />
        )}

        {tab === 'reports' && (
          <ReportsTab
            orders={orders}
            allOrders={allOrders}
            loading={loadingOrders}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onFilter={fetchOrders}
            onClearFilter={handleClearFilter}
            subTab={reportSubTab}
            onSubTabChange={setReportSubTab}
            categories={categories}
            products={products}
          />
        )}

        {tab === 'motoboys' && (
          <MotoboyTab
            motoboys={motoboys}
            setMotoboys={setMotoboys}
            loading={loadingMotoboys}
            showForm={showMotoboyForm}
            setShowForm={setShowMotoboyForm}
            onError={setError}
          />
        )}

        {tab === 'fiscal' && (
          <FiscalTab onError={setError} />
        )}

        {tab === 'settings' && (
          <SettingsTab onError={setError} />
        )}

        {tab === 'cash' && <CashTab />}

        {tab === 'ifood' && (
          <IfoodSync />
        )}
      </div>
    </div>
  )
}
