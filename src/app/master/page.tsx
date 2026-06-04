'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Company {
  id: string
  name: string
  email: string
  slug: string
  created_at: string
  mp_public_key: string | null
  mp_secret_key: string | null
  pdv_limit: number
}

export default function MasterPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pdvLimit, setPdvLimit] = useState(1)
  const [creating, setCreating] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editMpPublicKey, setEditMpPublicKey] = useState('')
  const [editMpSecretKey, setEditMpSecretKey] = useState('')
  const [editPdvLimit, setEditPdvLimit] = useState(1)
  const [saving, setSaving] = useState(false)
  const [editSuccess, setEditSuccess] = useState(false)

  useEffect(() => { fetchCompanies() }, [])

  async function fetchCompanies() {
    setLoading(true)
    const res = await fetch('/master/api/companies')
    if (res.status === 401) { router.push('/master/login'); return }
    const data = await res.json()
    setCompanies(data)
    setLoading(false)
  }

  function handleNameChange(value: string) {
    setName(value)
    setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    setCreateSuccess(false)

    const res = await fetch('/master/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, slug, pdv_limit: pdvLimit }),
    })

    if (res.ok) {
      setCreateSuccess(true)
      setName(''); setEmail(''); setPassword(''); setSlug(''); setPdvLimit(1)
      fetchCompanies()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Erro ao criar empresa')
    }
    setCreating(false)
  }

  function handleStartEdit(company: Company) {
    setEditingId(company.id)
    setEditName(company.name)
    setEditEmail(company.email)
    setEditSlug(company.slug)
    setEditPassword('')
    setEditMpPublicKey(company.mp_public_key ?? '')
    setEditMpSecretKey(company.mp_secret_key ?? '')
    setEditPdvLimit(company.pdv_limit ?? 1)
    setEditSuccess(false)
    setError(null)
  }

  function handleCancelEdit() {
    setEditingId(null)
    setEditName(''); setEditEmail(''); setEditSlug('')
    setEditPassword(''); setEditMpPublicKey(''); setEditMpSecretKey('')
    setEditPdvLimit(1)
    setError(null)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setEditSuccess(false)

    const res = await fetch('/master/api/companies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:            editingId,
        name:          editName,
        email:         editEmail,
        slug:          editSlug,
        password:      editPassword || undefined,
        mp_public_key: editMpPublicKey,
        mp_secret_key: editMpSecretKey,
        pdv_limit:     editPdvLimit,
      }),
    })

    if (res.ok) {
      setEditSuccess(true)
      setEditingId(null)
      fetchCompanies()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Erro ao salvar')
    }
    setSaving(false)
  }

  async function handleLogout() {
    await fetch('/master/api/logout', { method: 'POST' })
    router.push('/master/login')
  }

  const inputCls = 'bg-gray-800 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-full'

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Master Admin</h1>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white transition">
            Sair
          </button>
        </div>

        {/* ── Criar empresa ── */}
        <div className="bg-gray-900 p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold">Nova Empresa</h2>

          {error && !editingId && <p className="text-red-400 text-sm">{error}</p>}
          {createSuccess && <p className="text-green-400 text-sm">Empresa criada com sucesso!</p>}

          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                placeholder="Nome da empresa"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                className={inputCls}
                required
              />
              <input
                placeholder="Slug (ex: minha-empresa)"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className={inputCls}
                required
              />
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputCls}
                required
              />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputCls}
                required
              />
            </div>

            {/* PDV Limit */}
            <div className="border-t border-gray-800 pt-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
                Limite de PDVs
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={pdvLimit}
                  onChange={e => setPdvLimit(Math.max(1, Number(e.target.value)))}
                  className="bg-gray-800 px-3 py-2 rounded-lg outline-none focus:ring-2
                    focus:ring-indigo-500 text-sm w-24 text-center"
                />
                <p className="text-xs text-gray-500">
                  PDVs NFC-e que esta empresa pode cadastrar
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                py-2 rounded-lg font-medium transition"
            >
              {creating ? 'Criando...' : 'Criar Empresa'}
            </button>
          </form>
        </div>

        {/* ── Lista de empresas ── */}
        <div className="bg-gray-900 p-6 rounded-xl">
          <h2 className="text-lg font-semibold mb-4">Empresas cadastradas</h2>

          {loading ? (
            <p className="text-gray-400 text-sm">Carregando...</p>
          ) : companies.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhuma empresa cadastrada ainda.</p>
          ) : (
            <div className="space-y-3">
              {companies.map(c => (
                <div key={c.id} className="border border-gray-800 rounded-lg p-4">

                  {editingId === c.id ? (
                    <form onSubmit={handleSaveEdit} className="space-y-3">
                      {error && <p className="text-red-400 text-sm">{error}</p>}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          placeholder="Nome"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className={inputCls}
                          required
                        />
                        <input
                          placeholder="Slug"
                          value={editSlug}
                          onChange={e => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          className={inputCls}
                          required
                        />
                        <input
                          type="email"
                          placeholder="E-mail"
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          className={inputCls}
                          required
                        />
                        <input
                          type="password"
                          placeholder="Nova senha (deixe vazio para não alterar)"
                          value={editPassword}
                          onChange={e => setEditPassword(e.target.value)}
                          className={`${inputCls} sm:col-span-3`}
                        />
                      </div>

                      {/* Mercado Pago */}
                      <div className="border-t border-gray-700 pt-3 space-y-2">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                          Mercado Pago
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            placeholder="Public Key (ex: APP_USR-...)"
                            value={editMpPublicKey}
                            onChange={e => setEditMpPublicKey(e.target.value)}
                            className={`${inputCls} font-mono`}
                          />
                          <input
                            placeholder="Secret Key (ex: APP_USR-...)"
                            value={editMpSecretKey}
                            onChange={e => setEditMpSecretKey(e.target.value)}
                            className={`${inputCls} font-mono`}
                          />
                          <p className="text-[10px] text-gray-500">
                            Deixe em branco para remover as chaves desta empresa.
                          </p>
                        </div>
                      </div>

                      {/* PDV Limit */}
                      <div className="border-t border-gray-700 pt-3">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
                          Limite de PDVs
                        </p>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={editPdvLimit}
                            onChange={e => setEditPdvLimit(Math.max(1, Number(e.target.value)))}
                            className="bg-gray-800 px-3 py-2 rounded-lg outline-none
                              focus:ring-2 focus:ring-indigo-500 text-sm w-24 text-center"
                          />
                          <p className="text-xs text-gray-500">
                            PDVs NFC-e que esta empresa pode cadastrar
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={saving}
                          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                            px-4 py-1.5 rounded-lg text-sm font-medium transition"
                        >
                          {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-lg text-sm transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-gray-400 text-sm truncate">{c.email}</p>
                        <p className="text-gray-500 text-xs">
                          slug: <span className="text-indigo-400">{c.slug}</span>
                          {' · '}
                          {new Date(c.created_at).toLocaleDateString('pt-BR')}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          {c.mp_public_key && c.mp_secret_key ? (
                            <span className="text-xs text-green-500">✓ Mercado Pago configurado</span>
                          ) : (
                            <span className="text-xs text-yellow-600">⚠ Mercado Pago não configurado</span>
                          )}
                          <span className="text-xs text-gray-500">
                            · PDVs permitidos:{' '}
                            <span className="text-indigo-400 font-medium">{c.pdv_limit ?? 1}</span>
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleStartEdit(c)}
                        className="shrink-0 bg-gray-700 hover:bg-gray-600
                          px-3 py-1.5 rounded-lg text-sm transition"
                      >
                        Editar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}