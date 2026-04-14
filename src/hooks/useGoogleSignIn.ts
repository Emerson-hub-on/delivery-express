'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

function getRedirectUrl() {
  if (typeof window === 'undefined') return ''
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
  const next = encodeURIComponent(window.location.pathname)
  return `${origin}/auth/callback?next=${next}`
}

export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signInWithGoogle = async (): Promise<{ name: string; email: string } | null> => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getRedirectUrl(),
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })

      if (error || !data.url) throw error ?? new Error('Sem URL de redirecionamento')

      // Sempre redireciona a aba atual — sem popup
      window.location.href = data.url
      return null
    } catch (e: any) {
      setError(e.message ?? 'Erro ao conectar com Google.')
      setLoading(false)
      return null
    }
  }

  return { signInWithGoogle, loading, error }
}