'use client'
import { ProductSize } from '@/types/product'

interface Props {
  /** Tamanhos disponíveis na categoria (ex: ['P','M','G','GG']) */
  availableSizes: string[]
  /** Valor atual do produto */
  value: ProductSize[]
  onChange: (sizes: ProductSize[]) => void
}

export function ProductSizeStock({ availableSizes, value, onChange }: Props) {
  if (!availableSizes.length) return null

  const getEntry = (v: string) => value.find(s => s.value === v)

  const toggle = (v: string) => {
    if (getEntry(v)) {
      onChange(value.filter(s => s.value !== v))
    } else {
      onChange([...value, { value: v, stock: null }])
    }
  }

  const setStock = (v: string, raw: string) => {
    const stock = raw === '' ? null : Math.max(0, parseInt(raw) || 0)
    onChange(value.map(s => s.value === v ? { ...s, stock } : s))
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-600">
        Tamanhos e estoque
      </label>
      <p className="text-xs text-gray-400 -mt-1">
        Selecione os tamanhos disponíveis. Deixe o estoque em branco para não controlar.
      </p>

      <div className="flex flex-wrap gap-3">
        {availableSizes.map(v => {
          const entry = getEntry(v)
          const active = !!entry

          return (
            <div key={v} className="flex flex-col items-center gap-1.5">

              {/* Toggle do tamanho */}
              <button
                type="button"
                onClick={() => toggle(v)}
                className={`w-12 h-8 rounded-lg text-sm font-medium border transition-colors shrink-0 ${
                  active
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                }`}
              >
                {v}
              </button>

            {active ? (
            <input
                type="number"
                min={0}
                placeholder="∞"
                value={entry.stock ?? ''}
                onChange={e => setStock(v, e.target.value)}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-black"
            />
            ) : (
            <span className="w-16 h-7.5" />
            )}
            </div>
          )
        })}
      </div>

      {/* Resumo */}
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {value.map(s => (
            <span
              key={s.value}
              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
            >
              {s.value}
              {s.stock !== null && (
                <span className="text-gray-400 ml-1">({s.stock} uni)</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}