'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from "@/hooks/useAuth";
import { signOut } from '@/services/auth'
import { MyOrdersList } from "@/components/orders/MyOrdersList";
import { AuthModal } from '@/components/auth/AuthModal'
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase'
import { BottomNav } from '@/components/ui/bottom-nav'
import { Phone, Pencil, Check, X } from 'lucide-react'

function maskPhone(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

export default function MeusPedidosPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const [showAuth, setShowAuth] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // ── Telefone ──────────────────────────────────────────────
  const [savedPhone, setSavedPhone] = useState<string | null>(null)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneSaving, setPhoneSaving] = useState(false)

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

  // Busca telefone do cliente
  useEffect(() => {
    if (!user || !companyId) return
    supabase
      .from('customers')
      .select('phone')
      .eq('id', user.id)
      .eq('company_id', companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.phone) setSavedPhone(data.phone)
      })
  }, [user?.id, companyId])

  useEffect(() => {
    if (!loading && !user && companyId) setShowAuth(true)
  }, [loading, user, companyId])

  const handleLogout = async () => {
    await signOut()
    router.push(`/${params.slug}`)
  }

  const handleSavePhone = async () => {
    const digits = phoneInput.replace(/\D/g, '')
    if (digits.length < 10) {
      setPhoneError('Telefone inválido')
      return
    }
    if (!user || !companyId) return

    setPhoneSaving(true)
    setPhoneError(null)

    const { error } = await supabase
      .from('customers')
      .update({ phone: phoneInput })
      .eq('id', user.id)
      .eq('company_id', companyId)

    setPhoneSaving(false)

    if (error) {
      setPhoneError('Erro ao salvar. Tente novamente.')
    } else {
      setSavedPhone(phoneInput)
      setEditingPhone(false)
      setPhoneInput('')
    }
  }

  const handleStartEdit = () => {
    setPhoneInput(savedPhone ?? '')
    setPhoneError(null)
    setEditingPhone(true)
  }

  const handleCancelEdit = () => {
    setEditingPhone(false)
    setPhoneInput('')
    setPhoneError(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
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
          <>
            {/* ── Card de telefone ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 mb-4">
              <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-3">
                Telefone
              </p>

              {!editingPhone ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Phone size={16} className="text-gray-400 shrink-0" />
                    {savedPhone ? (
                      <p className="text-sm text-gray-800">{savedPhone}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Nenhum telefone cadastrado</p>
                    )}
                  </div>
                  <button
                    onClick={handleStartEdit}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors shrink-0"
                  >
                    <Pencil size={12} />
                    {savedPhone ? 'Alterar' : 'Cadastrar'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      type="tel"
                      placeholder="(83) 99999-9999"
                      value={phoneInput}
                      onChange={e => {
                        setPhoneInput(maskPhone(e.target.value))
                        setPhoneError(null)
                      }}
                      className="flex-1"
                    />
                    <button
                      onClick={handleSavePhone}
                      disabled={phoneSaving}
                      className="p-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {phoneError && (
                    <p className="text-xs text-red-500">{phoneError}</p>
                  )}
                </div>
              )}
            </div>

            <MyOrdersList />
          </>
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
        <>
          <AuthModal
            open={showAuth}
            onClose={() => setShowAuth(false)}
            onSuccess={() => setShowAuth(false)}
            companyId={companyId}
          />
          <BottomNav
            slug={params.slug}
            companyId={companyId}
            onSearchOpen={() => setSearchOpen(true)}
          />
        </>
      )}
    </div>
  )
}