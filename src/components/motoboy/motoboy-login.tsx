'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Motoboy } from '@/types/motoboy'

interface MotoboyLoginProps {
  onLogin: (motoboy: Motoboy) => void
}

export function MotoboyLogin({ onLogin }: MotoboyLoginProps) {
  const [name, setName]         = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()

    if (!trimmedName || !password) {
      setError('Preencha nome e senha.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Busca por nome (case-insensitive) + ativo
      const { data, error: dbError } = await supabase
        .from('motoboys')
        .select('*')
        .ilike('name', trimmedName)
        .eq('active', true)

      if (dbError) throw new Error(dbError.message)

      // Verifica a senha em texto puro (campo password da tabela)
      const match = (data ?? []).find(
        (m: any) => m.password === password
      )

      if (!match) {
        setError('Nome ou senha incorretos, ou motoboy inativo.')
        return
      }

      onLogin(match as Motoboy)
    } catch (e: any) {
      setError(e.message || 'Erro ao fazer login.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500 mb-4 shadow-lg shadow-orange-500/30">
            <span className="text-2xl">🛵</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Área do Motoboy</h1>
          <p className="text-sm text-gray-400 mt-1">Entre com seu nome e senha cadastrados</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Nome */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nome</label>
              <input
                value={name}
                onChange={e => { setName(e.target.value); setError(null) }}
                placeholder="Seu nome completo"
                autoComplete="name"
                className="bg-gray-800 border border-gray-700 text-white placeholder-gray-600 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500 transition-all"
              />
            </div>

            {/* Senha */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Senha</label>
              <div className="relative">
                <input
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null) }}
                  placeholder="••••••••"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 text-sm rounded-xl px-4 py-3 pr-11 focus:outline-none focus:ring-2 focus:ring-orange-500/60 focus:border-orange-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-sm"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20 mt-2"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Problemas para entrar? Fale com o administrador.
        </p>
      </div>
    </div>
  )
}
