'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function AuthCallbackPage() {
  const redirected = useRef(false)

  function safeRedirect(url: string) {
    if (redirected.current) return
    redirected.current = true
    window.location.href = url
  }

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const params = new URLSearchParams(window.location.search)
    const next = params.get('next') ?? '/'

    const timeout = setTimeout(() => safeRedirect(next), 10_000)

    supabase.auth
      .exchangeCodeForSession(window.location.href)
      .then(({ data, error }) => {
        clearTimeout(timeout)
        if (error || !data.session) {
          return supabase.auth.getSession().then(() => safeRedirect(next))
        }
        safeRedirect(next)
      })
      .catch(() => {
        clearTimeout(timeout)
        supabase.auth.getSession().then(() => safeRedirect(next))
      })

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