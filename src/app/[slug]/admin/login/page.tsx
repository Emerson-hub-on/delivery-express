'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminLoginPage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [debugMsg, setDebugMsg]     = useState<string | null>(null)

  async function verifyAndRedirect(userId: string) {
    setAuthenticated(true)
    setDebugMsg('Verificando empresa...')

    try {
      // Timeout de segurança: se demorar mais de 8s, mostra erro
      const timeoutId = setTimeout(() => {
        setAuthenticated(false)
        setError('Tempo esgotado ao buscar empresa. Verifique a conexão.')
        setLoading(false)
      }, 8000)

      setDebugMsg(`Buscando slug: "${params.slug}"`)

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, slug, user_id')
        .eq('slug', params.slug)
        .maybeSingle()

      clearTimeout(timeoutId)

      // Erro de query
      if (companyError) {
        console.error('[Login] Erro ao buscar company:', companyError)
        setAuthenticated(false)
        setError(`Erro ao buscar empresa: ${companyError.message}`)
        setLoading(false)
        return
      }

      // Empresa não encontrada
      if (!company) {
        console.warn('[Login] Empresa não encontrada para slug:', params.slug)
        setAuthenticated(false)
        setError(`Empresa "${params.slug}" não encontrada. Verifique o endereço.`)
        setLoading(false)
        return
      }

      console.log('[Login] Company encontrada:', company)
      setDebugMsg(`Empresa encontrada: ${company.slug}`)

      // user_id não bate
      if (company.user_id !== userId) {
        console.warn('[Login] user_id não bate. company.user_id:', company.user_id, '| userId:', userId)
        await supabase.auth.signOut()
        setAuthenticated(false)
        setError('Acesso negado para esta empresa.')
        setLoading(false)
        return
      }

      // Tudo certo — redireciona
      setDebugMsg('Redirecionando...')
      router.push(`/${params.slug}/admin`)

    } catch (e: any) {
      console.error('[Login] Exceção em verifyAndRedirect:', e)
      setAuthenticated(false)
      setError(e.message || 'Erro inesperado ao verificar empresa.')
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setDebugMsg(null)

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
        {/* Mensagem de debug — remova após resolver */}
        {debugMsg && (
          <p className="text-xs text-indigo-400 font-mono bg-indigo-50 px-3 py-1 rounded-full">
            {debugMsg}
          </p>
        )}
        {/* Erro que aparece mesmo na tela de loading */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 max-w-sm text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => { setAuthenticated(false); setError(null); setLoading(false) }}
              className="mt-2 text-xs text-red-400 underline"
            >
              Tentar novamente
            </button>
          </div>
        )}
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
