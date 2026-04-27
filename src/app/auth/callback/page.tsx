'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CheckCircle } from 'lucide-react'

export default function AuthCallbackPage() {
  const redirected = useRef(false)
  const [success, setSuccess] = useState(false)

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
            safeRedirect(next)
            return
          }
        }

        await supabase.auth.getSession()

        // ✅ Troca para tela de sucesso
        setSuccess(true)
        await new Promise(r => setTimeout(r, 1500))
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

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
          <CheckCircle size={36} className="text-green-500" />
        </div>
        <p className="text-base font-semibold text-gray-800">Autenticado com sucesso!</p>
        <p className="text-sm text-gray-400">Redirecionando...</p>
      </div>
    )
  }

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