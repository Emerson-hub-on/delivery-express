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
}

export const ProductSelect = ({ companyId }: Props) => {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)

  const searchQuery = useCompanyStore(s => s.searchQuery)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [data, cats] = await Promise.all([
          companyId ? getProductsByCompany(companyId) : getAllProducts(),
          companyId ? getCategoriesByCompany(companyId) : getAllCategories(),
        ])
        setProducts(data)
        setCategories(cats)
      } catch (err) {
        console.error('Erro ao carregar produtos:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [companyId])

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
    const el = tabsRef.current
    if (!el) return
    el.scrollBy({ left: direction === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  const handleCategorySelect = (categoryName: string) => {
    setActiveCategory(categoryName)

    const el = sectionRefs.current[categoryName]
    if (!el) return

    const targetY = el.getBoundingClientRect().top + window.scrollY - 80
    const startY = window.scrollY
    const distance = targetY - startY
    const duration = 800
    let startTime: number | null = null

    const easeInOut = (t: number) =>
      t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      window.scrollTo(0, startY + distance * easeInOut(progress))
      if (progress < 1) requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  }

  const isSearching = searchQuery.trim().length > 0

  const searchResults = isSearching
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  const productsByCategory = categories.map(cat => ({
    category: cat,
    items: products.filter(p => p.category === cat.name),
  })).filter(group => group.items.length > 0)

  return (
    <div className="space-y-6">

      {!isSearching && categories.length > 0 && (
        <div className="relative">
          {/* Seta esquerda */}
          {showLeft && (
            <div className="absolute left-0 top-0 bottom-1 z-10 flex items-center">
              <div className="absolute inset-y-0 left-0 w-10 bg-linear-to-r from-white dark:from-zinc-950 to-transparent pointer-events-none" />
              <button
                onClick={() => scrollTabs('left')}
                className="relative z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
            </div>
          )}

          {/* Lista de tabs */}
          <div
            ref={tabsRef}
            className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ scrollPaddingInline: '2rem' }}
          >
            {/* espaço reservado para seta esquerda */}
            {showLeft && <div className="shrink-0 w-6" />}

            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.name)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap
                  ${activeCategory === cat.name
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
              >
                {cat.label}
              </button>
            ))}

            {/* espaço reservado para seta direita */}
            {showRight && <div className="shrink-0 w-6" />}
          </div>

          {/* Seta direita */}
          {showRight && (
            <div className="absolute right-0 top-0 bottom-1 z-10 flex items-center">
              <div className="absolute inset-y-0 right-0 w-10 bg-linear-to-l from-white dark:from-zinc-950 to-transparent pointer-events-none" />
              <button
                onClick={() => scrollTabs('right')}
                className="relative z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <p>Carregando...</p>}

      {!loading && (
        <>
          {isSearching && (
            <>
              <p className="text-sm text-zinc-500">
                Resultados para{' '}
                <span className="font-medium text-zinc-800">"{searchQuery}"</span>
              </p>
              {searchResults.length > 0 ? (
                <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                  {searchResults.map(product => (
                    <ProductItem key={product.id} item={product} />
                  ))}
                </div>
              ) : (
                <ProductEmpty />
              )}
            </>
          )}

          {!isSearching && (
            productsByCategory.length > 0 ? (
              <div className="space-y-10">
                {productsByCategory.map(({ category, items }) => (
                  <section
                    key={category.id}
                    ref={el => { sectionRefs.current[category.name] = el }}
                  >
                    <h2 className="text-base font-semibold text-zinc-800 mb-4">
                      {category.label}
                    </h2>
                    <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
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
        </>
      )}
    </div>
  )
}