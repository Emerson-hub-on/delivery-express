'use client'
import { useEffect, useState } from 'react'
import { CashRegister } from '@/types/cash-register'
import { getOpenCashRegister, getCompanyOpeningTime } from '@/services/cash-register'
import { CashOpeningView } from '../tabs/CashOpeningView'
import { CashClosingView } from '../tabs/CashClosingView'
import { OperatorsView } from '../tabs/OperatorsView'

type CashSubTab = 'register' | 'operators'

export function CashTab() {
  const [subTab, setSubTab] = useState<CashSubTab>('register')
  const [openCash, setOpenCash] = useState<CashRegister | null | undefined>(undefined)
  const [openingTime, setOpeningTime] = useState('08:00')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [cash, time] = await Promise.all([
        getOpenCashRegister(),
        getCompanyOpeningTime(),
      ])
      setOpenCash(cash)
      setOpeningTime(time)
    } catch (e) {
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
          { id: 'register' as CashSubTab, label: '🏪 Abertura / Fechamento' },
          { id: 'operators' as CashSubTab, label: '👥 Operadores' },
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
          {/* Status badge */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`w-2.5 h-2.5 rounded-full ${openCash ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-sm font-medium text-gray-600">
              {openCash
                ? `Caixa aberto desde ${new Date(openCash.opening_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} por ${openCash.operator_name}`
                : 'Caixa fechado'}
            </span>
          </div>

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
        <OperatorsView />
      )}
    </div>
  )
}
