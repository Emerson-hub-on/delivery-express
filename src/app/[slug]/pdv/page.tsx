'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── tipos ──────────────────────────────────────────────────────────────────
type Operator = {
  id: string
  name: string
  pin: string
}

type Company = {
  id: string
  name: string
  slug: string
}

// ── helpers ────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── componente ─────────────────────────────────────────────────────────────
export default function PDVLoginPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()

  const [company,    setCompany]    = useState<Company | null>(null)
  const [operators,  setOperators]  = useState<Operator[]>([])
  const [loading,    setLoading]    = useState(true)

  // passo 1 = selecionar operador, passo 2 = digitar PIN
  const [step,       setStep]       = useState<1 | 2>(1)
  const [selected,   setSelected]   = useState<Operator | null>(null)
  const [pin,        setPin]        = useState('')
  const [pinError,   setPinError]   = useState('')
  const [logging,    setLogging]    = useState(false)
  const [shake,      setShake]      = useState(false)

  // ── busca empresa + operadores ────────────────────────────────────────
  useEffect(() => {
    if (!params?.slug) return
    ;(async () => {
      const { data: co } = await supabase
        .from('companies')
        .select('id, name, slug')
        .eq('slug', params.slug)
        .single()
      if (!co) { setLoading(false); return }
      setCompany(co)

      const { data: ops } = await supabase
        .from('operators')
        .select('id, name, pin')
        .eq('company_id', co.id)
        .eq('active', true)
        .order('name', { ascending: true })
      setOperators(ops ?? [])
      setLoading(false)
    })()
  }, [params?.slug])

  // ── PIN: digitar ──────────────────────────────────────────────────────
  const appendPin = (d: string) => {
    if (pin.length >= 6) return
    setPin(p => p + d)
    setPinError('')
  }

  const deletePin = () => setPin(p => p.slice(0, -1))

  const handleLogin = async () => {
    if (!selected || pin.length < 4) return
    setLogging(true)
    await sleep(300)

    if (selected.pin !== pin) {
      setLogging(false)
      setPinError('PIN incorreto')
      setShake(true)
      setPin('')
      setTimeout(() => setShake(false), 500)
      return
    }

    // Salva operador na sessão (sessionStorage — sem autenticação Supabase)
    sessionStorage.setItem('pdv_operator', JSON.stringify({
      id:   selected.id,
      name: selected.name,
      companyId: company!.id,
      slug: params.slug,
    }))

    router.push(`/${params.slug}/pdv/caixa`)
  }

  // ── KEY handler ───────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 2) return
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') appendPin(e.key)
      else if (e.key === 'Backspace') deletePin()
      else if (e.key === 'Enter') handleLogin()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step, pin, selected])

  // ── auto-login quando pin tiver 4+ dígitos e selecionar ──────────────
  useEffect(() => {
    if (step === 2 && pin.length >= 4 && selected?.pin?.length === pin.length) {
      handleLogin()
    }
  }, [pin])

  // ── render loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.root}>
        <div style={styles.spinner} />
      </div>
    )
  }

  if (!company) {
    return (
      <div style={styles.root}>
        <p style={{ color: '#ef4444', fontSize: 14 }}>Empresa não encontrada.</p>
      </div>
    )
  }

  // ── PASSO 1: seleção de operador ──────────────────────────────────────
  if (step === 1) {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          {/* logo */}
          <div style={styles.logoWrap}>
            <span style={styles.logoIcon}>🚀</span>
            <span style={styles.logoText}>PDV</span>
          </div>
          <p style={styles.companyName}>{company.name}</p>
          <p style={styles.subtitle}>Selecione seu perfil para continuar</p>

          {operators.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
              Nenhum operador cadastrado.<br />Cadastre operadores no painel admin → Caixa.
            </p>
          ) : (
            <div style={styles.operatorGrid}>
              {operators.map(op => (
                <button
                  key={op.id}
                  onClick={() => { setSelected(op); setPin(''); setPinError(''); setStep(2) }}
                  style={styles.operatorBtn}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = '#1e3a5f'
                    el.style.borderColor = '#f97316'
                    el.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = '#0f2137'
                    el.style.borderColor = '#1a3a5c'
                    el.style.transform = 'translateY(0)'
                  }}
                >
                  <div style={styles.avatarRing}>
                    <div style={styles.avatar}>
                      {op.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <span style={styles.operatorName}>{op.name}</span>
                </button>
              ))}
            </div>
          )}

          <p style={styles.footer}>© {new Date().getFullYear()} webState · deliveryExpress</p>
        </div>
      </div>
    )
  }

  // ── PASSO 2: PIN ──────────────────────────────────────────────────────
  const pinLen = selected?.pin?.length ?? 4
  const dots   = Array.from({ length: Math.max(pinLen, 4) })

  return (
    <div style={styles.root}>
      <div style={{ ...styles.card, maxWidth: 360 }}>
        {/* voltar */}
        <button
          onClick={() => { setStep(1); setSelected(null); setPin(''); setPinError('') }}
          style={styles.backBtn}
        >
          ← Trocar operador
        </button>

        {/* avatar */}
        <div style={{ ...styles.avatarRing, margin: '0 auto 12px', width: 64, height: 64 }}>
          <div style={{ ...styles.avatar, width: 56, height: 56, fontSize: 22 }}>
            {selected!.name.charAt(0).toUpperCase()}
          </div>
        </div>
        <p style={{ ...styles.companyName, marginBottom: 4 }}>{selected!.name}</p>
        <p style={styles.subtitle}>Digite seu PIN para entrar</p>

        {/* dots */}
        <div
          style={{
            ...styles.dotsRow,
            animation: shake ? 'shake 0.4s ease' : undefined,
          }}
        >
          {dots.map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.dot,
                background: i < pin.length
                  ? (pinError ? '#ef4444' : '#f97316')
                  : '#1a3a5c',
                transform: i < pin.length ? 'scale(1.15)' : 'scale(1)',
                boxShadow: i < pin.length && !pinError
                  ? '0 0 8px rgba(249,115,22,0.5)'
                  : 'none',
              }}
            />
          ))}
        </div>

        {pinError && (
          <p style={styles.pinError}>{pinError}</p>
        )}

        {/* teclado numérico */}
        <div style={styles.numpad}>
          {['1','2','3','4','5','6','7','8','9','',  '0','⌫'].map((k, i) => {
            if (k === '') return <div key={i} />
            const isBack = k === '⌫'
            return (
              <button
                key={i}
                onClick={() => isBack ? deletePin() : appendPin(k)}
                style={{
                  ...styles.numKey,
                  ...(isBack ? styles.numKeyBack : {}),
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.background = isBack ? '#1f3a58' : '#1e3a5f'
                  ;(e.currentTarget as HTMLElement).style.borderColor = isBack ? '#334d6e' : '#f97316'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.background = isBack ? '#0f2137' : '#0f2137'
                  ;(e.currentTarget as HTMLElement).style.borderColor = '#1a3a5c'
                }}
              >
                {k}
              </button>
            )
          })}
        </div>

        {/* botão entrar */}
        <button
          onClick={handleLogin}
          disabled={logging || pin.length < 4}
          style={{
            ...styles.loginBtn,
            opacity: pin.length < 4 ? 0.45 : 1,
            cursor: pin.length < 4 ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={e => {
            if (pin.length >= 4) (e.currentTarget as HTMLElement).style.background = '#ea6c10'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = '#f97316'
          }}
        >
          {logging ? '...' : 'Entrar no PDV'}
        </button>

        <p style={styles.footer}>© {new Date().getFullYear()} webState · deliveryExpress</p>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0) }
          20%      { transform: translateX(-8px) }
          40%      { transform: translateX(8px) }
          60%      { transform: translateX(-6px) }
          80%      { transform: translateX(6px) }
        }
      `}</style>
    </div>
  )
}

// ── estilos ────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#060f1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: "'Inter', -apple-system, sans-serif",
  },
  card: {
    background: '#0a1520',
    border: '1px solid #1a3a5c',
    borderRadius: 20,
    padding: '36px 32px 28px',
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  logoIcon: { fontSize: 24 },
  logoText: {
    fontSize: 22,
    fontWeight: 800,
    color: '#ffffff',
    letterSpacing: '-0.5px',
  },
  companyName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e2e8f0',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#4a6a8a',
    marginBottom: 28,
    textAlign: 'center',
  },
  operatorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  operatorBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '18px 12px',
    borderRadius: 14,
    border: '1.5px solid #1a3a5c',
    background: '#0f2137',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #f97316, #fb923c)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: '#0a1520',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 800,
    color: '#f97316',
  },
  operatorName: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.3,
  },
  backBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    color: '#4a6a8a',
    fontSize: 12,
    cursor: 'pointer',
    marginBottom: 20,
    padding: 0,
    transition: 'color 0.15s',
  },
  dotsRow: {
    display: 'flex',
    gap: 14,
    marginBottom: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    transition: 'all 0.15s ease',
  },
  pinError: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 16,
    fontWeight: 500,
  },
  numpad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    width: '100%',
    marginBottom: 16,
    marginTop: 8,
  },
  numKey: {
    padding: '16px 0',
    borderRadius: 12,
    border: '1.5px solid #1a3a5c',
    background: '#0f2137',
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.12s ease',
    fontFamily: 'monospace',
  },
  numKeyBack: {
    color: '#8faec9',
    fontSize: 18,
  },
  loginBtn: {
    width: '100%',
    padding: '13px 0',
    borderRadius: 12,
    border: 'none',
    background: '#f97316',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    transition: 'all 0.15s',
    marginBottom: 20,
    letterSpacing: '0.2px',
  },
  footer: {
    fontSize: 10,
    color: '#1e3a5c',
    textAlign: 'center',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #1a3a5c',
    borderTopColor: '#f97316',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}