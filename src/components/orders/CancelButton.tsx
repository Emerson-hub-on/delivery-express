import { useState } from 'react'

interface CancelButtonProps {
  cancelling: boolean
  onCancel: () => void
}

export function CancelButton({ cancelling, onCancel }: CancelButtonProps) {
  const [confirming, setConfirming] = useState(false)

  const handleClick    = (e: React.MouseEvent) => { e.stopPropagation(); setConfirming(true)  }
  const handleConfirm  = (e: React.MouseEvent) => { e.stopPropagation(); setConfirming(false); onCancel() }
  const handleDismiss  = (e: React.MouseEvent) => { e.stopPropagation(); setConfirming(false) }

  return (
    <div onClick={e => e.stopPropagation()}>
      {!confirming && (
        <button
          onClick={handleClick}
          disabled={cancelling}
          className="text-xs px-3 py-1.5 bg-red-700 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cancelling ? 'Cancelando...' : 'Cancelar pedido'}
        </button>
      )}

      {confirming && !cancelling && (
        <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-medium text-red-700 mb-1">Cancelar este pedido?</p>
          <p className="text-xs text-red-500 mb-3">Essa ação não pode ser desfeita.</p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="flex-1 text-xs py-2 bg-red-700 text-white rounded-lg font-medium hover:bg-red-800 transition-colors"
            >
              Sim, cancelar
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 text-xs py-2 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Não, voltar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
