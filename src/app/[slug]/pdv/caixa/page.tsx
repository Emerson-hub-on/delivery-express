'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PDVTab } from '@/app/[slug]/admin/caixa/PDVTab'
import { CashRegister } from '@/types/cash-register'

// ── sessão do operador ──────────────────────────────────────────────────────
type OperatorSession = {
  id: string
  name: string
  companyId: string
  slug: string
}

function getSession(): OperatorSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem('pdv_operator')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ── tela de abertura de caixa (inline — sem depender de auth.getUser) ────────
function AberturaCaixa({
  operator,
  onOpened,
  onLogout,
}: {
  operator: OperatorSession
  onOpened: (cash: CashRegister) => void
  onLogout: () => void
}) {
  const [amount,  setAmount]  = useState('')
  const [notes,   setNotes]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleOpen = async () => {
    setSaving(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('cash_registers')
        .insert({
          company_id:     operator.companyId,
          status:         'open',
          operator_id:    operator.id,
          operator_name:  operator.name,
          opening_amount: parseFloat(amount.replace(',', '.')) || 0,
          opening_notes:  notes || null,
          opening_at:     new Date().toISOString(),
        })
        .select()
        .single()
      if (err) throw new Error(err.message)
      onOpened(data as CashRegister)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060f1a', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Topbar */}
      <div style={topbarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🚀</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>PDV</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#8faec9' }}>👤 {operator.name}</span>
          <button onClick={onLogout} style={logoutBtnStyle}>Sair</button>
        </div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 24px' }}>
        {/* Badge */}
        <div style={statusBadgeStyle}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6b7280' }} />
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>CAIXA FECHADO</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>
          Abertura de Caixa
        </h1>
        <p style={{ fontSize: 13, color: '#4a6a8a', marginBottom: 32 }}>
          Informe o valor em caixa para iniciar o turno.
        </p>

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: 10, color: '#fca5a5', fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ background: '#0a1520', border: '1px solid #1a3a5c', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Operador */}
          <div style={{ background: '#0f2137', border: '1px solid #1a3a5c', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#fb923c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff' }}>
              {operator.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600, margin: 0 }}>{operator.name}</p>
              <p style={{ fontSize: 11, color: '#4a6a8a', margin: 0 }}>Operador responsável</p>
            </div>
          </div>

          {/* Valor de abertura */}
          <div>
            <label style={{ fontSize: 11, color: '#8faec9', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Valor em caixa (fundo de troco)
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#4a6a8a', fontSize: 13, fontWeight: 600 }}>R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^\d,.]/, ''))}
                placeholder="0,00"
                style={{ width: '100%', background: '#0f2137', border: '1.5px solid #1a3a5c', borderRadius: 10, padding: '11px 14px 11px 38px', color: '#e2e8f0', fontSize: 16, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => (e.target.style.borderColor = '#f97316')}
                onBlur={e => (e.target.style.borderColor = '#1a3a5c')}
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label style={{ fontSize: 11, color: '#8faec9', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Caixa conferido com gerente"
              rows={2}
              style={{ width: '100%', background: '#0f2137', border: '1.5px solid #1a3a5c', borderRadius: 10, padding: '10px 14px', color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
              onFocus={e => (e.target.style.borderColor = '#f97316')}
              onBlur={e => (e.target.style.borderColor = '#1a3a5c')}
            />
          </div>

          <button
            onClick={handleOpen}
            disabled={saving}
            style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', background: saving ? '#15803d' : '#16a34a', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
          >
            {saving ? 'Abrindo caixa...' : '✓ Abrir caixa e iniciar turno'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── modal de fechamento (inline — sem depender de auth.getUser) ───────────────
function FechamentoCaixaModal({
  cashRegister,
  operator,
  onClosed,
  onCancel,
}: {
  cashRegister: CashRegister
  operator: OperatorSession
  onClosed: () => void
  onCancel: () => void
}) {
  const [amount,  setAmount]  = useState('')
  const [notes,   setNotes]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleClose = async () => {
    setSaving(true)
    setError(null)
    try {
      // Calcula total de vendas do turno
      const { data: salesData } = await supabase
        .from('orders')
        .select('total')
        .eq('cash_register_id', cashRegister.id)
        .eq('status', 'completed')
      const totalSales = (salesData ?? []).reduce((s: number, o: any) => s + Number(o.total ?? 0), 0)

      const { error: err } = await supabase
        .from('cash_registers')
        .update({
          status:               'closed',
          closing_operator_id:  operator.id,
          closing_operator_name: operator.name,
          closing_amount:       parseFloat(amount.replace(',', '.')) || 0,
          closing_notes:        notes || null,
          total_sales:          totalSales,
          total_cancelled:      0,
          closing_at:           new Date().toISOString(),
        })
        .eq('id', cashRegister.id)
      if (err) throw new Error(err.message)
      onClosed()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#0a1520', border: '1px solid #1a3a5c', borderRadius: 20, padding: 32, width: '90%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#4a6a8a', fontSize: 12, cursor: 'pointer', alignSelf: 'flex-start', padding: 0 }}>
          ← Voltar ao PDV
        </button>

        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#e2e8f0', marginBottom: 4 }}>Fechamento de Caixa</h2>
          <p style={{ fontSize: 12, color: '#4a6a8a' }}>
            Aberto em {new Date(cashRegister.opening_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} por {cashRegister.operator_name}
          </p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#1f0a0a', border: '1px solid #7f1d1d', borderRadius: 10, color: '#fca5a5', fontSize: 12 }}>
            {error}
          </div>
        )}

        <div>
          <label style={{ fontSize: 11, color: '#8faec9', fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Valor em caixa no fechamento
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#4a6a8a', fontSize: 13, fontWeight: 600 }}>R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^\d,.]/, ''))}
              placeholder="0,00"
              style={{ width: '100%', background: '#0f2137', border: '1.5px solid #1a3a5c', borderRadius: 10, padding: '11px 14px 11px 38px', color: '#e2e8f0', fontSize: 16, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#f97316')}
              onBlur={e => (e.target.style.borderColor = '#1a3a5c')}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, color: '#8faec9', fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Observações (opcional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Ex: Caixa conferido"
            rows={2}
            style={{ width: '100%', background: '#0f2137', border: '1.5px solid #1a3a5c', borderRadius: 10, padding: '10px 14px', color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            onFocus={e => (e.target.style.borderColor = '#f97316')}
            onBlur={e => (e.target.style.borderColor = '#1a3a5c')}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #1a3a5c', background: 'none', color: '#8faec9', fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={handleClose}
            disabled={saving}
            style={{ flex: 2, padding: '12px 0', borderRadius: 10, border: 'none', background: saving ? '#7f1d1d' : '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Fechando...' : '✓ Fechar caixa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── página principal ─────────────────────────────────────────────────────────
export default function PDVCaixaPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()

  const [operator,     setOperator]     = useState<OperatorSession | null>(null)
  // undefined = ainda carregando | null = sem caixa | CashRegister = caixa aberto
  const [cashRegister, setCashRegister] = useState<CashRegister | null | undefined>(undefined)
  const [closingModal, setClosingModal] = useState(false)
  const [pdvError,     setPdvError]     = useState<string | null>(null)

  // ── valida sessão ────────────────────────────────────────────────────────
  useEffect(() => {
    const session = getSession()
    if (!session || session.slug !== params?.slug) {
      router.replace(`/${params?.slug}/pdv`)
      return
    }
    setOperator(session)
  }, [params?.slug])

  // ── busca caixa aberto ───────────────────────────────────────────────────
  useEffect(() => {
    if (!operator) return
    loadCash()
  }, [operator])

  const loadCash = async () => {
    setCashRegister(undefined)              // volta a "carregando"
    const { data } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('company_id', operator!.companyId)
      .eq('status', 'open')
      .maybeSingle()
    setCashRegister(data ?? null)           // null = sem caixa
  }

  const handleLogout = () => {
    sessionStorage.removeItem('pdv_operator')
    router.replace(`/${params?.slug}/pdv`)
  }

  // ── loading (undefined = sessão ou caixa ainda carregando) ───────────────
  if (!operator || cashRegister === undefined) {
    return (
      <div style={rootStyle}>
        <div style={spinnerStyle} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── sem caixa aberto → tela de abertura ─────────────────────────────────
  if (cashRegister === null) {
    return (
      <AberturaCaixa
        operator={operator}
        onOpened={(cash) => setCashRegister(cash)}
        onLogout={handleLogout}
      />
    )
  }

  // ── cashRegister é definitivamente CashRegister aqui ────────────────────
  // TypeScript garante: não é undefined, não é null
  const cash: CashRegister = cashRegister

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#060f1a' }}>
      {/* Topbar */}
      <div style={topbarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🚀</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>PDV</span>
          <span style={{ fontSize: 11, color: '#4a6a8a', marginLeft: 4 }}>
            · Série {cash.nfce_serie ?? '1'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setClosingModal(true)} style={closeCashBtnStyle}>
            Fechar caixa
          </button>
          <span style={{ fontSize: 12, color: '#8faec9' }}>👤 {operator.name}</span>
          <button onClick={handleLogout} style={logoutBtnStyle}>Sair</button>
        </div>
      </div>

      {/* PDV */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px', overflow: 'hidden' }}>
        <PDVTab
          companyId={operator.companyId}
          cashRegisterId={cash.id}
          serie={cash.nfce_serie ?? '1'}
          onError={setPdvError}
        />
      </div>

      {/* Erro do PDV */}
      {pdvError && (
        <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: '#dc2626', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600, zIndex: 200 }}>
          {pdvError}
          <button onClick={() => setPdvError(null)} style={{ marginLeft: 10, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>
      )}

      {/* Modal fechamento */}
      {closingModal && (
        <FechamentoCaixaModal
          cashRegister={cash}
          operator={operator}
          onClosed={() => { setClosingModal(false); setCashRegister(null); loadCash() }}
          onCancel={() => setClosingModal(false)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── estilos ──────────────────────────────────────────────────────────────────
const rootStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#060f1a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
}

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: '3px solid #1a3a5c',
  borderTopColor: '#f97316',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
}

const topbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 20px',
  background: '#0a1520',
  borderBottom: '1px solid #1a3a5c',
  flexShrink: 0,
  zIndex: 10,
}

const logoutBtnStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#ef4444',
  background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.2)',
  borderRadius: 8,
  padding: '5px 12px',
  cursor: 'pointer',
  fontWeight: 600,
}

const closeCashBtnStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#f97316',
  background: 'rgba(249,115,22,0.1)',
  border: '1px solid rgba(249,115,22,0.2)',
  borderRadius: 8,
  padding: '5px 12px',
  cursor: 'pointer',
  fontWeight: 600,
}

const statusBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: '#0f2137',
  border: '1px solid #1a3a5c',
  borderRadius: 20,
  padding: '4px 12px',
  marginBottom: 16,
}