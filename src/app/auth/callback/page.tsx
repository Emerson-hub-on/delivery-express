'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function AuthCallbackPage() {
  const redirected = useRef(false)

  function safeRedirect(url: string) {
    if (redirected.current) return
    redirected.current = true
    window.location.href = url
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    const next =
      params.get('next') ??
      sessionStorage.getItem('auth_next') ??
      '/'
    sessionStorage.removeItem('auth_next')

    const timeout = setTimeout(() => safeRedirect(next), 10_000)

    const handleAuth = async () => {
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('[AuthCallback] Erro:', error.message)
            toast.error('Erro ao autenticar', { description: 'Tente novamente.' })
            safeRedirect(next)
            return
          }
        }

        const { data } = await supabase.auth.getSession()
        const name =
          data.session?.user?.user_metadata?.full_name?.split(' ')[0] ??
          data.session?.user?.email?.split('@')[0] ??
          'por aqui'

        // ✅ Feedback de sucesso — o toast aparece brevemente antes do redirect
        toast.success(`Bem-vindo, ${name}! 👋`, {
          description: 'Login realizado com sucesso.',
          duration: 2000,
        })

        // Pequena pausa para o toast aparecer antes de redirecionar
        await new Promise(r => setTimeout(r, 1200))
        safeRedirect(next)
      } catch (err) {
        console.error('[AuthCallback] Exception:', err)
        safeRedirect(next)
      } finally {
        clearTimeout(timeout)
      }
    }

    handleAuth()
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
        <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
      </div>
      <p className="text-sm text-gray-500 font-medium tracking-wide">
        Autenticando sua conta...
      </p>
    </div>
  )
}