'use client'
import { useEffect, useState } from 'react'
import { CashRegister } from '@/types/cash-register'
import { getOpenCashRegister, getCompanyOpeningTime } from '@/services/cash-register'
import { CashOpeningView } from '../tabs/CashOpeningView'
import { CashClosingView } from '../tabs/CashClosingView'
import { OperatorsView } from '../tabs/OperatorsView'
import { CashHistoryView } from '../tabs/CashHistoryView'

type CashSubTab = 'register' | 'operators' | 'history'

export function CashTab() {
  const [subTab,           setSubTab]           = useState<CashSubTab>('register')
  const [openCash,         setOpenCash]         = useState<CashRegister | null | undefined>(undefined)
  const [openingTime,      setOpeningTime]      = useState('08:00')
  const [loading,          setLoading]          = useState(true)
  const [showOperatorForm, setShowOperatorForm] = useState(false)

  const load = async () => {
    try {
      const [cash, time] = await Promise.all([
        getOpenCashRegister(),
        getCompanyOpeningTime(),
      ])
      setOpenCash(cash)
      setOpeningTime(time)
    } catch {
      setOpenCash(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="text-center py-16 text-gray-400 text-sm">Carregando caixa...</div>
  )

  return (
    <div className="mt-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {([
          { id: 'register'  as CashSubTab, label: '🏪 Abertura / Fechamento' },
          { id: 'operators' as CashSubTab, label: '👥 Operadores' },
          { id: 'history'   as CashSubTab, label: '📋 Histórico de Turnos' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors
              ${subTab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'register' && (
        <>
          {/* Status badge + botão atualizar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${openCash ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-sm font-medium text-gray-600">
                {openCash
                  ? `Caixa aberto desde ${new Date(openCash.opening_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} por ${openCash.operator_name}`
                  : 'Caixa fechado'}
              </span>
            </div>
            <button
              onClick={load}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              🔄 Atualizar
            </button>
          </div>

          {/* Aviso admin quando caixa está aberto por operador */}
          {openCash && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Caixa em uso por {openCash.operator_name}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Caso o operador não possa fazer o fechamento, você pode realizá-lo abaixo como administrador.
                </p>
              </div>
            </div>
          )}

          {/* Link para o PDV */}
          {openCash && (
            <a
              href={`${typeof window !== 'undefined' ? `/${window.location.pathname.split('/')[1]}/pdv` : '/pdv'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mb-6 text-sm font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 hover:bg-orange-100 transition-colors"
            >
              ◧ Abrir PDV
              <span className="text-xs text-orange-400">↗ nova aba</span>
            </a>
          )}

          {openCash ? (
            <CashClosingView
              cashRegister={openCash}
              onClosed={() => { setOpenCash(null); load() }}
            />
          ) : (
            <CashOpeningView
              openingTime={openingTime}
              onOpened={(cash) => setOpenCash(cash)}
            />
          )}
        </>
      )}

      {subTab === 'operators' && (
        <OperatorsView
          showForm={showOperatorForm}
          setShowForm={setShowOperatorForm}
        />
      )}

      {subTab === 'history' && <CashHistoryView />}
    </div>
  )
}