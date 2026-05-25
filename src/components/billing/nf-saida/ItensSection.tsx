'use client'
import { Plus, Trash2, Search, Barcode, Hash, X } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useRef, useState, useCallback } from 'react'
import type { ItemNota } from './types'
import { searchProdutos, type ProdutoResult } from '@/services/searchProducts'

interface Props {
  itens: ItemNota[]
  cfopBadgeLabel: string
  companyId: string
  onChange: (itens: ItemNota[]) => void
}

export function ItensSection({ itens, cfopBadgeLabel, companyId, onChange }: Props) {

  function addItem() {
    onChange([...itens, {
      id: nanoid(), produto_desc: '', ncm: '', cfop: '', cst_csosn: '',
      quantidade: 1, valor_unit: 0, valor_total: 0,
    }])
  }

  function removeItem(id: string) {
    if (itens.length === 1) return
    onChange(itens.filter(i => i.id !== id))
  }

  function updateItem<K extends keyof ItemNota>(id: string, key: K, raw: string) {
    onChange(itens.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [key]: raw }
      const qty  = key === 'quantidade' ? Number(raw)   : item.quantidade
      const unit = key === 'valor_unit' ? parseBrl(raw) : item.valor_unit
      updated.valor_total = qty * unit
      if (key === 'quantidade') updated.quantidade = Number(raw)
      if (key === 'valor_unit') updated.valor_unit = parseBrl(raw)
      return updated
    }))
  }

  function applyProduct(itemId: string, p: ProdutoResult) {
    onChange(itens.map(item => {
      if (item.id !== itemId) return item
      return {
        ...item,
        produto_desc: p.nome,
        ncm:          p.ncm  ?? item.ncm,
        cfop:         p.cfop ?? item.cfop,
        cst_csosn:    p.cst_csosn ?? item.cst_csosn,
        valor_unit:   p.preco,
        valor_total:  item.quantidade * p.preco,
      }
    }))
  }

  return (
    <div className="bg-white border border-gray-300 rounded-xl mb-3.5 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300 bg-gray-100">
        <span className="text-[11px] font-bold text-gray-600 tracking-wider uppercase">Itens da nota</span>
        <span className="bg-blue-100 border border-blue-300 rounded-md px-2.5 py-1 text-xs text-blue-800 font-semibold">
          {cfopBadgeLabel}
        </span>
      </div>

      <div className="p-4">
        {/* Cabeçalho das colunas */}
        <div className="grid gap-1.5 mb-2 px-1"
          style={{ gridTemplateColumns: '2fr .7fr .7fr .8fr .5fr .8fr .8fr 32px' }}>
          {['Produto / descrição', 'NCM', 'CFOP', 'CST/CSOSN', 'Qtd', 'Vlr unit', 'Total', ''].map((h, i) => (
            <span key={i} className="text-[10px] text-gray-500 uppercase tracking-wide font-bold">{h}</span>
          ))}
        </div>

        {/* Linhas de itens */}
        <div className="space-y-1.5">
          {itens.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              companyId={companyId}
              onUpdate={updateItem}
              onRemove={removeItem}
              onApplyProduct={applyProduct}
              canRemove={itens.length > 1}
            />
          ))}
        </div>

        <button type="button" onClick={addItem}
          className="flex items-center justify-center gap-1.5 w-full mt-3
            border border-dashed border-gray-400 hover:border-blue-500 hover:bg-blue-50
            rounded-lg py-2 text-xs text-gray-600 hover:text-blue-700 font-medium transition-colors">
          <Plus size={13} />Adicionar item
        </button>
      </div>
    </div>
  )
}

// ── Linha individual com autocomplete ────────────────────────────────────────

interface ItemRowProps {
  item: ItemNota
  companyId: string
  canRemove: boolean
  onUpdate: <K extends keyof ItemNota>(id: string, key: K, raw: string) => void
  onRemove: (id: string) => void
  onApplyProduct: (itemId: string, p: ProdutoResult) => void
}

function ItemRow({ item, companyId, canRemove, onUpdate, onRemove, onApplyProduct }: ItemRowProps) {
  const [query, setQuery]       = useState(item.produto_desc)
  const [results, setResults]   = useState<ProdutoResult[]>([])
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef              = useRef<HTMLDivElement>(null)

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    onUpdate(item.id, 'produto_desc', value)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setResults([]); setOpen(false); return }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchProdutos(value, companyId)
        setResults(data)
        setOpen(data.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [item.id, companyId, onUpdate])

  const handleSelect = useCallback((p: ProdutoResult) => {
    setQuery(p.nome)
    setOpen(false)
    setResults([])
    onApplyProduct(item.id, p)
  }, [item.id, onApplyProduct])

  const handleClear = useCallback(() => {
    setQuery('')
    setResults([])
    setOpen(false)
    ;(['produto_desc', 'ncm', 'cfop', 'cst_csosn'] as const).forEach(key => onUpdate(item.id, key, ''))
    onUpdate(item.id, 'valor_unit', '0')
    onUpdate(item.id, 'valor_total', '0')
  }, [item.id, onUpdate])

  // Fecha ao clicar fora
  const handleBlur = useCallback(() => {
    setTimeout(() => setOpen(false), 150)
  }, [])

  return (
    <div className="grid items-center gap-1.5"
      style={{ gridTemplateColumns: '2fr .7fr .7fr .8fr .5fr .8fr .8fr 32px' }}>

      {/* Campo produto com autocomplete */}
      <div ref={wrapperRef} className="relative">
        <div className="relative">
          {loading
            ? <span className="absolute left-2 top-1/2 -translate-y-1/2">
                <svg className="animate-spin h-3 w-3 text-blue-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </span>
            : <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          }
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={handleBlur}
            placeholder="Nome, cód. ou EAN"
            className="bg-gray-50 border border-gray-300 hover:border-gray-400 focus:border-blue-500
              focus:ring-1 focus:ring-blue-200 focus:bg-white rounded-lg pl-6 pr-6 py-[6px]
              text-xs text-gray-900 placeholder-gray-400 outline-none transition-colors w-full"
          />
          {query && (
            <button
              type="button"
              onMouseDown={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <ul className="absolute z-50 mt-0.5 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {results.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  onMouseDown={() => handleSelect(p)}
                  className="w-full flex items-start gap-2 px-3 py-2 hover:bg-blue-50
                    transition-colors text-left border-b border-gray-100 last:border-0"
                >
                  <span className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-medium text-gray-800 truncate">{p.nome}</span>
                    <span className="text-[10px] text-gray-400 flex gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5">
                        <Hash size={9} />{p.code}
                      </span>
                      {p.ean && (
                        <span className="flex items-center gap-0.5">
                          <Barcode size={9} />{p.ean}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-blue-600 shrink-0">
                    {formatBrl(p.preco)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Cell value={item.ncm} placeholder="00000000" maxLength={8}
        onChange={v => onUpdate(item.id, 'ncm', v.replace(/\D/g, ''))} />
      <Cell value={item.cfop} placeholder="5102" maxLength={4}
        onChange={v => onUpdate(item.id, 'cfop', v.replace(/\D/g, ''))} />
      <Cell value={item.cst_csosn} placeholder="400" maxLength={3}
        onChange={v => onUpdate(item.id, 'cst_csosn', v.replace(/\D/g, ''))} />

      <input type="number" min={0} value={item.quantidade || ''} placeholder="1"
        onChange={e => onUpdate(item.id, 'quantidade', e.target.value)}
        className="bg-gray-50 border border-gray-300 hover:border-gray-400 focus:border-blue-500
          focus:ring-1 focus:ring-blue-200 focus:bg-white rounded-lg px-2 py-[6px]
          text-xs text-gray-900 placeholder-gray-400 outline-none transition-colors w-full"
      />

      <Cell value={item.valor_unit ? formatBrl(item.valor_unit) : ''} placeholder="R$ 0,00"
        onChange={v => onUpdate(item.id, 'valor_unit', v)} />

      <input type="text" readOnly value={item.valor_total ? formatBrl(item.valor_total) : ''} placeholder="R$ 0,00"
        className="bg-gray-100 border border-gray-300 rounded-lg px-2 py-[6px] text-xs text-gray-600 outline-none w-full cursor-default"
      />

      <button type="button" onClick={() => onRemove(item.id)} disabled={!canRemove}
        aria-label="Remover item"
        className="flex items-center justify-center w-8 h-8 border border-gray-300
          rounded-lg text-gray-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50
          disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function Cell({ value, onChange, placeholder, maxLength }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number
}) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} maxLength={maxLength}
      className="bg-gray-50 border border-gray-300 hover:border-gray-400 focus:border-blue-500
        focus:ring-1 focus:ring-blue-200 focus:bg-white rounded-lg px-2 py-[6px]
        text-xs text-gray-900 placeholder-gray-400 outline-none transition-colors w-full"
    />
  )
}

function formatBrl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function parseBrl(s: string): number {
  return parseFloat(s.replace(/[^\d,]/g, '').replace(',', '.')) || 0
}