'use client'
import { useState } from 'react'
import { Tab } from './types'
import type { BillingSubTab } from '@/types/billing'

type ReportSubTab = 'overview' | 'products' | 'categories' | 'inventory'

interface AdminTabsProps {
  tab: Tab
  onChange: (tab: Tab) => void
  reportSubTab: ReportSubTab
  onReportSubTabChange: (sub: ReportSubTab) => void
  billingSubTab: BillingSubTab
  onBillingSubTabChange: (sub: BillingSubTab) => void
}

const BILLING_SUB_TABS: { id: BillingSubTab; label: string }[] = [
  { id: 'nf-entrada',           label: 'Entrada de NF' },
  { id: 'nf-saida',             label: 'Saída / Faturamento' },
  { id: 'nf-saida-gerenciador', label: 'Gerenciador de NF-e' },
]

const CADASTRO_TABS: Tab[] = ['products', 'categories', 'motoboys', 'customers', 'operators']

const TAB_LABELS: Record<Tab, string> = {
  products:   'Produtos',
  categories: 'Categorias',
  orders:     'Pedidos',
  reports:    'Relatórios',
  motoboys:   'Motoboys',
  fiscal:     'Fiscal',
  billing:    'Faturamento',
  settings:   'Configurações',
  ifood:      'iFood Sync',
  customers:  'Clientes',
  operators:  'Operadores',
  caixa:      'Caixa / PDV',
}

// SVG paths para cada aba
const TAB_ICONS: Record<Tab, string> = {
  products:   'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM4 5h16M9 3h6',
  categories: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  orders:     'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  reports:    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  motoboys:   'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
  fiscal:     'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  billing:    'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  settings:   'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  ifood:      'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9',
  customers:  'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  operators:  'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  caixa:      'M9 7H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
}

const REPORT_SUB_TABS: { id: ReportSubTab; label: string; path: string }[] = [
  { id: 'overview',   label: 'Visão Geral',            path: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
  { id: 'products',   label: 'Mais vendidos',           path: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: 'categories', label: 'Por Categoria',           path: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z' },
  { id: 'inventory',  label: 'Inventário',              path: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
]

function Icon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function AdminTabs({
  tab, onChange,
  reportSubTab, onReportSubTabChange,
  billingSubTab, onBillingSubTabChange,
}: AdminTabsProps) {
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const [cadastroOpen, setCadastroOpen] = useState(() => CADASTRO_TABS.includes(tab))
  const [reportsOpen,  setReportsOpen]  = useState(() => tab === 'reports')
  const [billingOpen,  setBillingOpen]  = useState(() => tab === 'billing')

  const handleChange = (t: Tab) => { onChange(t); setMobileOpen(false) }

  const handleReportsClick = () => {
    if (tab !== 'reports') { onChange('reports'); setReportsOpen(true) }
    else setReportsOpen(o => !o)
  }

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Dot-grid overlay ── */}
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z' fill='%23fff' fill-opacity='0.03'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Círculos decorativos ── */}
      <div className="absolute w-48 h-48 rounded-full bg-white/4 -bottom-10 -right-16 pointer-events-none z-0" aria-hidden="true" />
      <div className="absolute w-24 h-24 rounded-full bg-white/5 top-20 -right-8 pointer-events-none z-0" aria-hidden="true" />

      {/* ── Conteúdo ── */}
      <div className="relative z-10 flex flex-col h-full py-6 px-3 overflow-hidden">

        {/* Logo */}
        <div className="px-3 mb-7">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-[9px] bg-white/13 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="7" fill="white" fillOpacity="0.15" />
                <path d="M7 21L14 7l7 14H7z" fill="white" fillOpacity="0.9" />
                <circle cx="14" cy="12" r="2.5" fill="white" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-[15px] tracking-tight leading-none mb-0.5">webState</p>
              <p className="text-white/40 text-[10px]">Painel administrativo</p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/8 mb-4" />

        {/* Nav */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 pr-0.5
          scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

          {/* Cadastros (grupo colapsável) */}
          <div>
            <button
              onClick={() => setCadastroOpen(o => !o)}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150
                ${CADASTRO_TABS.includes(tab)
                  ? 'bg-white/12 text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.07]'}`}
            >
              <div className="flex items-center gap-2.5">
                <Icon path="M4 6h16M4 10h16M4 14h16M4 18h7" />
                Cadastros
              </div>
              <ChevronIcon open={cadastroOpen} />
            </button>

            {cadastroOpen && (
              <div className="mt-1 ml-3 flex flex-col gap-0.5 border-l border-white/8 pl-3">
                {CADASTRO_TABS.map(t => (
                  <button key={t} onClick={() => handleChange(t)}
                    className={`flex items-center gap-2.5 text-[13px] px-3 py-2 rounded-xl transition-all duration-150 font-medium w-full text-left
                      ${tab === t
                        ? 'bg-[#1a4a8a] text-white shadow-sm'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/[0.07]'}`}>
                    <Icon path={TAB_ICONS[t]} />
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pedidos */}
          <button onClick={() => handleChange('orders')}
            className={`flex items-center gap-2.5 text-[13px] px-3 py-2.5 rounded-xl transition-all duration-150 font-semibold w-full text-left
              ${tab === 'orders'
                ? 'bg-[#1a4a8a] text-white shadow-sm'
                : 'text-white/50 hover:text-white/80 hover:bg-white/[0.07]'}`}>
            <Icon path={TAB_ICONS.orders} />
            {TAB_LABELS.orders}
          </button>

          {/* Caixa / PDV — destaque laranja */}
          <button onClick={() => handleChange('caixa')}
            className={`flex items-center gap-2.5 text-[13px] px-3 py-2.5 rounded-xl transition-all duration-150 font-semibold w-full text-left
              ${tab === 'caixa'
                ? 'bg-linear-to-r from-orange-500 to-orange-400 text-white shadow-md shadow-orange-500/25'
                : 'text-white/50 hover:text-white/80 hover:bg-white/[0.07]'}`}>
            <Icon path={TAB_ICONS.caixa} />
            {TAB_LABELS.caixa}
          </button>

          {/* Relatórios */}
          <div>
            <button onClick={handleReportsClick}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150
                ${tab === 'reports'
                  ? 'bg-white/12 text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.07]'}`}>
              <div className="flex items-center gap-2.5">
                <Icon path={TAB_ICONS.reports} />
                Relatórios
              </div>
              <ChevronIcon open={reportsOpen} />
            </button>
            {reportsOpen && tab === 'reports' && (
              <div className="mt-1 ml-3 flex flex-col gap-0.5 border-l border-white/8 pl-3">
                {REPORT_SUB_TABS.map(s => (
                  <button key={s.id} onClick={() => { onReportSubTabChange(s.id); setMobileOpen(false) }}
                    className={`flex items-center gap-2.5 text-[13px] px-3 py-2 rounded-xl transition-all duration-150 font-medium w-full text-left
                      ${reportSubTab === s.id
                        ? 'bg-[#1a4a8a] text-white shadow-sm'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/[0.07]'}`}>
                    <Icon path={s.path} />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-white/8 my-2" />

          {/* iFood */}
          <button onClick={() => handleChange('ifood')}
            className={`flex items-center gap-2.5 text-[13px] px-3 py-2.5 rounded-xl transition-all duration-150 font-semibold w-full text-left
              ${tab === 'ifood'
                ? 'bg-[#1a4a8a] text-white shadow-sm'
                : 'text-white/50 hover:text-white/80 hover:bg-white/[0.07]'}`}>
            <Icon path={TAB_ICONS.ifood} />
            {TAB_LABELS.ifood}
          </button>

          <div className="border-t border-white/8 my-2" />

          {/* Faturamento */}
          <div>
            <button onClick={() => { onChange('billing'); setBillingOpen(o => !o) }}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150
                ${tab === 'billing'
                  ? 'bg-white/12 text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.07]'}`}>
              <div className="flex items-center gap-2.5">
                <Icon path={TAB_ICONS.billing} />
                Faturamento
              </div>
              <ChevronIcon open={billingOpen} />
            </button>
            {billingOpen && tab === 'billing' && (
              <div className="mt-1 ml-3 flex flex-col gap-0.5 border-l border-white/8 pl-3">
                {BILLING_SUB_TABS.map(s => (
                  <button key={s.id} onClick={() => { onBillingSubTabChange(s.id); setMobileOpen(false) }}
                    className={`flex items-center gap-2.5 text-[13px] px-3 py-2 rounded-xl transition-all duration-150 font-medium w-full text-left
                      ${billingSubTab === s.id
                        ? 'bg-[#1a4a8a] text-white shadow-sm'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/[0.07]'}`}>
                    <Icon path={TAB_ICONS.billing} />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fiscal + Configurações */}
          {(['fiscal', 'settings'] as Tab[]).map(t => (
            <button key={t} onClick={() => handleChange(t)}
              className={`flex items-center gap-2.5 text-[13px] px-3 py-2.5 rounded-xl transition-all duration-150 font-semibold w-full text-left
                ${tab === t
                  ? 'bg-[#1a4a8a] text-white shadow-sm'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.07]'}`}>
              <Icon path={TAB_ICONS[t]} />
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 pt-4 px-1 mt-3">
          <p className="text-[10px] text-white/20 text-center">© 2026 webState</p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Botão mobile */}
      <button onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 bg-[#0f2d5e] border border-white/10 rounded-xl p-2 shadow-lg"
        aria-label="Abrir menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar mobile */}
      <aside className={`
        fixed top-0 left-0 h-screen w-60 z-50 overflow-hidden
        bg-linear-to-br from-[#0f2d5e] via-[#1a4a8a] to-[#1d5ca8]
        border-r border-white/8 transition-transform duration-300 ease-in-out md:hidden
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0 relative z-10">
          <span className="font-semibold text-white text-sm">Menu</span>
          <button onClick={() => setMobileOpen(false)} className="text-white/50 hover:text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-56 h-screen sticky top-0 shrink-0 overflow-hidden
        bg-linear-to-br from-[#0f2d5e] via-[#1a4a8a] to-[#1d5ca8]
        border-r border-white/8">
        {sidebarContent}
      </aside>
    </>
  )
}