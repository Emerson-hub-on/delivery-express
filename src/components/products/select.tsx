"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getProductsByCompany, getAllProducts } from "@/services/product"
import { getCategoriesByCompany, getAllCategories } from "@/services/category"
import { Product, CategoryItem } from "@/types/product"
import { ProductItem } from "../products/item"
import { ProductEmpty } from "../products/empty"
import { useCompanyStore } from "@/stores/company-store"

type Props = {
  companyId?: string
  layout?: 'desktop' | 'mobile'
}

export const ProductSelect = ({ companyId, layout = 'mobile' }: Props) => {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // mobile tab scroll
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)

  const searchQuery = useCompanyStore(s => s.searchQuery)
  const setSearchQuery = useCompanyStore(s => s.setSearchQuery)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    const load = async () => {
      try {
        const [data, cats] = await Promise.all([
          companyId ? getProductsByCompany(companyId) : getAllProducts(),
          companyId ? getCategoriesByCompany(companyId) : getAllCategories(),
        ])
        setProducts(data)
        setCategories(cats)
        if (cats.length > 0) setActiveCategory(cats[0].name)
      } catch (err) {
        console.error('Erro ao carregar produtos:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [companyId])

  // ── Tab scroll arrows (mobile) ──────────────────────────────────────────
  const updateArrows = () => {
    const el = tabsRef.current
    if (!el) return
    setShowLeft(el.scrollLeft > 8)
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }

  useEffect(() => {
    const el = tabsRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows)
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [categories])

  const scrollTabs = (direction: 'left' | 'right') => {
    tabsRef.current?.scrollBy({ left: direction === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  // ── Smooth scroll to section ─────────────────────────────────────────────
  const scrollToSection = (categoryName: string) => {
    setActiveCategory(categoryName)
    const el = sectionRefs.current[categoryName]
    if (!el) return
    const offset = layout === 'desktop' ? 24 : 80
    const targetY = el.getBoundingClientRect().top + window.scrollY - offset
    const startY = window.scrollY
    const distance = targetY - startY
    const duration = 700
    let startTime: number | null = null
    const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const p = Math.min((ts - startTime) / duration, 1)
      window.scrollTo(0, startY + distance * ease(p))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  // ── Track active category on scroll ─────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const offset = layout === 'desktop' ? 40 : 100
      for (const cat of [...categories].reverse()) {
        const el = sectionRefs.current[cat.name]
        if (!el) continue
        if (el.getBoundingClientRect().top <= offset) {
          setActiveCategory(cat.name)
          return
        }
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [categories, layout])

  const isSearching = searchQuery.trim().length > 0
  const searchResults = isSearching
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  const productsByCategory = categories
    .map(cat => ({ category: cat, items: products.filter(p => p.category === cat.name) }))
    .filter(g => g.items.length > 0)

  // ════════════════════════════════════════════════════════════════
  // DESKTOP LAYOUT — sidebar + main
  // ════════════════════════════════════════════════════════════════
  if (layout === 'desktop') {
    return (
      <>
        {/* ── Left sidebar ── */}
        <aside className="w-56 shrink-0">
          <div className="sticky top-24 space-y-1">
            {/* Label */}
            {!loading && categories.length > 0 && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-800 px-3 pb-2 pt-1">
                Categorias
              </p>
            )}

            {/* Category list */}
            {!loading && !isSearching && categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => scrollToSection(cat.name)}
                className={`
                  w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                  ${activeCategory === cat.name
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/20'
                  }
                `}
              >
                <span className={`
                  inline-block w-1.5 h-1.5 rounded-full mr-2.5 mb-0.5 transition-colors
                  ${activeCategory === cat.name ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600'}
                `} />
                {cat.label}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0">
          {loading && (
            <div className="grid gap-5 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && isSearching && (
            <div className="space-y-5">
              <p className="text-sm text-zinc-500">
                Resultados para{' '}
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">"{searchQuery}"</span>
                {' '}— {searchResults.length} {searchResults.length === 1 ? 'item' : 'itens'}
              </p>
              {searchResults.length > 0 ? (
                <div className="grid gap-5 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {searchResults.map(product => (
                    <ProductItem key={product.id} item={product} />
                  ))}
                </div>
              ) : (
                <ProductEmpty />
              )}
            </div>
          )}

          {!loading && !isSearching && (
            productsByCategory.length > 0 ? (
              <div className="space-y-12">
                {productsByCategory.map(({ category, items }) => (
                  <section
                    key={category.id}
                    ref={el => { sectionRefs.current[category.name] = el }}
                  >
                    {/* Category header */}
                    <div className="flex items-center gap-3 mb-5">
                      <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">
                        {category.label}
                      </h2>
                      <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                        {items.length}
                      </span>
                      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                    </div>

                    <div className="grid gap-5 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.map(product => (
                        <ProductItem key={product.id} item={product} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <ProductEmpty />
            )
          )}
        </main>
      </>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // MOBILE LAYOUT — horizontal tabs + single column
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 pt-4">
      {!isSearching && categories.length > 0 && (
        <div className="relative">
          {showLeft && (
            <div className="absolute left-0 top-0 bottom-1 z-10 flex items-center">
              <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-zinc-50 dark:from-zinc-950 to-transparent pointer-events-none" />
              <button
                onClick={() => scrollTabs('left')}
                className="relative z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-sm text-zinc-600 dark:text-zinc-300"
              >
                <ChevronLeft size={15} />
              </button>
            </div>
          )}

          <div
            ref={tabsRef}
            className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {showLeft && <div className="shrink-0 w-6" />}
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => scrollToSection(cat.name)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap
                  ${activeCategory === cat.name
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
              >
                {cat.label}
              </button>
            ))}
            {showRight && <div className="shrink-0 w-6" />}
          </div>

          {showRight && (
            <div className="absolute right-0 top-0 bottom-1 z-10 flex items-center">
              <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-zinc-50 dark:from-zinc-950 to-transparent pointer-events-none" />
              <button
                onClick={() => scrollTabs('right')}
                className="relative z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-sm text-zinc-600 dark:text-zinc-300"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-zinc-400">Carregando...</p>}

      {!loading && isSearching && (
        <>
          <p className="text-sm text-zinc-500">
            Resultados para <span className="font-medium text-zinc-800 dark:text-zinc-200">"{searchQuery}"</span>
          </p>
          {searchResults.length > 0 ? (
            <div className="grid gap-4 grid-cols-2">
              {searchResults.map(product => <ProductItem key={product.id} item={product} />)}
            </div>
          ) : <ProductEmpty />}
        </>
      )}

      {!loading && !isSearching && (
        productsByCategory.length > 0 ? (
          <div className="space-y-10">
            {productsByCategory.map(({ category, items }) => (
              <section key={category.id} ref={el => { sectionRefs.current[category.name] = el }}>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">{category.label}</h2>
                  <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="grid gap-4 grid-cols-2">
                  {items.map(product => <ProductItem key={product.id} item={product} />)}
                </div>
              </section>
            ))}
          </div>
        ) : <ProductEmpty />
      )}
    </div>
  )
}