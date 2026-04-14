'use client'
import { useEffect, useState, useCallback } from 'react'
import { Order } from '@/types/product'
import { FiscalConfig } from '@/types/fiscal'
import {
  getFiscalConfig,
  getOrdersSemNfce,
  getOrdersComNfce,
  marcarPendente,
  cancelarNfce,
  nextNfceNumero,
  updateOrderNfce,
} from '@/services/fiscal'
import { FiscalConfigForm } from './FiscalConfigForm'
import { FiscalOrderCard } from './FiscalOrderCard'
import { FiscalEmitidoCard } from './FiscalEmitidoCard'
import { FiscalXmlTab } from './FiscalXmlTab'

function todayLocalISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type SubTab = 'pendentes' | 'emitidos' | 'xml' | 'config'

interface FiscalTabProps {
  onError: (msg: string | null) => void
}

const SUB_TAB_LABELS: Record<SubTab, string> = {
  pendentes: 'Emitir NFC-e',
  emitidos:  'Emitidos',
  xml:       'Gerar XML',
  config:    'Configuração',
}

export function FiscalTab({ onError }: FiscalTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('pendentes')
  const [config, setConfig] = useState<FiscalConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [showConfigForm, setShowConfigForm] = useState(false)

  const [pendentes, setPendentes] = useState<Order[]>([])
  const [emitidos, setEmitidos] = useState<Order[]>([])
  const [loadingPendentes, setLoadingPendentes] = useState(false)
  const [loadingEmitidos, setLoadingEmitidos] = useState(false)
  const [search, setSearch] = useState('')

  const [dateFrom, setDateFrom] = useState(todayLocalISO)
  const [dateTo, setDateTo] = useState(todayLocalISO)
  const [openDropdown, setOpenDropdown] = useState(false)

  const [emittingId, setEmittingId] = useState<number | null>(null)
  const [cancelingId, setCancelingId] = useState<number | null>(null)

  // ── Carrega config do emitente ────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingConfig(true)
        const cfg = await getFiscalConfig()
        setConfig(cfg)
        if (!cfg) setShowConfigForm(true)
      } catch (e: any) {
        onError(e.message)
      } finally {
        setLoadingConfig(false)
      }
    }
    load()
  }, [])

  // ── Fetch pendentes ───────────────────────────────────
  const fetchPendentes = useCallback(async () => {
    try {
      setLoadingPendentes(true)
      setPendentes(await getOrdersSemNfce(dateFrom, dateTo))
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoadingPendentes(false)
    }
  }, [dateFrom, dateTo])

  // ── Fetch emitidos ────────────────────────────────────
  const fetchEmitidos = useCallback(async () => {
    try {
      setLoadingEmitidos(true)
      setEmitidos(await getOrdersComNfce(dateFrom, dateTo))
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoadingEmitidos(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (subTab === 'pendentes') fetchPendentes()
    if (subTab === 'emitidos')  fetchEmitidos()
  }, [subTab, fetchPendentes, fetchEmitidos])

  useEffect(() => {
    setSearch('')
  }, [subTab])

  // ── Emitir NFC-e ──────────────────────────────────────
  const handleEmitir = async (order: Order, cpfCnpj?: string) => {
    if (!config) return onError('Configure os dados do emitente antes de emitir.')
    if (!config.csc_token || !config.csc_id) return onError('CSC Token não configurado. Acesse a aba Configuração.')

    try {
      setEmittingId(order.id)
      onError(null)

      const numero = await nextNfceNumero()

      // ── Substitua pelo retorno real da sua API fiscal ──
      const resultado = await simularEmissao(order, numero, config)

      const updated = await updateOrderNfce(order.id, {
        nfce_numero:      numero,
        nfce_serie:       config.nfce_serie,
        nfce_status:      resultado.autorizado ? 'emitido' : 'rejeitado',
        nfce_chave:       resultado.chave,
        nfce_danfe_url:   resultado.danfeUrl,
        nfce_motivo:      resultado.motivo,
        nfce_xml:         resultado.xml,
        nfce_emitido_at:  resultado.autorizado ? new Date().toISOString() : undefined,
        cpf_cnpj_consumidor: cpfCnpj || undefined,
      })

      if (resultado.autorizado) {
        setPendentes(prev => prev.filter(o => o.id !== order.id))
        setEmitidos(prev => [updated, ...prev])
      } else {
        setPendentes(prev => prev.map(o => o.id === updated.id ? updated : o))
        onError(`NFC-e rejeitada pela SEFAZ: ${resultado.motivo}`)
      }
    } catch (e: any) {
      onError('Erro ao emitir NFC-e: ' + e.message)
    } finally {
      setEmittingId(null)
    }
  }

  // ── Cancelar NFC-e ────────────────────────────────────
  const handleCancelar = async (order: Order) => {
    const motivo = window.prompt('Informe o motivo do cancelamento (mínimo 15 caracteres):')
    if (!motivo || motivo.trim().length < 15) {
      return onError('Motivo de cancelamento deve ter pelo menos 15 caracteres.')
    }
    try {
      setCancelingId(order.id)
      onError(null)
      const updated = await cancelarNfce(order.id, motivo)
      setEmitidos(prev => prev.map(o => o.id === updated.id ? updated : o))
    } catch (e: any) {
      onError('Erro ao cancelar NFC-e: ' + e.message)
    } finally {
      setCancelingId(null)
    }
  }

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black'

  if (loadingConfig) {
    return <div className="text-center py-16 text-gray-400 text-sm">Carregando configuração fiscal...</div>
  }

  return (
    <div>

      {/* ── Banner: homologação ───────────────────────────── */}
      {config && config.ambiente === 2 && (
        <div className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <span className="text-amber-500 text-lg">⚠</span>
          <div>
            <p className="text-sm font-medium text-amber-800">Ambiente de Homologação (Testes)</p>
            <p className="text-xs text-amber-600 mt-0.5">
              As notas emitidas agora <strong>não têm validade fiscal</strong>. Altere para Produção na aba Configuração quando estiver pronto.
            </p>
          </div>
          <button
            onClick={() => setSubTab('config')}
            className="ml-auto text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors shrink-0"
          >
            Ir para Configuração
          </button>
        </div>
      )}

      {/* ── Banner: sem config ────────────────────────────── */}
      {!config && !showConfigForm && (
        <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3">
          <span className="text-red-400 text-lg">!</span>
          <div>
            <p className="text-sm font-medium text-red-800">Dados do emitente não configurados</p>
            <p className="text-xs text-red-600 mt-0.5">Configure o CNPJ, endereço e certificado digital para emitir NFC-e.</p>
          </div>
          <button
            onClick={() => { setShowConfigForm(true); setSubTab('config') }}
            className="ml-auto text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors shrink-0"
          >
            Configurar agora
          </button>
        </div>
      )}

      {/* ── Sub-abas ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        
        {/* Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(prev => !prev)}
            className="flex items-center justify-between w-64 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
          >
            <span>
              {subTab === 'pendentes' && pendentes.length > 0
                ? `${SUB_TAB_LABELS[subTab]} (${pendentes.length})`
                : SUB_TAB_LABELS[subTab]
              }
            </span>
            <span className="ml-2">▾</span>
          </button>

          {openDropdown && (
            <div className="absolute mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {(Object.keys(SUB_TAB_LABELS) as SubTab[]).map(st => (
                <button
                  key={st}
                  onClick={() => {
                    setSubTab(st)
                    setOpenDropdown(false)
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors
                    ${subTab === st ? 'bg-gray-100 font-medium' : 'text-gray-700'}
                  `}
                >
                  {st === 'pendentes' && pendentes.length > 0
                    ? `${SUB_TAB_LABELS[st]} (${pendentes.length})`
                    : SUB_TAB_LABELS[st]
                  }
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input de busca */}
        {subTab !== 'config' && (
          <input
            type="text"
            placeholder="Buscar nº do cupom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-black"
          />
          
        )}       
      </div>

      {/* ── Filtro de data (exceto config) ───────────────── */}
      {subTab !== 'config' && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">De</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Até</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          </div>
          {subTab !== 'xml' && (
            <>
              <button
                onClick={() => subTab === 'pendentes' ? fetchPendentes() : fetchEmitidos()}
                className="text-sm bg-black text-white px-4 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Filtrar
              </button>
              <button
                onClick={() => { setDateFrom(todayLocalISO()); setDateTo(todayLocalISO()) }}
                className="text-sm border border-gray-200 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hoje
              </button>
            </>
          )}
          {subTab === 'xml' && (
            <button
              onClick={() => { setDateFrom(todayLocalISO()); setDateTo(todayLocalISO()) }}
              className="text-sm border border-gray-200 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Hoje
            </button>
          )}
        </div>
      )}

      {/* ── Aba: Emitir NFC-e (pendentes) ────────────────── */}
      {subTab === 'pendentes' && (
        <>
          {loadingPendentes ? (
            <div className="text-center py-16 text-gray-400 text-sm">Carregando pedidos...</div>
          ) : pendentes.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              Nenhum pedido concluído sem NFC-e no período selecionado.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendentes
                .filter(order =>
                  order.code?.toString().includes(search.trim())
                )
                .map(order => (
                <FiscalOrderCard
                  key={order.id}
                  order={order}
                  emitting={emittingId === order.id}
                  configOk={!!config}
                  onEmitir={handleEmitir}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Aba: Emitidos ─────────────────────────────────── */}
      {subTab === 'emitidos' && (
        <>
          {loadingEmitidos ? (
            <div className="text-center py-16 text-gray-400 text-sm">Carregando notas...</div>
          ) : emitidos.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              Nenhuma NFC-e emitida no período selecionado.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {emitidos.map(order => (
                <FiscalEmitidoCard
                  key={order.id}
                  order={order}
                  canceling={cancelingId === order.id}
                  onCancelar={handleCancelar}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Aba: Gerar XML ────────────────────────────────── */}
      {subTab === 'xml' && (
        <FiscalXmlTab
          dateFrom={dateFrom}
          dateTo={dateTo}
          onError={onError}
        />
      )}

      {/* ── Aba: Configuração ─────────────────────────────── */}
      {subTab === 'config' && (
        <FiscalConfigForm
          config={config}
          onSaved={(saved) => {
            setConfig(saved)
            setShowConfigForm(false)
            onError(null)
          }}
          onError={onError}
        />
      )}
    </div>
  )
}

// ── Simulação de emissão ──────────────────────────────────────
async function simularEmissao(
  order: Order,
  numero: number,
  config: FiscalConfig
): Promise<{
  autorizado: boolean
  chave?: string
  danfeUrl?: string
  motivo: string
  xml?: string
}> {
  await new Promise(r => setTimeout(r, 1200))

  const chave = Array.from({ length: 44 }, () => Math.floor(Math.random() * 10)).join('')

  return {
    autorizado: true,
    chave,
    danfeUrl: `https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&nfe=${chave}`,
    motivo: 'Autorizado o uso da NF-e',
    xml: `<?xml version="1.0"?><nfeProc><!-- NFC-e #${numero} / Pedido ${order.code} --></nfeProc>`,
  }
}
