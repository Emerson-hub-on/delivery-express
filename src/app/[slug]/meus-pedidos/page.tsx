'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from "@/hooks/useAuth";
import { signOut } from '@/services/auth'
import { MyOrdersList } from "@/components/orders/MyOrdersList";
import { AuthModal } from '@/components/auth/AuthModal'
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase'

export default function MeusPedidosPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const [showAuth, setShowAuth] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCompany() {
      const { data } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', params.slug)
        .maybeSingle()
      if (data) setCompanyId(data.id)
    }
    fetchCompany()
  }, [params.slug])

  useEffect(() => {
    if (!loading && !user && companyId) setShowAuth(true)
  }, [loading, user, companyId])

  const handleLogout = async () => {
    await signOut()
    router.push(`/${params.slug}`)  // ← redireciona para o cardápio da empresa
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button>
              <Link href={`/${params.slug}`} className="text-xs text-gray-50 hover:text-gray-600 mb-1 block">
                ← Voltar ao cardápio
              </Link>
            </Button>
            <h1 className="text-xl font-semibold text-gray-900">Meus pedidos</h1>
            {user?.email && (
              <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
            )}
          </div>
          {user && (
            <Button
              onClick={handleLogout}
              className="text-xs text-gray-50 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sair
            </Button>
          )}
        </div>

        {user ? (
          <MyOrdersList />
        ) : (
          <div className="text-center py-16 text-gray-400 text-sm">
            Faça login para ver seus pedidos.
            <br />
            <button
              onClick={() => setShowAuth(true)}
              className="mt-3 underline text-gray-600"
            >
              Entrar / Criar conta
            </button>
          </div>
        )}
      </div>

      {companyId && (
        <AuthModal
          open={showAuth}
          onClose={() => setShowAuth(false)}
          onSuccess={() => setShowAuth(false)}
          companyId={companyId}
        />
      )}
    </div>
  )
}