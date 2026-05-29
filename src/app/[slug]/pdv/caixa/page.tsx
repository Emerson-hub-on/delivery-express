'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PDVTab } from '@/app/[slug]/admin/caixa/PDVTab'
import { CashRegister } from '@/types/cash-register'
import { CashOpeningView } from '@/app/[slug]/admin/tabs/CashOpeningView'
import { CashClosingView } from '@/app/[slug]/admin/tabs/CashClosingView'

type OperatorSession = {
  id: string
  name: string
  companyId: string
  slug: string
}

type Screen = 'loading' | 'opening' | 'pdv' | 'closing'

function getSession(): OperatorSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem('pdv_operator')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export default function PDVCaixaPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()

  const [operator,     setOperator]     = useState<OperatorSession | null>(null)
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null)
  const [screen,       setScreen]       = useState<Screen>('loading')
  const [pdvError,     setPdvError]     = useState<string | null>(null)
  const [openingTime,  setOpeningTime]  = useState('08:00')

  useEffect(() => {
    const session = getSession()
    if (!session || session.slug !== params?.slug) {
      router.replace(`/${params?.slug}/pdv`)
      return
    }
    setOperator(session)
    loadCash(session)
    loadOpeningTime(session.companyId)
  }, [params?.slug])

  const loadOpeningTime = async (companyId: string) => {
    const { data } = await supabase
      .from('companies')
      .select('opening_time')
      .eq('id', companyId)
      .single()
    if (data?.opening_time) setOpeningTime(data.opening_time)
  }

  const loadCash = async (session: OperatorSession) => {
    const { data } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('company_id', session.companyId)
      .eq('status', 'open')
      .maybeSingle()
    if (data) {
      setCashRegister(data as CashRegister)
      setScreen('pdv')
    } else {
      setScreen('opening')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('pdv_operator')
    router.replace(`/${params?.slug}/pdv`)
  }

  // ── Topbar compartilhada ─────────────────────────────────────────────────
  const Topbar = ({ showClose = false }: { showClose?: boolean }) => (
    <div style={topbarStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🚀</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>PDV</span>
        {cashRegister?.nfce_serie && (
          <span style={{ fontSize: 11, color: '#4a6a8a', marginLeft: 4 }}>
            · Série {cashRegister.nfce_serie}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {showClose && (
          <button onClick={() => setScreen('closing')} style={closeCashBtnStyle}>
            Fechar caixa
          </button>
        )}
        <span style={{ fontSize: 12, color: '#8faec9' }}>👤 {operator?.name}</span>
        <button onClick={handleLogout} style={logoutBtnStyle}>Sair</button>
      </div>
    </div>
  )

  // ── Loading ──────────────────────────────────────────────────────────────
  if (screen === 'loading' || !operator) {
    return (
      <div style={rootStyle}>
        <div style={spinnerStyle} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Abertura ─────────────────────────────────────────────────────────────
  if (screen === 'opening') {
    return (
      <div style={{ minHeight: '100vh', background: '#060f1a', fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <Topbar />
        <div style={{ padding: '24px 16px' }}>
          <CashOpeningView
            openingTime={openingTime}
            onOpened={(cash) => {
              setCashRegister(cash)
              setScreen('pdv')
            }}
          />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Fechamento ───────────────────────────────────────────────────────────
  if (screen === 'closing' && cashRegister) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fb', fontFamily: "'Inter', -apple-system, sans-serif" }}>
        <Topbar />
        <div style={{ padding: '24px 16px' }}>
          <CashClosingView
            cashRegister={cashRegister}
            onClosed={() => {
              setCashRegister(null)
              setScreen('opening')
            }}
          />
        </div>
      </div>
    )
  }

  // ── PDV ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#060f1a' }}>
      <Topbar showClose />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px', overflow: 'hidden' }}>
        <PDVTab
          companyId={operator.companyId}
          cashRegisterId={cashRegister!.id}
          serie={cashRegister?.nfce_serie ?? '1'}
          onError={setPdvError}
        />
      </div>
      {pdvError && (
        <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, zIndex: 200 }}>
          {pdvError}
          <button onClick={() => setPdvError(null)} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── estilos ──────────────────────────────────────────────────────────────────
const rootStyle: React.CSSProperties = {
  minHeight: '100vh', background: '#060f1a',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 12,
}
const spinnerStyle: React.CSSProperties = {
  width: 36, height: 36,
  border: '3px solid #1a3a5c', borderTopColor: '#f97316',
  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
}
const topbarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 20px', background: '#0a1520',
  borderBottom: '1px solid #1a3a5c', flexShrink: 0, zIndex: 10,
}
const logoutBtnStyle: React.CSSProperties = {
  fontSize: 11, color: '#ef4444',
  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
  borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600,
}
const closeCashBtnStyle: React.CSSProperties = {
  fontSize: 11, color: '#f97316',
  background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
  borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600,
}