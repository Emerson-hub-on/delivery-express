'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminLoginPage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  async function verifyAndRedirect(userId: string) {
    setAuthenticated(true)

    const { data: company } = await supabase
      .from('companies')
      .select('id, slug, user_id')
      .eq('slug', params.slug)
      .maybeSingle()

    if (!company || company.user_id !== userId) {
      await supabase.auth.signOut()
      setAuthenticated(false)
      setError('Acesso negado para esta empresa.')
      setLoading(false)
      return
    }

    router.push(`/${params.slug}/admin`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.user) {
      setError('E-mail ou senha inválidos')
      setLoading(false)
      return
    }

    await verifyAndRedirect(data.user.id)
  }

  if (authenticated) {
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl w-full max-w-sm space-y-4 shadow-md">
        <h1 className="text-xl font-bold text-center text-gray-800">Admin</h1>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-black"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-200 px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-black"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg font-medium transition"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}