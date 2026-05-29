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

      if (companyError) {
        setAuthenticated(false)
        setError(`Erro ao buscar empresa: ${companyError.message}`)
        setLoading(false)
        return
      }

      if (!company) {
        setAuthenticated(false)
        setError(`Empresa "${params.slug}" não encontrada. Verifique o endereço.`)
        setLoading(false)
        return
      }

      setDebugMsg(`Empresa encontrada: ${company.slug}`)

      if (company.user_id !== userId) {
        await supabase.auth.signOut()
        setAuthenticated(false)
        setError('Acesso negado para esta empresa.')
        setLoading(false)
        return
      }

      setDebugMsg('Redirecionando...')
      router.push(`/${params.slug}/admin`)

    } catch (e: any) {
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
      setError('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }

    await verifyAndRedirect(data.user.id)
  }

  const features = [
    {
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      label: 'Dashboard em tempo real',
    },
    {
      icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      label: 'Relatórios detalhados',
    },
    {
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      label: 'Acesso seguro e criptografado',
    },
  ]

  /* ── Loading screen ── */
  if (authenticated) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex flex-col items-center justify-center gap-5">
        {/* Spinner */}
        <div className="relative w-13 h-13">
          <div className="absolute inset-0 rounded-full border-[3px] border-gray-200" />
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#1a4a8a] animate-spin" />
        </div>

        <p className="text-sm font-medium text-gray-500">
          Buscando informações no banco de dados...
        </p>

        {debugMsg && (
          <p className="text-xs text-[#1a4a8a] bg-[#e8eef8] px-4 py-1 rounded-full font-mono">
            {debugMsg}
          </p>
        )}

        {error && (
          <div className="bg-white border border-red-200 rounded-xl px-5 py-4 max-w-xs text-center flex flex-col items-center gap-2 text-red-700">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm">{error}</p>
            <button
              onClick={() => { setAuthenticated(false); setError(null); setLoading(false) }}
              className="text-xs text-[#1a4a8a] underline cursor-pointer bg-transparent border-0 p-0"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    )
  }

  /* ── Main login page ── */
  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── Left panel ── */}
      <aside className="relative w-full md:w-[44%] min-h-[260px] md:min-h-screen bg-gradient-to-br from-[#0f2d5e] via-[#1a4a8a] to-[#1d5ca8] flex flex-col justify-between px-7 py-9 md:px-12 md:py-12 overflow-hidden text-white">

        {/* Dot-grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z' fill='%23fff' fill-opacity='0.04'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Decorative circles */}
        <div className="absolute w-[280px] h-[280px] rounded-full bg-white/5 -bottom-16 -right-20 pointer-events-none" aria-hidden="true" />
        <div className="absolute w-[150px] h-[150px] rounded-full bg-white/[0.06] top-10 -right-8 pointer-events-none" aria-hidden="true" />
        <div className="absolute w-[60px] h-[60px] rounded-full bg-white/[0.08] top-44 right-14 pointer-events-none" aria-hidden="true" />

        {/* Content */}
        <div className="relative z-10">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-12 md:mb-16">
            <div className="w-10 h-10 rounded-[10px] bg-white/[0.13] flex items-center justify-center" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="7" fill="white" fillOpacity="0.15" />
                <path d="M7 21L14 7l7 14H7z" fill="white" fillOpacity="0.9" />
                <circle cx="14" cy="12" r="2.5" fill="white" />
              </svg>
            </div>
            <span className="text-[17px] font-bold tracking-tight">GestãoPro</span>
          </div>

          {/* Hero text */}
          <h1 className="text-[32px] md:text-[38px] font-bold leading-[1.15] tracking-tight text-white mb-4">
            Painel<br />Administrativo
          </h1>
          <p className="text-[14px] text-white/60 leading-relaxed mb-10 max-w-[260px] hidden md:block">
            Gerencie sua operação com eficiência e segurança em um único lugar.
          </p>

          {/* Feature list */}
          <ul className="hidden md:flex flex-col gap-4" aria-label="Recursos da plataforma">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-[13px] text-white/80">
                <svg
                  width="17" height="17"
                  viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"
                  className="shrink-0 opacity-70"
                  aria-hidden="true"
                >
                  <path d={f.icon} />
                </svg>
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="relative z-10 hidden md:flex gap-2 text-[11px] text-white/30">
          <span>© {new Date().getFullYear()} GestãoPro</span>
          <span>·</span>
          <span>v2.4.1</span>
        </div>
      </aside>

      {/* ── Right panel ── */}
      <main className="flex-1 bg-[#f4f6f9] flex items-center justify-center px-6 py-10 md:px-10">
        <div className="w-full max-w-95">

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 bg-[#1a4a8a]/10 text-[#1a4a8a] text-[11px] font-semibold rounded-full px-3 py-1 mb-6">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Área restrita
          </div>

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-[#e8eef8] flex items-center justify-center text-[#1a4a8a] shrink-0" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-gray-900 tracking-tight leading-tight mb-0.5">
                Entrar na conta
              </h2>
              <p className="text-[13px] text-gray-500">Acesso restrito a administradores</p>
            </div>
          </div>

          {/* Error alert */}
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-[13px] text-red-700 mb-5"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 4.5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                E-mail
              </label>
              <div className="relative flex items-center">
                <svg
                  className="absolute left-3 text-gray-400 pointer-events-none shrink-0"
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={loading}
                  className="w-full h-11 pl-10 pr-3.5 border border-gray-200 rounded-[10px] text-sm text-gray-900 bg-white placeholder-gray-300 outline-none transition-all duration-150 focus:border-[#1a4a8a] focus:ring-2 focus:ring-[#1a4a8a]/10 hover:border-gray-300 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                Senha
              </label>
              <div className="relative flex items-center">
                <svg
                  className="absolute left-3 text-gray-400 pointer-events-none shrink-0"
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  className="w-full h-11 pl-10 pr-3.5 border border-gray-200 rounded-[10px] text-sm text-gray-900 bg-white placeholder-gray-300 outline-none transition-all duration-150 focus:border-[#1a4a8a] focus:ring-2 focus:ring-[#1a4a8a]/10 hover:border-gray-300 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full h-[46px] mt-1 bg-gradient-to-br from-[#1a4a8a] to-[#2563eb] text-white rounded-[10px] text-[15px] font-semibold flex items-center justify-center gap-2 transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0"
                    aria-hidden="true"
                  />
                  Verificando...
                </>
              ) : (
                <>
                  Entrar
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Secure note */}
          <p className="flex items-center justify-center gap-1.5 text-[12px] text-gray-400 mt-5" aria-label="Informação de segurança">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Conexão segura · SSL/TLS
          </p>
        </div>
      </main>
    </div>
  )
}