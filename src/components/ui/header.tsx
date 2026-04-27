'use client'
import { CartSidebar } from "../cart/sidebar"
import { Logo } from "./logo"
import { ThemeToggle } from "./theme-toggle"
import { useAuth } from "@/hooks/useAuth"
import { signOut } from '@/services/auth'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { AuthModal } from '@/components/auth/AuthModal'
import { X, Menu } from 'lucide-react'
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
        toast.success('Produto adicionado ao carrinho!', { description: product.name })
        onClose()
    }

    if (loading) return (
        <div className="px-4 py-3 text-sm text-zinc-400 border-t border-zinc-100">
            Buscando...
        </div>
    )

    if (filtered.length === 0) return (
        <div className="px-4 py-3 text-sm text-zinc-400 border-t border-zinc-100">
            Nenhum produto encontrado para "{query}"
        </div>
    )

    return (
        <div className="max-h-72 overflow-y-auto border-t border-zinc-100 divide-y divide-zinc-100">
            {filtered.map(product => (
                <button
                    key={product.id}
                    onClick={() => handleAdd(product)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
                >
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-zinc-100 shrink-0">
                        {product.image ? (
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-zinc-200" />
                        )}
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

    const handleLogout = async () => {
        await signOut()
        setMenuOpen(false)
    }

    const handleCloseSearch = () => {
        setSearchOpen(false)
        setSearchQuery('')
    }

    return (
        <>
            {/* ═══════════════════════════════════════════
                DESKTOP (md+) — navbar + banner
            ════════════════════════════════════════════ */}
            <div className="hidden md:block">
                {/* Navbar */}
                <header className="w-full h-16 flex items-center border-b border-zinc-200 bg-white sticky top-0 z-40 shadow-sm">
                    <div className="w-full max-w-7xl mx-auto px-6 flex items-center gap-4">
                        <button
                            onClick={() => setMenuOpen(v => !v)}
                            className="p-2 rounded-lg text-zinc-600 hover:bg-zinc-100 transition-colors"
                        >
                            {menuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>

                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 shrink-0 flex items-center justify-center">
                                <Logo />
                            </div>
                            <div className="min-w-0">
                                <p className="font-semibold text-sm text-zinc-900 truncate leading-tight">
                                    {company?.name ?? 'Cardápio'}
                                </p>
                                {company?.minOrder ? (
                                    <p className="text-xs text-zinc-400 leading-tight">
                                        Pedido mínimo: R$ {company.minOrder.toFixed(2)}
                                    </p>
                                ) : (
                                    <p className="text-xs text-zinc-400 leading-tight">Entrega rápida e segura</p>
                                )}
                            </div>
                        </div>

                        <div className="flex-1" />

                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-full px-2.5 py-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${company?.isOpen ? 'bg-green-500' : 'bg-red-400'}`} />
                            {company?.isOpen ? 'Aberto' : 'Fechado'}
                        </span>

                        {!loading && !user && (
                            <button
                                onClick={() => setShowAuth(true)}
                                className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors px-2"
                            >
                                Entrar
                            </button>
                        )}

                        <CartSidebar />
                    </div>
                </header>

                {/* Banner desktop */}
                <div className="relative w-full h-64 bg-zinc-200 overflow-hidden mb-6">
                    {company?.bannerUrl && (
                        <img
                            src={company.bannerUrl}
                            alt="Banner da loja"
                            className="w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>

                {/* Dropdown menu desktop */}
                {menuOpen && (
                    <div className="fixed top-16 left-4 w-64 bg-white shadow-lg border border-zinc-100 rounded-2xl z-50 p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-600">Tema</span>
                            <ThemeToggle />
                        </div>
                        <div className="h-px bg-zinc-100" />
                        {!loading && user && (
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="text-sm text-green-600 font-medium truncate">
                                        {user.user_metadata?.full_name?.split(' ')[0]
                                            ?? user.user_metadata?.name?.split(' ')[0]
                                            ?? user.email?.split('@')[0]}
                                    </span>
                                </div>
                                <Link href={`/${slug}/meus-pedidos`} onClick={() => setMenuOpen(false)}
                                    className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
                                    Meus pedidos
                                </Link>
                                <button onClick={handleLogout}
                                    className="text-left text-sm text-red-500 hover:text-red-600 transition-colors">
                                    Sair
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════
                MOBILE (< md) — banner + store card + bottom nav
            ════════════════════════════════════════════ */}
            <div className="md:hidden">
                {/* Banner mobile */}
                <div className="relative w-full h-52 bg-zinc-200 overflow-hidden">
                    {company?.bannerUrl && (
                        <img
                            src={company.bannerUrl}
                            alt="Banner da loja"
                            className="w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute top-3 left-3 z-10">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-white/80 backdrop-blur-sm text-zinc-700 rounded-full px-2.5 py-1 shadow-sm">
                            <span className={`w-1.5 h-1.5 rounded-full ${company?.isOpen ? 'bg-green-500' : 'bg-red-400'}`} />
                            {company?.isOpen ? 'Aberto' : 'Fechado'}
                        </span>
                    </div>
                </div>

                {/* Store card */}
                <div className="max-w-2xl mx-auto w-full px-4 -mt-6 z-10 relative pb-5">
                    <div className="bg-white rounded-2xl shadow-md px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-zinc-200 bg-zinc-100 shrink-0 flex items-center justify-center">
                                <Logo />
                            </div>
                            <div className="min-w-0">
                                <span className="font-bold text-sm text-zinc-800 truncate block">
                                    {company?.name ?? 'Cardápio'}
                                </span>
                                {company?.minOrder ? (
                                    <span className="text-xs text-zinc-400">
                                        Pedido mínimo: R$ {company.minOrder.toFixed(2)}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <div className="shrink-0">
                            <CartSidebar />
                        </div>
                    </div>
                </div>

                {/* Bottom nav */}
                <BottomNav
                    slug={slug}
                    companyId={companyId}
                    onSearchOpen={() => setSearchOpen(true)}
                />
            </div>

            {/* ═══════════════════════════════════════════
                SEARCH OVERLAY — compartilhado
            ════════════════════════════════════════════ */}
            {searchOpen && (
                <div className="fixed inset-0 z-50 flex flex-col bg-white">
                    <div className="flex items-center px-3 gap-2 h-14 shrink-0 border-b border-zinc-100">
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
                            className="flex-1 min-w-0 bg-zinc-100 text-sm text-zinc-800 placeholder-zinc-400 rounded-full px-4 py-2 outline-none border-none"
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