'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase' // 🔥 usa o client correto

export default function AuthCallbackPage() {
  const redirected = useRef(false)

  function safeRedirect(url: string) {
    if (redirected.current) return
    redirected.current = true
    window.location.href = url
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next') ?? '/'
    const code = params.get('code')

    const timeout = setTimeout(() => safeRedirect(next), 10_000)

    const handleAuth = async () => {
      try {
        // 🔥 troca correta do código por sessão
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error('[AuthCallback] Erro:', error.message)
          }
        }

        // 🔥 garante que a sessão foi persistida
        await supabase.auth.getSession()

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
        Buscando informações no banco de dados...
      </p>
    </div>
  )
}