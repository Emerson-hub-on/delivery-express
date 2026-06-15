'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product, CategoryItem, Order } from '@/types/product'
import { Customer } from '@/types/customer'
import { getAllProducts } from '@/services/product'
import { getAllCategories } from '@/services/category'
import { getAllOrders, getOrderByCode, getOrdersByDateRange } from '@/services/orders'
import { getAllMotoboys } from '@/services/motoboys'
import { getAllCustomers } from '@/services/customers'
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

import { FiscalTab } from '@/settings/SettingsTab'
import { CustomersTab } from './customers/CustomersTab'
import { BillingTab } from '@/components/billing/BillingTab'
import type { BillingSubTab } from '@/types/billing'
import { OperatorsView } from './tabs/OperatorsView'
import { CashTab } from './cash/CashTab'
import { StoreTab } from '@/settings/StoreTab'

function todayLocalISO() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export default function AdminPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const [billingSubTab, setBillingSubTab] = useState<BillingSubTab>('nf-entrada')

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const [authReady,  setAuthReady]  = useState(false)
  const [companyId,  setCompanyId]  = useState<string>('')

// ✅ Adicione o filtro do usuário autenticado
useEffect(() => {
  supabase.auth.getSession().then(async ({ data, error }) => {
    if (error || !data.session) {
      router.replace(`/${params?.slug}/admin/login`)
      return
    }

    // ← busca o company_id real pelo user_id
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', data.session.user.id)
      .single()

    if (!company) {
      router.replace(`/${params?.slug}/admin/login`)
      return
    }

    setCompanyId(company.id)  // ← UUID da empresa, não do usuário
    setAuthReady(true)
  })
}, [])

  // ── Tabs & UI state ─────────────────────────────────────────────────────────
  const [tab,   setTab]   = useState<Tab>('products')
  const [error, setError] = useState<string | null>(null)

  const [orderSearch,    setOrderSearch]    = useState('')
  const [searchedOrder,  setSearchedOrder]  = useState<Order | null>(null)
  const [searchingOrder, setSearchingOrder] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [products,        setProducts]        = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [showProductForm, setShowProductForm] = useState(false)

  const [categories,   setCategories]   = useState<CategoryItem[]>([])
  const [loadingCats,  setLoadingCats]  = useState(true)
  const [showCatForm,  setShowCatForm]  = useState(false)

  const [orders,         setOrders]         = useState<Order[]>([])
  const [allOrders,      setAllOrders]      = useState<Order[]>([])
  const [loadingOrders,  setLoadingOrders]  = useState(false)
  const [dateFrom,       setDateFrom]       = useState(todayLocalISO)
  const [dateTo,         setDateTo]         = useState(todayLocalISO)
  const [reportSubTab,   setReportSubTab]   = useState<'overview' | 'products' | 'categories' | 'inventory'>('overview')

  const [motoboys,        setMotoboys]        = useState<Motoboy[]>([])
  const [loadingMotoboys, setLoadingMotoboys] = useState(false)
  const [showMotoboyForm, setShowMotoboyForm] = useState(false)

  const [customers,        setCustomers]        = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showOperatorForm, setShowOperatorForm] = useState(false)
  const [operatorCount, setOperatorCount] = useState(0)


  // ── Fetch inicial (após auth) ───────────────────────────────────────────────
  useEffect(() => {
    if (!authReady) return
    fetchOperatorCount()
    supabase
      .from('operators')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .then(({ count }) => setOperatorCount(count ?? 0))

    const run = async <T,>(
      setLoading: (v: boolean) => void,
      setter: (v: T) => void,
      fetcher: () => Promise<T>
    ) => {
      try {
        setLoading(true)
        setter(await fetcher())
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    run(setLoadingProducts, setProducts, getAllProducts)
    run(setLoadingCats,     setCategories, getAllCategories)
    run(setLoadingMotoboys, setMotoboys, getAllMotoboys)
    run(setLoadingCustomers, setCustomers, getAllCustomers)
  }, [authReady])

  // ── Busca de pedido por código ──────────────────────────────────────────────
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!orderSearch) { setSearchedOrder(null); return }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchingOrder(true)
      try { setSearchedOrder(await getOrderByCode(Number(orderSearch))) }
      finally { setSearchingOrder(false) }
    }, 400)
  }, [orderSearch])

  // ── Fetch de pedidos ────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      setLoadingOrders(true)
      setOrders(
        dateFrom && dateTo
          ? await getOrdersByDateRange(dateFrom, dateTo)
          : await getAllOrders()
      )
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingOrders(false)
    }
  }, [dateFrom, dateTo])

  const fetchOperatorCount = useCallback(() => {
  if (!companyId) return
  supabase
    .from('operators')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .then(({ count }) => setOperatorCount(count ?? 0))
}, [companyId])

  const fetchAllOrders = useCallback(async () => {
    try { setAllOrders(await getAllOrders()) }
    catch (e: any) { setError(e.message) }
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

  // ── Realtime orders ─────────────────────────────────────────────────────────
  const dateFromRef = useRef(dateFrom)
  const dateToRef   = useRef(dateTo)
  useEffect(() => { dateFromRef.current = dateFrom }, [dateFrom])
  useEffect(() => { dateToRef.current   = dateTo   }, [dateTo])

  useEffect(() => {
    if (!authReady) return
    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `company_id=eq.${companyId}` },
        (payload) => {
          const newOrder  = payload.new as Order
          const orderDate = newOrder.created_at
            ? new Date(newOrder.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Recife' })
            : null
          const from = dateFromRef.current
          const to   = dateToRef.current
          const inRange = !orderDate || ((!from || orderDate >= from) && (!to || orderDate <= to))
          if (inRange) setOrders(prev => prev.some(o => o.id === newOrder.id) ? prev : [newOrder, ...prev])
          setAllOrders(prev => prev.some(o => o.id === newOrder.id) ? prev : [newOrder, ...prev])
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders',filter: `company_id=eq.${companyId}` },
        (payload) => {
          const incoming = payload.new as Order
          const patch    = (prev: Order[]) => prev.map(o => o.id !== incoming.id ? o : { ...o, ...incoming })
          setOrders(patch)
          setAllOrders(patch)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authReady])

  // ── Tab change ──────────────────────────────────────────────────────────────
  const handleTabChange = (newTab: Tab) => {
    setTab(newTab)
    setError(null)
    setOrderSearch('')
    setSearchedOrder(null)
    setShowProductForm(false)
    setShowCatForm(false)
    setShowMotoboyForm(false)
    setShowCustomerForm(false)
    setShowOperatorForm(false)
  }

  const handleClearFilter = () => {
    const today = todayLocalISO()
    setDateFrom(today)
    setDateTo(today)
  }

  // ── Auth loading ────────────────────────────────────────────────────────────
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

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 text-black flex items-stretch">
      <AdminTabs
        tab={tab}
        onChange={handleTabChange}
        reportSubTab={reportSubTab}
        onReportSubTabChange={setReportSubTab}
        billingSubTab={billingSubTab}
        onBillingSubTabChange={setBillingSubTab}
      />

      <div className="flex-1 px-8 py-8">
        <AdminHeader
          tab={tab}
          productCount={products.length}
          categoryCount={categories.length}
          motoboyCount={motoboys.length}
          customerCount={customers.length}
          onNewProduct={() => setShowProductForm(true)}
          onNewCategory={() => setShowCatForm(true)}
          onNewMotoboy={() => setShowMotoboyForm(true)}
          onNewCustomer={() => setShowCustomerForm(true)}
          showProductForm={showProductForm}
          showCategoryForm={showCatForm}
          showMotoboyForm={showMotoboyForm}
          showCustomerForm={showCustomerForm}
          orderSearch={orderSearch}
          onOrderSearchChange={v => { setOrderSearch(v); if (!v) setSearchedOrder(null) }}
          operatorCount={operatorCount}              // ou buscar do banco se quiser
          onNewOperator={() => setShowOperatorForm(true)}
          showOperatorForm={showOperatorForm}
        />

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm
            flex items-start justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 shrink-0 text-xs">✕</button>
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
            companyId={companyId}
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
            onClearSearch={() => { setOrderSearch(''); setSearchedOrder(null) }}
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
        {tab === 'customers' && (
          <CustomersTab
            customers={customers}
            setCustomers={setCustomers}
            loading={loadingCustomers}
            showForm={showCustomerForm}
            setShowForm={setShowCustomerForm}
            companyId={companyId}
            onError={setError}
          />
        )}
        {tab === 'operators' && (
          <OperatorsView
            showForm={showOperatorForm}
            setShowForm={setShowOperatorForm}
            onCountChange={fetchOperatorCount}
          />
        )}
        {tab === 'caixa' && <CashTab />}
        {tab === 'billing'  && (
          <BillingTab
            subTab={billingSubTab}
            onSubTabChange={setBillingSubTab}
            companyId={companyId}
            onError={setError}
          />
        )}
        {tab === 'settings' && <FiscalTab onError={setError} />}
        {tab === 'store' && <StoreTab onError={setError} companyId={companyId} />}
        {tab === 'ifood'    && <IfoodSync />}
        
      </div>
    </div>
  )
}
