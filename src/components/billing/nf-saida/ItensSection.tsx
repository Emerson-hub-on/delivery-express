'use client'
import { Plus, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { ItemNota } from './types'

interface Props {
  itens: ItemNota[]
  cfopBadgeLabel: string
  onChange: (itens: ItemNota[]) => void
}

export function ItensSection({ itens, cfopBadgeLabel, onChange }: Props) {
  function addItem() {
    onChange([
      ...itens,
      {
        id: nanoid(),
        produto_desc: '',
        ncm: '',
        cfop: '',
        cst_csosn: '',
        quantidade: 1,
        valor_unit: 0,
        valor_total: 0,
      },
    ])
  }

  function removeItem(id: string) {
    if (itens.length === 1) return
    onChange(itens.filter(i => i.id !== id))
  }

  function updateItem<K extends keyof ItemNota>(id: string, key: K, raw: string) {
    onChange(
      itens.map(item => {
        if (item.id !== id) return item
        const updated = { ...item, [key]: raw }
        // recalcula total
        const qty  = key === 'quantidade' ? Number(raw) : item.quantidade
        const unit = key === 'valor_unit' ? parseBrl(raw) : item.valor_unit
        updated.valor_total = qty * unit
        if (key === 'quantidade') updated.quantidade = Number(raw)
        if (key === 'valor_unit') updated.valor_unit = parseBrl(raw)
        return updated
      })
    )
  }

  return (
    <div className="bg-[#22262b] border border-[#2e3238] rounded-xl mb-3.5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e3238]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#a0a5ad] tracking-wider uppercase">
            Itens da nota
          </span>
        </div>
        <span className="flex items-center gap-1.5 bg-[#1e3a5a] border border-[#2a4f75]
          rounded-md px-2.5 py-1 text-[11px] text-[#6c9fd4]">
          {cfopBadgeLabel}
        </span>
      </div>

      <div className="p-4">
        {/* Cabeçalho da tabela */}
        <div className="grid gap-1.5 mb-2 px-1"
          style={{ gridTemplateColumns: '2fr .7fr .7fr .8fr .5fr .8fr .8fr 32px' }}>
          {['Produto / descrição','NCM','CFOP','CST/CSOSN','Qtd','Vlr unit','Total',''].map((h, i) => (
            <span key={i} className="text-[10px] text-[#5a5f66] uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {/* Linhas de itens */}
        <div className="space-y-1.5">
          {itens.map(item => (
            <div
              key={item.id}
              className="grid items-center gap-1.5"
              style={{ gridTemplateColumns: '2fr .7fr .7fr .8fr .5fr .8fr .8fr 32px' }}
            >
              <Cell
                value={item.produto_desc}
                placeholder="Nome do produto"
                onChange={v => updateItem(item.id, 'produto_desc', v)}
              />
              <Cell
                value={item.ncm}
                placeholder="00000000"
                maxLength={8}
                onChange={v => updateItem(item.id, 'ncm', v.replace(/\D/g, ''))}
              />
              <Cell
                value={item.cfop}
                placeholder="5102"
                maxLength={4}
                onChange={v => updateItem(item.id, 'cfop', v.replace(/\D/g, ''))}
              />
              <Cell
                value={item.cst_csosn}
                placeholder="400"
                maxLength={3}
                onChange={v => updateItem(item.id, 'cst_csosn', v.replace(/\D/g, ''))}
              />
              <input
                type="number"
                min={0}
                value={item.quantidade || ''}
                onChange={e => updateItem(item.id, 'quantidade', e.target.value)}
                placeholder="1"
                className="bg-[#1a1c1e] border border-[#3a3d42] focus:border-[#4a7ab5]
                  rounded-md px-2 py-[6px] text-[12px] text-[#e2e4e6] placeholder-[#4a4f56]
                  outline-none transition-colors w-full"
              />
              <Cell
                value={item.valor_unit ? formatBrl(item.valor_unit) : ''}
                placeholder="R$ 0,00"
                onChange={v => updateItem(item.id, 'valor_unit', v)}
              />
              <input
                type="text"
                value={item.valor_total ? formatBrl(item.valor_total) : ''}
                readOnly
                placeholder="R$ 0,00"
                className="bg-[#1a1c1e] border border-[#2e3238] rounded-md px-2 py-[6px]
                  text-[12px] text-[#7a7f86] outline-none w-full cursor-default"
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={itens.length === 1}
                aria-label="Remover item"
                className="flex items-center justify-center w-8 h-8 border border-[#3a3d42]
                  rounded-md text-[#5a5f66] hover:border-[#c0432a] hover:text-[#e26b5a]
                  disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addItem}
          className="flex items-center justify-center gap-1.5 w-full mt-3
            border border-dashed border-[#3a3d42] hover:border-[#4a7ab5]
            rounded-md py-2 text-[12px] text-[#7a7f86] hover:text-[#6c8ebf]
            transition-colors"
        >
          <Plus size={13} />
          Adicionar item
        </button>
      </div>
    </div>
  )
}

/* ── helpers ─────────────────────────────────────────────────── */
function Cell({
  value, onChange, placeholder, maxLength,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="bg-[#1a1c1e] border border-[#3a3d42] focus:border-[#4a7ab5]
        rounded-md px-2 py-[6px] text-[12px] text-[#e2e4e6] placeholder-[#4a4f56]
        outline-none transition-colors w-full"
    />
  )
}

function formatBrl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseBrl(s: string): number {
  const clean = s.replace(/[^\d,]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}
