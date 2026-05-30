'use client'
import { CartSidebar } from "../cart/sidebar"
import { Logo } from "./logo"
import { ThemeToggle } from "./theme-toggle"
import { useAuth } from "@/hooks/useAuth"
import { signOut } from '@/services/auth'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { AuthModal } from '@/components/auth/AuthModal'
import { X, Search, Clock, ShoppingBag, UserCircle2 } from 'lucide-react'
import { useCompanyStore } from '@/stores/company-store'
import { getProductsByCompany } from '@/services/product'
import { Product } from '@/types/product'
import { useCartStore } from '@/stores/cart-store'
import { toast } from 'sonner'
import { BottomNav } from './bottom-nav'

interface HeaderProps {
  slug: string
  companyId: string
}

interface SearchResultsProps {
  query: string
  companyId: string
  onClose: () => void
}

const SearchResults = ({ query, companyId, onClose }: SearchResultsProps) => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const { upsertCartItem } = useCartStore(s => s)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const data = await getProductsByCompany(companyId)
      setProducts(data)
      setLoading(false)
    }
    load()
  }, [companyId])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  )

  const handleAdd = (product: Product) => {
    upsertCartItem(product, 1)
    toast.success('Adicionado ao carrinho!', {
      description: product.name,
      action: { label: 'Ver carrinho', onClick: () => window.dispatchEvent(new Event('open-cart')) },
    })
    onClose()
  }

  if (loading) return (
    <div className="px-4 py-3 text-sm text-zinc-400 border-t border-zinc-100">Buscando...</div>
  )

  if (filtered.length === 0) return (
    <div className="px-4 py-3 text-sm text-zinc-400 border-t border-zinc-100">
      Nenhum produto encontrado para "{query}"
    </div>
  )

  return (
    <div className="max-h-72 overflow-y-auto border-t border-zinc-100 divide-y divide-zinc-100">
      {filtered.map(product => (
        <button key={product.id} onClick={() => handleAdd(product)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors text-left">
          <div className="w-10 h-10 rounded-md overflow-hidden bg-zinc-100 shrink-0">
            {product.image
              ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-zinc-200" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-800 truncate">{product.name}</p>
            <p className="text-xs text-zinc-500 mt-0.5">R$ {product.price.toFixed(2)}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

export const Header = ({ slug, companyId }: HeaderProps) => {
  const { user, loading } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const company = useCompanyStore(s => s.company)
  const searchQuery = useCompanyStore(s => s.searchQuery)
  const setSearchQuery = useCompanyStore(s => s.setSearchQuery)

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const handleLogout = async () => { await signOut(); setMenuOpen(false) }
  const handleCloseSearch = () => { setSearchOpen(false); setSearchQuery('') }

  return (
    <>
      {/* ════════════════════════════════════════════════
          DESKTOP (md+)
      ════════════════════════════════════════════════ */}
      <div className="hidden md:block">

        {/* ── Sticky top navbar ── */}
        <header className="w-full h-14 flex items-center bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md
          border-b border-zinc-200/80 dark:border-zinc-800 sticky top-0 z-40 shadow-sm">
          <div className="w-full max-w-7xl mx-auto px-6 flex items-center gap-4">

            {/* Profile button */}
            <button
              onClick={() => loading ? null : user ? setMenuOpen(v => !v) : setShowAuth(true)}
              className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-zinc-200 dark:border-zinc-700
                hover:border-red-400 dark:hover:border-red-500 transition-all shrink-0 bg-zinc-100 dark:bg-zinc-800
                flex items-center justify-center"
              title={user ? 'Minha conta' : 'Entrar'}
            >
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={`https://www.gravatar.com/avatar/${btoa(user.email ?? '')}?d=mp&s=72`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              ) : null}
              {/* Fallback icon always rendered underneath */}
              <UserCircle2
                size={22}
                className={`absolute text-zinc-400 dark:text-zinc-500 ${user ? 'opacity-0' : 'opacity-100'}`}
              />
              {user && !user?.user_metadata?.avatar_url && (
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase">
                  {(user.email ?? '?')[0]}
                </span>
              )}
            </button>

            <div className="flex-1" />

            {/* Search bar (desktop inline) */}
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar no cardápio..."
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-800
                  text-zinc-800 dark:text-zinc-200 placeholder-zinc-400
                  focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:bg-white dark:focus:bg-zinc-900
                  border border-transparent focus:border-red-400/50 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Status pill */}
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1
              ${company?.isOpen
                ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${company?.isOpen ? 'bg-green-500' : 'bg-red-400'}`} />
              {company?.isOpen ? 'Aberto agora' : 'Fechado'}
            </span>

            <CartSidebar />
          </div>
        </header>

        {/* ── Hero banner ── */}
        <div className="relative w-full h-72 bg-zinc-900 overflow-hidden">
          {company?.bannerUrl ? (
            <img src={company.bannerUrl} alt="Banner da loja"
              className="w-full h-full object-cover opacity-80" />
          ) : (
            /* Subtle geometric fallback */
            <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-zinc-950/10 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/30 to-transparent" />

          {/* Store info overlay — bottom left */}
          <div className="absolute bottom-0 left-0 right-0">
            <div className="max-w-7xl mx-auto px-6 pb-6 flex items-end justify-between">
              <div className="flex items-end gap-4">
                {/* Logo avatar */}
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/20 bg-zinc-800 shadow-xl shrink-0 flex items-center justify-center mb-0.5">
                  <Logo />
                </div>
                <div className="pb-1">
                  <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">
                    {company?.name ?? 'Cardápio'}
                  </h1>
                  <div className="flex items-center gap-3 mt-1">
                    {company?.minOrder ? (
                      <span className="flex items-center gap-1 text-xs text-white/70">
                        <ShoppingBag size={11} />
                        Pedido mínimo: R$ {company.minOrder.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-white/60">Entrega rápida e segura</span>
                    )}
                    <span className="text-white/30">·</span>
                    <span className="flex items-center gap-1 text-xs text-white/70">
                      <Clock size={11} />
                      Seg – Dom
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dropdown menu */}
        {menuOpen && user && (
          <div className="fixed top-14 left-4 w-56 bg-white dark:bg-zinc-900 shadow-xl border border-zinc-100 dark:border-zinc-800 rounded-2xl z-50 p-4 flex flex-col gap-3">
            {/* User info */}
            <div className="flex items-center gap-2.5 pb-1">
              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase">
                  {(user.email ?? '?')[0]}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
                  {user.user_metadata?.full_name?.split(' ')[0]
                    ?? user.user_metadata?.name?.split(' ')[0]
                    ?? user.email?.split('@')[0]}
                </p>
                <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>
              </div>
            </div>
            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Tema</span>
              <ThemeToggle />
            </div>
            <Link href={`/${slug}/meus-pedidos`} onClick={() => setMenuOpen(false)}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Meus pedidos
            </Link>
            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />
            <button onClick={handleLogout}
              className="text-left text-sm text-red-500 hover:text-red-600 transition-colors">
              Sair da conta
            </button>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════
          MOBILE (< md)
      ════════════════════════════════════════════════ */}
      <div className="md:hidden">
        <div className="relative w-full h-52 bg-zinc-200 overflow-hidden">
          {company?.bannerUrl && (
            <img src={company.bannerUrl} alt="Banner da loja" className="w-full h-full object-cover" />
          )}
          <div className="absolute top-3 left-3 z-10">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium bg-white/80 backdrop-blur-sm
              text-zinc-700 rounded-full px-2.5 py-1 shadow-sm`}>
              <span className={`w-1.5 h-1.5 rounded-full ${company?.isOpen ? 'bg-green-500' : 'bg-red-400'}`} />
              {company?.isOpen ? 'Aberto' : 'Fechado'}
            </span>
          </div>
        </div>

        <div className="max-w-2xl mx-auto w-full px-4 -mt-6 z-10 relative pb-5">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-md px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-100 shrink-0 flex items-center justify-center">
                <Logo />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100 truncate block">
                  {company?.name ?? 'Cardápio'}
                </span>
                {company?.minOrder ? (
                  <span className="text-xs text-zinc-400">
                    Pedido mínimo: R$ {company.minOrder.toFixed(2)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="shrink-0"><CartSidebar /></div>
          </div>
        </div>

        <BottomNav slug={slug} companyId={companyId} onSearchOpen={() => setSearchOpen(true)} />
      </div>

      {/* ════════════════════════════════════════════════
          SEARCH OVERLAY (shared)
      ════════════════════════════════════════════════ */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950">
          <div className="flex items-center px-3 gap-2 h-14 shrink-0 border-b border-zinc-100 dark:border-zinc-800">
            <button onClick={handleCloseSearch}
              className="p-1 text-zinc-500 hover:text-zinc-800 transition-colors shrink-0">
              <X size={20} />
            </button>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar produtos..."
              className="flex-1 min-w-0 bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200
                placeholder-zinc-400 rounded-full px-4 py-2 outline-none border-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors shrink-0">
                <X size={16} />
              </button>
            )}
          </div>
          {searchQuery.trim().length > 0 && (
            <SearchResults query={searchQuery} companyId={companyId} onClose={handleCloseSearch} />
          )}
        </div>
      )}

      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => setShowAuth(false)}
        companyId={companyId}
      />
    </>
  )
}