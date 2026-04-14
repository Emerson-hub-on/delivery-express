'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next') ?? '/'

    supabase.auth.exchangeCodeForSession(window.location.href).then(({ data }) => {
      const email = data.session?.user?.email ?? ''
      window.location.href = `${next}?auth_success=${encodeURIComponent(email)}`
    }).catch(() => {
      window.location.href = next
    })
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