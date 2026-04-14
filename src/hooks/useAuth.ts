'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      // Token inválido — limpa sessão corrompida
      if (error?.message?.includes('Refresh Token Not Found') ||
          error?.message?.includes('Invalid Refresh Token')) {
        supabase.auth.signOut()
        setUser(null)
        setLoading(false)
        return
      }

      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Token expirou durante a navegação
      if (event === 'SIGNED_OUT') {
        setUser(null)
        return
      }

      if (event === 'TOKEN_REFRESHED' && !session) {
        supabase.auth.signOut()
        setUser(null)
        return
      }

      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return { user, loading }
}