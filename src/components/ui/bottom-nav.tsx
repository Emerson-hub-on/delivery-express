'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Home, Search, ClipboardList, Share2, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AuthModal } from '@/components/auth/AuthModal'
import { useCompanyStore } from '@/stores/company-store'

interface BottomNavProps {
    slug: string
    companyId: string
    onSearchOpen: () => void
}

export const BottomNav = ({ slug, companyId, onSearchOpen }: BottomNavProps) => {
    const router = useRouter()
    const { user } = useAuth()
    const [showAuth, setShowAuth] = useState(false)
    const company = useCompanyStore(s => s.company)

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({ title: company?.name, url: window.location.href })
        } else {
            navigator.clipboard.writeText(window.location.href)
        }
    }

    const handlePerfil = () => {
        if (user) {
            router.push(`/${slug}/meus-pedidos`)
        } else {
            setShowAuth(true)
        }
    }

    const navItems = [
        {
            label: 'Início',
            icon: Home,
            onClick: () => router.push('/'),
        },
        {
            label: 'Buscar',
            icon: Search,
            onClick: onSearchOpen,
        },
        {
            label: 'Pedidos',
            icon: ClipboardList,
            onClick: () => router.push(`/${slug}/meus-pedidos`),
        },
        {
            label: 'Compartilhar',
            icon: Share2,
            onClick: handleShare,
        },
        {
            label: user ? 'Perfil' : 'Entrar',
            icon: User,
            onClick: handlePerfil,
        },
    ]

    return (
        <>
            {/* Bottom nav bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 h-16 flex items-center safe-area-pb">
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

            {/* Spacer to avoid content being hidden behind bottom nav */}
            <div className="h-16" />

            <AuthModal
                open={showAuth}
                onClose={() => setShowAuth(false)}
                onSuccess={() => setShowAuth(false)}
                companyId={companyId}
            />
        </>
    )
}
