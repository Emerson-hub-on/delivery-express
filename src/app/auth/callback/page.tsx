'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const redirected = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next') ?? '/'

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (redirected.current) return

      if (event === 'SIGNED_IN' && session) {
        redirected.current = true
        subscription.unsubscribe()
        window.location.href = next
      }
    })

    supabase.auth.exchangeCodeForSession(window.location.href).catch(() => {
      if (!redirected.current) {
        redirected.current = true
        subscription.unsubscribe()
        window.location.href = next
      }
    })

    return () => subscription.unsubscribe()
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