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

type Screen = 'loading' | 'opening' | 'pdv' | 'closing' | 'blocked'

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

  if (!data) {
    // Nenhum caixa aberto → abertura
    setScreen('opening')
  } else if (data.operator_id === session.id) {
    // Caixa aberto pelo mesmo operador → vai direto ao PDV
    setCashRegister(data as CashRegister)
    setScreen('pdv')
  } else {
    // Caixa aberto por outro operador → bloqueia
    setCashRegister(data as CashRegister)
    setScreen('blocked')
  }
}

  const handleLogout = () => {
    sessionStorage.removeItem('pdv_operator')
    router.replace(`/${params?.slug}/pdv`)
  }

  // ── Topbar compartilhada ─────────────────────────────────────────────────
const Topbar = ({ showClose = false, light = false }: { showClose?: boolean; light?: boolean }) => (
  <div style={{
    ...topbarStyle,
    background: light ? '#ffffff' : '#0a1520',
    borderBottom: light ? '1px solid #e5e7eb' : '1px solid #1a3a5c',
  }}>

    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {showClose && (
        <button onClick={() => setScreen('closing')} style={closeCashBtnStyle}>
          Fechar caixa
        </button>
      )}
      <span style={{ fontSize: 12, color: light ? '#6b7280' : '#8faec9' }}>👤 {operator?.name}</span>
      <button onClick={handleLogout} style={logoutBtnStyle}>Sair</button>
    </div>
  </div>
)

// Usar light nas telas de abertura e fechamento:
// <Topbar light />

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
    <div style={{ minHeight: '100vh', background: '#f8f9fb', fontFamily: "'Inter', -apple-system, sans-serif" }}>
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
  // ── Bloqueado — caixa aberto por outro operador ───────────────────────────
if (screen === 'blocked' && cashRegister) {
  return (
    <div style={{ minHeight: '100vh', background: '#060f1a', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <Topbar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 52px)', padding: 24 }}>
        <div style={{
          background: '#0a1520', border: '1px solid #1a3a5c', borderRadius: 20,
          padding: '36px 32px', maxWidth: 440, width: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          {/* Ícone */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
          }}>
            🔒
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', marginBottom: 8 }}>
              Caixa em uso
            </p>
            <p style={{ fontSize: 13, color: '#8faec9', lineHeight: 1.6 }}>
              O caixa está aberto por{' '}
              <span style={{ color: '#f97316', fontWeight: 700 }}>
                {cashRegister.operator_name}
              </span>
              {' '}desde{' '}
              <span style={{ color: '#e2e8f0' }}>
                {new Date(cashRegister.opening_at).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </p>
          </div>

          {/* Info */}
          <div style={{
            background: '#0f2137', border: '1px solid #1a3a5c', borderRadius: 12,
            padding: '14px 18px', width: '100%',
          }}>
            <p style={{ fontSize: 11, color: '#4a6a8a', marginBottom: 4, fontWeight: 600 }}>
              PARA CONTINUAR
            </p>
            <p style={{ fontSize: 13, color: '#8faec9', lineHeight: 1.6 }}>
              {cashRegister.operator_name} precisa acessar o PDV e realizar o{' '}
              <span style={{ color: '#f97316', fontWeight: 600 }}>fechamento do caixa</span>{' '}
              antes que outro operador possa abrir um novo turno.
            </p>
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            {/* Verificar novamente — útil após o outro operador fechar */}
            <button
              onClick={() => { setScreen('loading'); loadCash(operator!) }}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12,
                background: '#f97316', border: 'none', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              🔄 Verificar novamente
            </button>
            <button
              onClick={handleLogout}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12,
                background: 'none', border: '1px solid #1a3a5c',
                color: '#8faec9', fontSize: 13, cursor: 'pointer',
              }}
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

  // ── PDV ──────────────────────────────────────────────────────────────────
  return (
  <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8f9fb' }}>
    {/* Sem Topbar aqui */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PDVTab
        companyId={operator.companyId}
        cashRegisterId={cashRegister!.id}
        serie={cashRegister?.nfce_serie ?? '1'}
        onError={setPdvError}
        onCloseCash={() => setScreen('closing')}   // ← adicionar
        onLogout={handleLogout}                     // ← adicionar
        operatorName={operator.name}               // ← adicionar
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