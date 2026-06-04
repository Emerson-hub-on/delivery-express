"use client"

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

type View = 'dashboard' | 'companies' | 'new-company'

const Icons = {
  dashboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  companies: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  logout: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  edit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
}

const inp = 'w-full bg-[#010409] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] outline-none focus:border-[#388bfd] focus:ring-1 focus:ring-[#388bfd]/20 transition-all box-border'
const sectionLabel = 'text-[10px] text-[#484f58] uppercase tracking-[0.6px] font-semibold mb-3 block'
const fieldLabel = 'block text-[11px] text-[#8b949e] font-medium mb-1'

export default function MasterPage() {
  const router = useRouter()
  const [view, setView] = useState<View>('dashboard')
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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
      setTimeout(() => { setCreateSuccess(false); setView('companies') }, 1800)
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
    setError(null)
  }

  function handleCancelEdit() { setEditingId(null); setError(null) }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/master/api/companies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingId, name: editName, email: editEmail, slug: editSlug,
        password: editPassword || undefined,
        mp_public_key: editMpPublicKey, mp_secret_key: editMpSecretKey,
        pdv_limit: editPdvLimit,
      }),
    })
    if (res.ok) { setEditingId(null); fetchCompanies() }
    else { const data = await res.json(); setError(data.error ?? 'Erro ao salvar') }
    setSaving(false)
  }

  async function handleLogout() {
    await fetch('/master/api/logout', { method: 'POST' })
    router.push('/master/login')
  }

  const filtered = companies.filter(c =>
    [c.name, c.email, c.slug].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  const stats = {
    total: companies.length,
    withMp: companies.filter(c => c.mp_public_key && c.mp_secret_key).length,
    totalPdvs: companies.reduce((s, c) => s + (c.pdv_limit ?? 1), 0),
  }

  const navItem = (v: View) =>
    `flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border-none text-sm font-medium cursor-pointer transition-all text-left ${
      view === v
        ? 'bg-[#21262d] text-[#e6edf3]'
        : 'bg-transparent text-[#8b949e] hover:bg-[#161b22] hover:text-[#e6edf3]'
    }`

  return (
    <div className="flex min-h-screen bg-[#010409] text-[#e6edf3] font-mono">

      {/* ── Sidebar ── */}
      <aside className="w-[240px] min-w-[240px] bg-[#0d1117] border-r border-[#21262d] flex flex-col sticky top-0 h-screen">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#21262d] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#388bfd] to-[#1f6feb] flex items-center justify-center text-sm font-bold text-white shrink-0">
            M
          </div>
          <div>
            <div className="text-[13px] font-bold text-[#e6edf3] tracking-tight">Master Admin</div>
            <div className="text-[10px] text-[#484f58] mt-px">Sistema de gestão</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
          <span className="text-[10px] text-[#484f58] font-semibold uppercase tracking-[0.8px] px-2 py-2">
            Navegação
          </span>

          {([
            { id: 'dashboard' as View,    label: 'Dashboard',     icon: Icons.dashboard },
            { id: 'companies' as View,    label: 'Empresas',      icon: Icons.companies },
            { id: 'new-company' as View,  label: 'Nova Empresa',  icon: Icons.plus },
          ]).map(item => (
            <button
              key={item.id}
              onClick={() => { setView(item.id); setEditingId(null); setError(null) }}
              className={navItem(item.id)}
            >
              <span className={view === item.id ? 'text-[#388bfd]' : 'text-[#484f58]'}>
                {item.icon}
              </span>
              {item.label}
              {item.id === 'companies' && companies.length > 0 && (
                <span className="ml-auto bg-[#21262d] text-[#8b949e] text-[10px] font-semibold px-1.5 py-px rounded-full border border-[#30363d]">
                  {companies.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-[#21262d]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm text-[#8b949e] bg-transparent border-none cursor-pointer hover:bg-[#21262d] hover:text-[#f85149] transition-all"
          >
            {Icons.logout} Sair
          </button>
        </div>
      </aside>

      {/* ── Conteúdo ── */}
      <main className="flex-1 p-8 min-h-screen overflow-y-auto">

        {/* ═══ DASHBOARD ═══ */}
        {view === 'dashboard' && (
          <div className="max-w-3xl">
            <div className="mb-8">
              <h1 className="text-[22px] font-bold text-[#e6edf3] m-0">Dashboard</h1>
              <p className="text-[13px] text-[#8b949e] mt-1">Visão geral do sistema</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Total de Empresas', value: stats.total,    color: 'text-[#388bfd]', sub: 'cadastradas' },
                { label: 'Mercado Pago',      value: stats.withMp,   color: 'text-[#3fb950]', sub: 'configuradas' },
                { label: 'PDVs Liberados',    value: stats.totalPdvs, color: 'text-[#f78166]', sub: 'em todas empresas' },
              ].map(s => (
                <div key={s.label} className="bg-[#0d1117] border border-[#21262d] rounded-xl p-5">
                  <div className="text-[10px] text-[#484f58] uppercase tracking-[0.6px] font-semibold mb-2">{s.label}</div>
                  <div className={`text-[32px] font-bold leading-none ${s.color}`}>{s.value}</div>
                  <div className="text-[11px] text-[#484f58] mt-1.5">{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Recentes */}
            <div className="bg-[#0d1117] border border-[#21262d] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#21262d] flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#e6edf3]">Empresas recentes</span>
                <button onClick={() => setView('companies')} className="text-[12px] text-[#388bfd] bg-transparent border-none cursor-pointer">
                  Ver todas →
                </button>
              </div>
              {loading ? (
                <div className="py-8 text-center text-[13px] text-[#484f58]">Carregando...</div>
              ) : companies.slice(0, 5).map((c, i) => (
                <div key={c.id} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? 'border-t border-[#161b22]' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#161b22] border border-[#21262d] flex items-center justify-center text-[13px] font-bold text-[#388bfd]">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-[#e6edf3]">{c.name}</div>
                      <div className="text-[11px] text-[#484f58]">{c.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${c.mp_public_key ? 'bg-[#1a4428] text-[#3fb950] border-[#2ea043]' : 'bg-[#161b22] text-[#484f58] border-[#21262d]'}`}>
                      {c.mp_public_key ? '✓ MP' : 'Sem MP'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-[#16213e] text-[#388bfd] border border-[#1f3a6e]">
                      {c.pdv_limit ?? 1} PDV{(c.pdv_limit ?? 1) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ EMPRESAS ═══ */}
        {view === 'companies' && (
          <div className="max-w-4xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-[22px] font-bold text-[#e6edf3] m-0">Empresas</h1>
                <p className="text-[13px] text-[#8b949e] mt-1">
                  {companies.length} empresa{companies.length !== 1 ? 's' : ''} cadastrada{companies.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setView('new-company')}
                className="flex items-center gap-2 bg-[#238636] border border-[#2ea043] rounded-lg px-4 py-2 text-[13px] font-semibold text-white cursor-pointer hover:bg-[#2ea043] transition-colors"
              >
                {Icons.plus} Nova Empresa
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#484f58] pointer-events-none">
                {Icons.search}
              </span>
              <input
                placeholder="Buscar por nome, e-mail ou slug..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#21262d] rounded-lg pl-9 pr-3 py-2.5 text-[13px] text-[#e6edf3] placeholder-[#484f58] outline-none focus:border-[#388bfd] transition-colors"
              />
            </div>

            {/* Lista */}
            <div className="flex flex-col gap-2">
              {loading ? (
                <div className="py-12 text-center text-[13px] text-[#484f58]">Carregando...</div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-[#484f58]">
                  {search ? 'Nenhuma empresa encontrada.' : 'Nenhuma empresa cadastrada ainda.'}
                </div>
              ) : filtered.map(c => (
                <div key={c.id} className="bg-[#0d1117] border border-[#21262d] rounded-xl overflow-hidden">
                  {editingId === c.id ? (
                    /* Formulário de edição */
                    <form onSubmit={handleSaveEdit} className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[13px] font-semibold text-[#e6edf3]">Editando: {c.name}</span>
                        <button type="button" onClick={handleCancelEdit} className="bg-transparent border-none cursor-pointer text-[#484f58] hover:text-[#e6edf3] flex transition-colors">
                          {Icons.x}
                        </button>
                      </div>

                      {error && (
                        <div className="bg-[#2d1117] border border-[#f85149] rounded-lg px-4 py-2.5 mb-4 text-[13px] text-[#f85149]">
                          {error}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2.5 mb-4">
                        {[
                          { label: 'Nome',   value: editName,  set: setEditName,  placeholder: 'Nome da empresa' },
                          { label: 'Slug',   value: editSlug,  set: (v: string) => setEditSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '')), placeholder: 'slug-da-empresa' },
                          { label: 'E-mail', value: editEmail, set: setEditEmail, placeholder: 'email@empresa.com', type: 'email' },
                        ].map(f => (
                          <div key={f.label}>
                            <label className={fieldLabel}>{f.label}</label>
                            <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} type={(f as any).type ?? 'text'} className={inp} />
                          </div>
                        ))}
                        <div className="col-span-3">
                          <label className={fieldLabel}>Nova senha <span className="text-[#484f58]">(deixe vazio para não alterar)</span></label>
                          <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="••••••••" className={inp} />
                        </div>
                      </div>

                      {/* Mercado Pago */}
                      <div className="border-t border-[#21262d] pt-4 mb-4">
                        <span className={sectionLabel}>Mercado Pago</span>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className={fieldLabel}>Public Key</label>
                            <input value={editMpPublicKey} onChange={e => setEditMpPublicKey(e.target.value)} placeholder="APP_USR-..." className={`${inp} font-mono text-[11px]`} />
                          </div>
                          <div>
                            <label className={fieldLabel}>Secret Key</label>
                            <input value={editMpSecretKey} onChange={e => setEditMpSecretKey(e.target.value)} placeholder="APP_USR-..." className={`${inp} font-mono text-[11px]`} />
                          </div>
                        </div>
                      </div>

                      {/* PDV Limit */}
                      <div className="border-t border-[#21262d] pt-4 mb-5">
                        <span className={sectionLabel}>Limite de PDVs</span>
                        <div className="flex items-center gap-3">
                          <input
                            type="number" min={1} max={99} value={editPdvLimit}
                            onChange={e => setEditPdvLimit(Math.max(1, Number(e.target.value)))}
                            className="w-20 bg-[#010409] border border-[#30363d] rounded-lg px-3 py-2 text-[13px] text-[#388bfd] font-bold text-center outline-none focus:border-[#388bfd]"
                          />
                          <span className="text-[12px] text-[#484f58]">PDVs NFC-e permitidos para esta empresa</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button type="submit" disabled={saving}
                          className="flex items-center gap-2 bg-[#238636] border border-[#2ea043] rounded-lg px-4 py-1.5 text-[13px] font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2ea043] transition-colors">
                          {Icons.check} {saving ? 'Salvando...' : 'Salvar alterações'}
                        </button>
                        <button type="button" onClick={handleCancelEdit}
                          className="bg-transparent border border-[#30363d] rounded-lg px-4 py-1.5 text-[13px] text-[#8b949e] cursor-pointer hover:text-[#e6edf3] hover:border-[#484f58] transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Linha normal */
                    <div className="flex items-center gap-4 px-5 py-3.5">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1f3a6e] to-[#388bfd]/20 border border-[#1f3a6e] flex items-center justify-center text-[14px] font-bold text-[#388bfd] shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[14px] font-semibold text-[#e6edf3]">{c.name}</span>
                          <span className="text-[10px] text-[#388bfd] bg-[#16213e] border border-[#1f3a6e] px-1.5 py-px rounded font-mono">
                            {c.slug}
                          </span>
                        </div>
                        <div className="text-[12px] text-[#484f58]">{c.email}</div>
                        <div className="text-[11px] text-[#30363d] mt-px">
                          criada em {new Date(c.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] px-2 py-1 rounded-md font-medium border ${(c.mp_public_key && c.mp_secret_key) ? 'bg-[#1a4428] text-[#3fb950] border-[#2ea043]' : 'bg-[#161b22] text-[#484f58] border-[#21262d]'}`}>
                          {(c.mp_public_key && c.mp_secret_key) ? '✓ MP ativo' : 'MP inativo'}
                        </span>
                        <span className="text-[10px] px-2 py-1 rounded-md font-semibold bg-[#16213e] text-[#388bfd] border border-[#1f3a6e]">
                          {c.pdv_limit ?? 1} PDV{(c.pdv_limit ?? 1) !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={() => handleStartEdit(c)}
                          className="flex items-center gap-1.5 bg-[#161b22] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-[12px] text-[#8b949e] cursor-pointer hover:text-[#e6edf3] hover:border-[#484f58] transition-colors"
                        >
                          {Icons.edit} Editar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ NOVA EMPRESA ═══ */}
        {view === 'new-company' && (
          <div className="max-w-lg">
            <div className="mb-6">
              <h1 className="text-[22px] font-bold text-[#e6edf3] m-0">Nova Empresa</h1>
              <p className="text-[13px] text-[#8b949e] mt-1">Cadastre uma nova empresa no sistema</p>
            </div>

            {createSuccess && (
              <div className="bg-[#1a4428] border border-[#2ea043] rounded-xl px-4 py-3.5 mb-5 flex items-center gap-3 text-[13px] text-[#3fb950]">
                {Icons.check} Empresa criada com sucesso! Redirecionando...
              </div>
            )}

            {error && (
              <div className="bg-[#2d1117] border border-[#f85149] rounded-xl px-4 py-3.5 mb-5 text-[13px] text-[#f85149]">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div className="bg-[#0d1117] border border-[#21262d] rounded-xl overflow-hidden">

                {/* Dados */}
                <div className="p-5 border-b border-[#161b22] flex flex-col gap-3">
                  <span className={sectionLabel}>Dados da Empresa</span>
                  <div>
                    <label className={fieldLabel}>Nome da empresa</label>
                    <input value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Minha Empresa Ltda" required className={inp} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Slug</label>
                    <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="minha-empresa" required className={`${inp} font-mono`} />
                    <p className="text-[10px] text-[#484f58] mt-1">Gerado automaticamente a partir do nome</p>
                  </div>
                </div>

                {/* Acesso */}
                <div className="p-5 border-b border-[#161b22] flex flex-col gap-3">
                  <span className={sectionLabel}>Acesso</span>
                  <div>
                    <label className={fieldLabel}>E-mail</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@empresa.com" required className={inp} />
                  </div>
                  <div>
                    <label className={fieldLabel}>Senha</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required className={inp} />
                  </div>
                </div>

                {/* PDV Limit */}
                <div className="p-5">
                  <span className={sectionLabel}>Limite de PDVs NFC-e</span>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border border-[#30363d] rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setPdvLimit(v => Math.max(1, v - 1))}
                        className="px-4 py-2 bg-[#161b22] border-none text-[#8b949e] cursor-pointer text-base hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
                      >−</button>
                      <span className="px-5 py-2 bg-[#010409] text-[18px] font-bold text-[#388bfd] min-w-[56px] text-center">
                        {pdvLimit}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPdvLimit(v => Math.min(99, v + 1))}
                        className="px-4 py-2 bg-[#161b22] border-none text-[#8b949e] cursor-pointer text-base hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
                      >+</button>
                    </div>
                    <div>
                      <div className="text-[13px] text-[#e6edf3] font-medium">
                        PDV{pdvLimit !== 1 ? 's' : ''} liberado{pdvLimit !== 1 ? 's' : ''}
                      </div>
                      <div className="text-[11px] text-[#484f58] mt-0.5">
                        Até {pdvLimit} PDV{pdvLimit !== 1 ? 's' : ''} NFC-e para esta empresa
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-[#238636] border border-[#2ea043] rounded-xl py-3 text-[14px] font-semibold text-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#2ea043] transition-colors"
              >
                {Icons.plus} {creating ? 'Criando empresa...' : 'Criar Empresa'}
              </button>
            </form>
          </div>
        )}

      </main>
    </div>
  )
}