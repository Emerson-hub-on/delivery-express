'use client'

/**
 * NfceInutilizarModal
 *
 * Permite inutilizar um número específico ou um range de números de NFC-e.
 * Chama a Edge Function inutilizar-nfce via fetch.
 */

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  companyId: string
  serie: string
  onClose: () => void
  onSuccess?: (msg: string) => void
}

const C = {
  border:   '#e2e6ed',
  surface:  '#ffffff',
  bg:       '#fafbfc',
  txtPri:   '#1a1f2e',
  txtSec:   '#5a6272',
  txtMuted: '#9aa0ae',
  indigo:   '#6366f1',
  indigoBg: '#eef2ff',
  red:      '#dc2626',
  redBg:    '#fef2f2',
  yellow:   '#d97706',
  yellowBg: '#fefce8',
  green:    '#16a34a',
} as const

type Mode = 'unico' | 'range'

export function NfceInutilizarModal({ companyId, serie, onClose, onSuccess }: Props) {
  const [mode,          setMode]          = useState<Mode>('unico')
  const [nNumero,       setNNumero]       = useState('')
  const [nInicio,       setNInicio]       = useState('')
  const [nFim,          setNFim]          = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [loading,       setLoading]       = useState(false)
  const [result,        setResult]        = useState<{ ok: boolean; msg: string } | null>(null)

  const justLen = justificativa.trim().length
  const justOk  = justLen >= 15

  const handleSubmit = async () => {
    // Validações
    const inicio = mode === 'unico' ? parseInt(nNumero) : parseInt(nInicio)
    const fim    = mode === 'unico' ? parseInt(nNumero) : parseInt(nFim)

    if (!inicio || isNaN(inicio)) {
      setResult({ ok: false, msg: 'Informe um número válido' }); return
    }
    if (mode === 'range') {
      if (!fim || isNaN(fim)) { setResult({ ok: false, msg: 'Informe o número final válido' }); return }
      if (inicio > fim)       { setResult({ ok: false, msg: 'Número inicial não pode ser maior que o final' }); return }
      if (fim - inicio > 999) { setResult({ ok: false, msg: 'Range máximo de 1.000 números por inutilização' }); return }
    }
    if (!justOk) {
      setResult({ ok: false, msg: 'Justificativa deve ter pelo menos 15 caracteres' }); return
    }

    setLoading(true)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/inutilizar-nfce`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ companyId, serie, nInicio: inicio, nFim: fim, justificativa: justificativa.trim() }),
        }
      )

      const data = await res.json()

      if (data.ok) {
        const range = inicio === fim ? `nº ${inicio}` : `nº ${inicio} a ${fim}`
        const msg = `Inutilização homologada — ${range} · Protocolo: ${data.nProt}`
        setResult({ ok: true, msg })
        onSuccess?.(msg)
      } else {
        const motivo = data.cStat
          ? `[cStat ${data.cStat}] ${data.xMotivo}`
          : data.error ?? 'Erro desconhecido'
        setResult({ ok: false, msg: motivo })
      }
    } catch (e: any) {
      setResult({ ok: false, msg: e.message ?? 'Erro ao comunicar com a Edge Function' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 70,
    }}>
      <div style={{
        background: C.surface, borderRadius: 16, padding: 28,
        width: 460, maxWidth: '96vw',
        display: 'flex', flexDirection: 'column', gap: 18,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        border: `1px solid ${C.border}`,
      }}>

        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: C.yellowBg, border: `1px solid #fde68a`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>🚫</div>
            <div>
              <p style={{ fontSize: 11, color: C.txtMuted }}>
                Série {(serie ?? '').padStart(3, '0')} · {companyId.slice(0, 8)}...
              </p>
              <p style={{ fontSize: 11, color: C.txtMuted }}>Série {serie.padStart(3, '0')} · {companyId.slice(0, 8)}...</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`,
            background: C.surface, cursor: 'pointer', fontSize: 14, color: C.txtMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
          }}>✕</button>
        </div>

        {/* Aviso */}
        <div style={{
          background: C.yellowBg, border: `1px solid #fde68a`,
          borderRadius: 8, padding: '10px 14px',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <p style={{ fontSize: 12, color: C.yellow, lineHeight: 1.6 }}>
            A inutilização é <strong>irreversível</strong>. Use apenas para números que não foram
            e não serão utilizados. A SEFAZ rejeitará novas emissões com esses números.
          </p>
        </div>

        {/* Modo: único ou range */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.txtSec, marginBottom: 8 }}>Tipo de inutilização</p>
          <div style={{ display: 'flex', gap: 4, background: '#f1f3f7', borderRadius: 8, padding: 3 }}>
            {(['unico', 'range'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setResult(null) }}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                  background: mode === m ? C.surface : 'transparent',
                  color: mode === m ? C.txtPri : C.txtMuted,
                  boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
                {m === 'unico' ? '🔢 Número único' : '📋 Range de números'}
              </button>
            ))}
          </div>
        </div>

        {/* Campos de número */}
        {mode === 'unico' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.txtSec }}>
              Número da NFC-e <span style={{ color: C.red }}>*</span>
            </label>
            <input
              autoFocus
              type="number" min="1" value={nNumero}
              onChange={e => { setNNumero(e.target.value); setResult(null) }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Ex: 42"
              style={{
                background: C.bg, border: `1.5px solid ${C.border}`,
                borderRadius: 8, padding: '10px 12px', fontSize: 14,
                color: C.txtPri, outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = C.indigo)}
              onBlur={e => (e.target.style.borderColor = C.border)}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.txtSec }}>
                Nº inicial <span style={{ color: C.red }}>*</span>
              </label>
              <input
                autoFocus
                type="number" min="1" value={nInicio}
                onChange={e => { setNInicio(e.target.value); setResult(null) }}
                placeholder="Ex: 40"
                style={{
                  background: C.bg, border: `1.5px solid ${C.border}`,
                  borderRadius: 8, padding: '10px 12px', fontSize: 14,
                  color: C.txtPri, outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = C.indigo)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
              <span style={{ fontSize: 16, color: C.txtMuted }}>→</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.txtSec }}>
                Nº final <span style={{ color: C.red }}>*</span>
              </label>
              <input
                type="number" min="1" value={nFim}
                onChange={e => { setNFim(e.target.value); setResult(null) }}
                placeholder="Ex: 45"
                style={{
                  background: C.bg, border: `1.5px solid ${C.border}`,
                  borderRadius: 8, padding: '10px 12px', fontSize: 14,
                  color: C.txtPri, outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = C.indigo)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>
          </div>
        )}

        {/* Justificativa */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: C.txtSec }}>
              Justificativa <span style={{ color: C.red }}>*</span>
            </label>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: justOk ? C.green : justLen > 0 ? C.yellow : C.txtMuted,
            }}>
              {justLen}/255 {justLen < 15 ? `(mín. ${15 - justLen} car. faltando)` : '✓'}
            </span>
          </div>
          <textarea
            value={justificativa}
            onChange={e => { setJustificativa(e.target.value); setResult(null) }}
            placeholder="Ex: Números não utilizados por erro de sistema durante manutenção"
            rows={3}
            maxLength={255}
            style={{
              background: C.bg, border: `1.5px solid ${justLen > 0 && !justOk ? C.yellow : C.border}`,
              borderRadius: 8, padding: '10px 12px', fontSize: 13,
              color: C.txtPri, outline: 'none', resize: 'vertical',
              width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5,
            }}
            onFocus={e => (e.target.style.borderColor = C.indigo)}
            onBlur={e => (e.target.style.borderColor = justLen > 0 && !justOk ? C.yellow : C.border)}
          />
        </div>

        {/* Resultado */}
        {result && (
          <div style={{
            background: result.ok ? '#f0fdf4' : C.redBg,
            border: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: 8, padding: '10px 14px',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{result.ok ? '✅' : '❌'}</span>
            <p style={{ fontSize: 12, color: result.ok ? C.green : C.red, lineHeight: 1.5, margin: 0 }}>
              {result.msg}
            </p>
          </div>
        )}

        {/* Botões */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.surface,
              cursor: 'pointer', fontSize: 13, color: C.txtSec, fontWeight: 500,
            }}
          >
            {result?.ok ? 'Fechar' : 'Cancelar'}
          </button>

          {!result?.ok && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                flex: 2, padding: '11px 0', borderRadius: 8, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? '#fca5a5' : C.red,
                color: '#fff', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: loading ? 0.8 : 1, transition: 'all 0.15s',
                boxShadow: loading ? 'none' : '0 2px 8px rgba(220,38,38,0.25)',
              }}
            >
              {loading
                ? <><span style={{ fontSize: 14 }}>⏳</span> Transmitindo...</>
                : <><span style={{ fontSize: 14 }}>🚫</span> Confirmar inutilização</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}