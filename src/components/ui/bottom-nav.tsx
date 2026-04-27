'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Home, Search, ClipboardList, Share2, User, X, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AuthModal } from '@/components/auth/AuthModal'
import { useCompanyStore } from '@/stores/company-store'
import { signOut } from '@/services/auth'
import { toast } from 'sonner'
interface BottomNavProps {
    slug: string
    companyId: string
    onSearchOpen: () => void
}

export const BottomNav = ({ slug, companyId, onSearchOpen }: BottomNavProps) => {
    const router = useRouter()
    const { user } = useAuth()
    const [showAuth, setShowAuth] = useState(false)
    const [showPerfilDrawer, setShowPerfilDrawer] = useState(false)
    const company = useCompanyStore(s => s.company)

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({ title: company?.name, url: window.location.href })
        } else {
            navigator.clipboard.writeText(window.location.href)
        }
    }

    const handlePerfilClick = () => {
        setShowPerfilDrawer(true)
    }

    const handleLogout = async () => {
    await signOut()
    setShowPerfilDrawer(false)
    toast.success('Até logo!', { description: 'Você saiu da sua conta.' })
}

    const navItems = [
        { label: 'Início', icon: Home, onClick: () => router.push(`/${slug}`) },
        { label: 'Buscar', icon: Search, onClick: onSearchOpen },
        { label: 'Pedidos', icon: ClipboardList, onClick: () => router.push(`/${slug}/meus-pedidos`) },
        { label: 'Compartilhar', icon: Share2, onClick: handleShare },
        { label: 'Perfil', icon: User, onClick: handlePerfilClick },
    ]

    return (
        <>
            {/* Bottom nav bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 h-16 flex items-center">
                <div className="w-full max-w-2xl mx-auto flex items-center justify-around h-full px-2">
                    {navItems.map(({ label, icon: Icon, onClick }) => (
                        <button
                            key={label}
                            onClick={onClick}
                            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 active:scale-95 transition-all"
                        >
                            <Icon size={20} strokeWidth={1.8} />
                            <span className="text-[10px] font-medium leading-none">{label}</span>
                        </button>
                    ))}
                </div>
            </nav>

            {/* Spacer */}
            <div className="h-16" />

            {/* Perfil Drawer */}
            {showPerfilDrawer && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowPerfilDrawer(false)}
                    />

                    {/* Sheet */}
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-xl p-6 flex flex-col gap-4">
                        {/* Handle */}
                        <div className="w-10 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 mx-auto -mt-1 mb-1" />

                        {/* Fechar */}
                        <button
                            onClick={() => setShowPerfilDrawer(false)}
                            className="absolute top-4 right-4 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors"
                        >
                            <X size={18} />
                        </button>

                        {user ? (
                            /* Logado */
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                        <User size={20} className="text-zinc-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                                            {user.user_metadata?.full_name?.split(' ')[0]
                                                ?? user.user_metadata?.name?.split(' ')[0]
                                                ?? user.email?.split('@')[0]}
                                        </p>
                                        <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                                    </div>
                                </div>

                                <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                >
                                    <LogOut size={18} />
                                    <span className="text-sm font-medium">Sair da conta</span>
                                </button>
                            </>
                        ) : (
                            /* Não logado */
                            <>
                                <div className="text-center pb-1">
                                    <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                                        <User size={26} className="text-zinc-400" />
                                    </div>
                                    <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Olá, visitante!</p>
                                    <p className="text-xs text-zinc-400 mt-1">Entre ou crie uma conta para acompanhar seus pedidos</p>
                                </div>

                                <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

                                <button
                                    onClick={() => { setShowPerfilDrawer(false); setShowAuth(true) }}
                                    className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold hover:opacity-90 transition-opacity"
                                >
                                    Entrar
                                </button>
                                <button
                                    onClick={() => { setShowPerfilDrawer(false); setShowAuth(true) }}
                                    className="w-full py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    Criar conta
                                </button>
                            </>
                        )}
                    </div>
                </>
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