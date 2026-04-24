'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

import { Product, CategoryItem, Order } from '@/types/product'
import { getAllProducts } from '@/services/product'
import { getAllCategories } from '@/services/category'
import { getAllOrders, getOrderByCode, getOrdersByDateRange } from '@/services/orders'
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
  const params = useParams<{ slug: string }>()
  const router = useRouter()

  // ── Auth guard ──────────────────────────────────────────────
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    // Aguarda a sessão estar disponível antes de carregar qualquer dado
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        // Sem sessão — redireciona para o login
        router.replace(`/${params?.slug}/admin/login`)
        return
      }
      setAuthReady(true)
    })
  }, [])

  // ── Tabs & data state ───────────────────────────────────────
  const [tab, setTab] = useState<Tab>('products')
  const [error, setError] = useState<string | null>(null)
  const [orderSearch, setOrderSearch] = useState('')
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null)
  const [searchingOrder, setSearchingOrder] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Só busca dados depois que a sessão foi confirmada
  useEffect(() => {
    if (!authReady) return

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
  }, [authReady])

  useEffect(() => {
  if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
  if (!orderSearch) { setSearchedOrder(null); return }

  searchTimeoutRef.current = setTimeout(async () => {
    setSearchingOrder(true)
    try {
      const found = await getOrderByCode(Number(orderSearch))
      setSearchedOrder(found)
    } finally {
      setSearchingOrder(false)
    }
  }, 400)
}, [orderSearch])

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
    if (!authReady) return
    if (tab === 'orders' || tab === 'reports') {
      fetchOrdersRef.current()
      if (allOrders.length === 0) fetchAllOrders()
    }
  }, [tab, authReady])

useEffect(() => {
  if (!authReady) return   // ← remove a condição de tab
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
}, [authReady]) 


// Refs para acessar os valores atuais dentro do canal sem recriá-lo
const dateFromRef = useRef(dateFrom)
const dateToRef   = useRef(dateTo)
useEffect(() => { dateFromRef.current = dateFrom }, [dateFrom])
useEffect(() => { dateToRef.current   = dateTo   }, [dateTo])

useEffect(() => {
  if (!authReady) return
  const channel = supabase
    .channel('admin-orders-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
      (payload) => {
        const newOrder = payload.new as Order

        const orderDate = newOrder.created_at
          ? new Date(newOrder.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Recife' })
          : null

        // Lê via ref — sem recriar o canal quando o filtro muda
        const from = dateFromRef.current
        const to   = dateToRef.current

        const dentroDoFiltro = !orderDate || (
          (!from || orderDate >= from) &&
          (!to   || orderDate <= to)
        )

        if (dentroDoFiltro) {
          setOrders(prev => {
            if (prev.some(o => o.id === newOrder.id)) return prev
            return [newOrder, ...prev]
          })
        }

        setAllOrders(prev => {
          if (prev.some(o => o.id === newOrder.id)) return prev
          return [newOrder, ...prev]
        })
      }
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
      (payload) => {
        const incoming = payload.new as Order
        const patch = (prev: Order[]) =>
          prev.map(o => o.id !== incoming.id ? o : { ...o, ...incoming })
        setOrders(patch)
        setAllOrders(patch)
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [authReady]) // ← canal criado uma única vez

const handleTabChange = (newTab: Tab) => {
  setTab(newTab)
  setError(null)
  setOrderSearch('')
  setSearchedOrder(null)
  setShowProductForm(false)
  setShowCatForm(false)
  setShowMotoboyForm(false)
}

  const handleClearFilter = () => {
    const today = todayLocalISO()
    setDateFrom(today)
    setDateTo(today)
  }

  // ── Auth loading screen ─────────────────────────────────────
  if (!authReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
          <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-gray-400">Verificando autenticação…</p>
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────
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
          orderSearch={orderSearch}
          onOrderSearchChange={(v) => { setOrderSearch(v); if (!v) setSearchedOrder(null) }}
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
            orderSearch={orderSearch}
            searchedOrder={searchedOrder}
            searchingOrder={searchingOrder}
            onClearSearch={() => { setOrderSearch(''); setSearchedOrder(null) } }
            
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
