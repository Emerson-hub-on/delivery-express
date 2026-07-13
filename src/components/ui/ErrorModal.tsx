'use client'
import { useEffect } from 'react'

type Props = {
  message: string
  type?: 'error' | 'success' | 'warning'
  onClose: () => void
  autoClose?: number // ms, 0 = não fecha automaticamente
}

const CONFIG = {
  error:   { icon: '❌', bg: 'bg-red-50',    border: 'border-red-200',   title: 'Erro',    btn: 'bg-red-600 hover:bg-red-700' },
  success: { icon: '✅', bg: 'bg-green-50',  border: 'border-green-200', title: 'Sucesso', btn: 'bg-green-600 hover:bg-green-700' },
  warning: { icon: '⚠️', bg: 'bg-amber-50',  border: 'border-amber-200', title: 'Atenção', btn: 'bg-amber-500 hover:bg-amber-600' },
}

export function ErrorModal({ message, type = 'error', onClose, autoClose = 6000 }: Props) {
  const c = CONFIG[type]

  useEffect(() => {
    if (!autoClose) return
    const t = setTimeout(onClose, autoClose)
    return () => clearTimeout(t)
  }, [autoClose, onClose])

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* card */}
      <div className={`relative w-full max-w-sm rounded-2xl border ${c.border} ${c.bg} shadow-2xl p-6 flex flex-col items-center gap-4 text-center`}>
        <span className="text-4xl">{c.icon}</span>

        <div>
          <p className="text-sm font-semibold text-gray-900 mb-1">{c.title}</p>
          <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        </div>

        {/* barra de progresso */}
        {autoClose > 0 && (
          <div className="w-full h-1 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gray-400 origin-left"
              style={{ animation: `shrink ${autoClose}ms linear forwards` }}
            />
          </div>
        )}

        <button
          onClick={onClose}
          className={`${c.btn} text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors`}
        >
          OK
        </button>
      </div>

      <style>{`
        @keyframes shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  )
}