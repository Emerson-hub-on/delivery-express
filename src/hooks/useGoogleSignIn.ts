'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useGoogleSignIn() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signInWithGoogle = async (): Promise<null> => {
    setLoading(true)
    setError(null)

    try {
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
      // ✅ passa o pathname atual como ?next= para o callback usar
      const next = window.location.pathname

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })

      if (error || !data.url) throw error ?? new Error('Sem URL de redirecionamento')

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