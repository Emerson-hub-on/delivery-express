"use client"

import { useEffect, useRef, useState } from "react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select"
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

  const searchQuery = useCompanyStore(s => s.searchQuery)
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
    } catch (err) {
      console.error('Erro ao carregar produtos:', err)
    } finally {
      setLoading(false) // sempre executa, mesmo com erro
    }
  }
  load()
}, [companyId])

  const handleCategorySelect = (categoryName: string) => {
    const el = sectionRefs.current[categoryName]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const isSearching = searchQuery.trim().length > 0

  // Durante busca: filtra todos os produtos por nome
  const searchResults = isSearching
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  // Agrupa produtos por categoria (mantendo a ordem das categorias)
  const productsByCategory = categories.map(cat => ({
    category: cat,
    items: products.filter(p => p.category === cat.name),
  })).filter(group => group.items.length > 0)

  return (
    <div className="space-y-6">

      {/* Select de categoria — só scroll, não filtra */}
      {!isSearching && categories.length > 0 && (
        <Select onValueChange={handleCategorySelect}>
          <SelectTrigger className="w-full max-w-48">
            <SelectValue placeholder="Categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Tipos</SelectLabel>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}

      {loading && <p>Carregando...</p>}

      {!loading && (
        <>
          {/* Modo busca */}
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

          {/* Modo normal: todas as categorias na mesma página */}
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