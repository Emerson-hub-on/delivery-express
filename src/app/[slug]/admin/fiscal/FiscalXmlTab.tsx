'use client'
import { useState } from 'react'
import { Order } from '@/types/product'
import { getOrdersComNfce } from '@/services/fiscal'

function gerarXmlNfce(order: Order): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">',
    `  <!-- NFC-e #${order.nfce_numero} | Pedido ${order.code} -->`,
    `  <!-- Chave: ${order.nfce_chave} -->`,
    `  <!-- Emitido em: ${order.nfce_emitido_at} -->`,
    `  <!-- Total: R$ ${order.total.toFixed(2)} -->`,
    `  <!-- Cliente: ${order.customer} -->`,
    '  <NFe>',
    '    <!-- XML completo retornado pela SEFAZ -->',
    `    ${order.nfce_xml ?? '<!-- XML não disponível -->'}`,
    '  </NFe>',
    '</nfeProc>',
  ].join('\n')
}

async function baixarZip(orders: Order[]) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  for (const order of orders) {
    const xml = gerarXmlNfce(order)
    const nomeArquivo = `nfce-${order.nfce_chave ?? order.code}-${order.nfce_numero ?? order.id}.xml`
    zip.file(nomeArquivo, xml)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `xmls-nfce-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

interface FiscalXmlTabProps {
  dateFrom: string
  dateTo: string
  onError: (msg: string | null) => void
}

export function FiscalXmlTab({ dateFrom, dateTo, onError }: FiscalXmlTabProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [searched, setSearched] = useState(false)

  const buscar = async () => {
    try {
      setLoading(true)
      setDownloaded(false)
      setSearched(false)
      onError(null)
      const data = await getOrdersComNfce(dateFrom, dateTo)
      setOrders(data.filter(o => o.nfce_status === 'emitido'))
      setSearched(true)
    } catch (e: any) {
      onError('Erro ao buscar notas: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      setDownloading(true)
      await baixarZip(orders)
      setDownloaded(true)
    } catch (e: any) {
      onError('Erro ao gerar ZIP: ' + e.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Info ─────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 text-sm text-blue-700">
        Gera um arquivo <strong>.zip</strong> com um XML por NFC-e autorizada no período selecionado.
        Útil para envio ao contador ou backup fiscal.
      </div>

      {/* ── Botão buscar ─────────────────────────────────── */}
      <div>
        <button
          onClick={buscar}
          disabled={loading}
          className="bg-black text-white text-sm px-5 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {loading
            ? <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                Buscando...
              </span>
            : 'Buscar notas no período'
          }
        </button>
      </div>

      {/* ── Resultado ────────────────────────────────────── */}
      {searched && (
        orders.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            Nenhuma NFC-e autorizada encontrada no período.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

            {/* Sumário + botão download */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {orders.length} nota{orders.length > 1 ? 's' : ''} encontrada{orders.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Total do período: R$ {orders
                    .reduce((s, o) => s + o.total, 0)
                    .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className={`text-sm px-5 py-2 rounded-lg font-medium transition-colors shrink-0
                  ${downloaded
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : downloading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-black text-white hover:bg-gray-800'
                  }`}
              >
                {downloading
                  ? <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                      Gerando ZIP...
                    </span>
                  : downloaded
                    ? '✓ ZIP baixado'
                    : `⬇ Baixar .zip (${orders.length} XML${orders.length > 1 ? 's' : ''})`
                }
              </button>
            </div>

            {/* Lista das notas */}
            <div className="divide-y divide-gray-50">
              {orders.map(order => (
                <div key={order.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">#{order.code}</span>
                      {order.nfce_numero && (
                        <span className="text-xs text-gray-400 font-mono">
                          NFC-e {String(order.nfce_numero).padStart(6, '0')}/{order.nfce_serie ?? '001'}
                        </span>
                      )}
                      <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">
                        Autorizada
                      </span>
                    </div>
                    {order.nfce_chave && (
                      <p className="text-xs text-gray-400 font-mono truncate mt-0.5">
                        {order.nfce_chave}
                      </p>
                    )}
                    {order.nfce_emitido_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(order.nfce_emitido_at).toLocaleString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700 shrink-0">
                    R$ {order.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

          </div>
        )
      )}
    </div>
  )
}
