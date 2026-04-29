'use client'
import { useState } from 'react'
import { Tab } from './types'

type ReportSubTab = 'overview' | 'products' | 'categories' | 'inventory'

interface AdminTabsProps {
  tab: Tab
  onChange: (tab: Tab) => void
  reportSubTab: ReportSubTab
  onReportSubTabChange: (sub: ReportSubTab) => void
}

const CADASTRO_TABS: Tab[] = ['products', 'categories', 'motoboys']

const TAB_LABELS: Record<Tab, string> = {
  products:   'Produtos',
  categories: 'Categorias',
  orders:     'Pedidos',
  reports:    'Relatórios',
  motoboys:   'Motoboys',
  fiscal:     'Fiscal',
  settings:   'Configurações',
  cash:       'Caixa',
  ifood:      'iFood Sync',
}

const TAB_ICONS: Record<Tab, string> = {
  products:   '📦',
  categories: '🗂️',
  orders:     '🛒',
  reports:    '📊',
  motoboys:   '🏍️',
  fiscal:     '🧾',
  settings:   '⚙️',
  cash:       '🏪',
  ifood:      '🟠',
}

const REPORT_SUB_TABS: { id: ReportSubTab; label: string; icon: string }[] = [
  { id: 'overview',   label: 'Visão Geral',           icon: '📈' },
  { id: 'products',   label: 'Produtos mais vendidos', icon: '📦' },
  { id: 'categories', label: 'Por Categoria',          icon: '🗂️' },
  { id: 'inventory',  label: 'Inventário',             icon: '🏷️' },
]

const SIDEBAR_BG      = 'bg-[#0f2137]'
const SIDEBAR_BORDER  = 'border-[#1a3a5c]'
const TEXT_DEFAULT    = 'text-[#8faec9]'
const TEXT_HOVER      = 'hover:text-white'
const BG_HOVER        = 'hover:bg-[#1a3a5c]'
const ACTIVE_BG       = 'bg-orange-500'
const ACTIVE_TEXT     = 'text-white'
const GROUP_ACTIVE_BG = 'bg-[#1a3a5c]'
const GROUP_ACTIVE_TEXT = 'text-white'
const DIVIDER         = 'border-[#1a3a5c]'

export function AdminTabs({ tab, onChange, reportSubTab, onReportSubTabChange }: AdminTabsProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cadastroOpen, setCadastroOpen] = useState(() => CADASTRO_TABS.includes(tab))
  const [reportsOpen, setReportsOpen] = useState(() => tab === 'reports')

  const handleChange = (t: Tab) => {
    onChange(t)
    setMobileOpen(false)
  }

  const handleReportsClick = () => {
    if (tab !== 'reports') {
      onChange('reports')
      setReportsOpen(true)
    } else {
      setReportsOpen(o => !o)
    }
  }

  const sidebarContent = (
    <>
      {/* Logo / marca */}
      <div className="px-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚀</span>
          <span className="text-white font-bold text-base tracking-tight">deliveryExpress</span>
        </div>
        <p className="text-[#8faec9] text-[10px] mt-0.5 ml-7">Painel administrativo</p>
      </div>

      <div className={`border-t ${DIVIDER} mb-3`} />

      {/* Cadastros */}
      <div>
        <button
          onClick={() => setCadastroOpen(o => !o)}
          className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
            ${CADASTRO_TABS.includes(tab)
              ? `${GROUP_ACTIVE_BG} ${GROUP_ACTIVE_TEXT}`
              : `${TEXT_DEFAULT} ${TEXT_HOVER} ${BG_HOVER}`}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-base">🗃️</span>
            Cadastros
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`transition-transform duration-200 ${cadastroOpen ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {cadastroOpen && (
          <div className={`mt-1 ml-3 flex flex-col gap-1 border-l ${DIVIDER} pl-3`}>
            {CADASTRO_TABS.map(t => (
              <button key={t} onClick={() => handleChange(t)}
                className={`flex items-center gap-3 text-sm px-3 py-2 rounded-lg transition-colors font-medium w-full text-left
                  ${tab === t
                    ? `${ACTIVE_BG} ${ACTIVE_TEXT}`
                    : `${TEXT_DEFAULT} ${TEXT_HOVER} ${BG_HOVER}`}`}>
                <span className="text-base">{TAB_ICONS[t]}</span>
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pedidos */}
      <button onClick={() => handleChange('orders')}
        className={`flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg transition-colors font-medium w-full text-left
          ${tab === 'orders'
            ? `${ACTIVE_BG} ${ACTIVE_TEXT}`
            : `${TEXT_DEFAULT} ${TEXT_HOVER} ${BG_HOVER}`}`}>
        <span className="text-base">{TAB_ICONS.orders}</span>
        {TAB_LABELS.orders}
      </button>

      {/* Caixa */}
      <button onClick={() => handleChange('cash')}
        className={`flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg transition-colors font-medium w-full text-left
          ${tab === 'cash'
            ? `${ACTIVE_BG} ${ACTIVE_TEXT}`
            : `${TEXT_DEFAULT} ${TEXT_HOVER} ${BG_HOVER}`}`}>
        <span className="text-base">{TAB_ICONS.cash}</span>
        {TAB_LABELS.cash}
      </button>

      {/* Relatórios */}
      <div>
        <button
          onClick={handleReportsClick}
          className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
            ${tab === 'reports'
              ? `${GROUP_ACTIVE_BG} ${GROUP_ACTIVE_TEXT}`
              : `${TEXT_DEFAULT} ${TEXT_HOVER} ${BG_HOVER}`}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-base">📊</span>
            Relatórios
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`transition-transform duration-200 ${reportsOpen ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {reportsOpen && tab === 'reports' && (
          <div className={`mt-1 ml-3 flex flex-col gap-1 border-l ${DIVIDER} pl-3`}>
            {REPORT_SUB_TABS.map(s => (
              <button key={s.id} onClick={() => { onReportSubTabChange(s.id); setMobileOpen(false) }}
                className={`flex items-center gap-3 text-sm px-3 py-2 rounded-lg transition-colors font-medium w-full text-left
                  ${reportSubTab === s.id
                    ? `${ACTIVE_BG} ${ACTIVE_TEXT}`
                    : `${TEXT_DEFAULT} ${TEXT_HOVER} ${BG_HOVER}`}`}>
                <span className="text-base">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={`border-t ${DIVIDER} my-2`} />

      {/* iFood Sync */}
      <button onClick={() => handleChange('ifood')}
        className={`flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg transition-colors font-medium w-full text-left
          ${tab === 'ifood'
            ? `${ACTIVE_BG} ${ACTIVE_TEXT}`
            : `${TEXT_DEFAULT} ${TEXT_HOVER} ${BG_HOVER}`}`}>
        <span className="text-base">🟠</span>
        {TAB_LABELS.ifood}
      </button>

      <div className={`border-t ${DIVIDER} my-2`} />

      {/* Fiscal + Configurações */}
      {(['fiscal', 'settings'] as Tab[]).map(t => (
        <button key={t} onClick={() => handleChange(t)}
          className={`flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg transition-colors font-medium w-full text-left
            ${tab === t
              ? `${ACTIVE_BG} ${ACTIVE_TEXT}`
              : `${TEXT_DEFAULT} ${TEXT_HOVER} ${BG_HOVER}`}`}>
          <span className="text-base">{TAB_ICONS[t]}</span>
          {TAB_LABELS[t]}
        </button>
      ))}

      <div className={`mt-auto border-t ${DIVIDER} pt-4 px-1`}>
        <p className="text-[10px] text-[#4a6a8a] text-center">
          © 2026 deliveryExpress
        </p>
      </div>
    </>
  )

  return (
    <>
      <button onClick={() => setMobileOpen(true)}
        className={`md:hidden fixed top-4 left-4 z-50 ${SIDEBAR_BG} border ${SIDEBAR_BORDER} rounded-lg p-2 shadow-md`}
        aria-label="Abrir menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8faec9" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 ${SIDEBAR_BG} border-r ${SIDEBAR_BORDER}
        flex flex-col py-6 px-3 gap-1 z-50
        transition-transform duration-300 ease-in-out md:hidden
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="font-semibold text-white">Menu</span>
          <button onClick={() => setMobileOpen(false)} className="text-[#8faec9] hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {sidebarContent}
      </aside>

      <aside className={`hidden md:flex w-56 self-stretch ${SIDEBAR_BG} border-r ${SIDEBAR_BORDER} flex-col py-6 px-3 gap-1 shrink-0`}>
        {sidebarContent}
      </aside>
    </>
  )
}
