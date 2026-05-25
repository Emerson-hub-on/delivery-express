'use client'
import { useRef } from 'react'
import type { NfSaidaForm } from './types'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface DanfePreviewProps {
  form: NfSaidaForm
  numero?: string
  serie?: string
  chave?: string
  emitente: {
    razao_social: string
    cnpj: string
    ie: string
    logradouro: string
    numero: string
    bairro: string
    municipio: string
    uf: string
    cep: string
    fone?: string
  }
  onClose: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDoc(v: string) { return v || '—' }

function chaveFormatada(chave: string) {
  return chave.replace(/(\d{4})/g, '$1 ').trim()
}

// ── Componente principal ──────────────────────────────────────────────────────
export function DanfePreview({ form, numero, serie, chave, emitente, onClose }: DanfePreviewProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const d = form.destinatario
  const itens = form.itens

  const valorProdutos = itens.reduce((s, i) => s + (i.valor_total || 0), 0)
  const valorTotal = Math.max(0, valorProdutos - form.valor_desconto + form.valor_frete)

  function handlePrint() {
    const content = printRef.current?.innerHTML ?? ''
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>DANFE - NF-e ${numero ?? 'Rascunho'}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 7pt; color: #000; background: #fff; }
            .danfe { width: 210mm; margin: 0 auto; padding: 4mm; }
            table { width: 100%; border-collapse: collapse; }
            td, th { border: 1px solid #000; padding: 1.5mm 2mm; vertical-align: top; }
            .no-border td, .no-border th { border: none; }
            .label { font-size: 6pt; color: #555; display: block; margin-bottom: 1px; }
            .value { font-size: 7.5pt; font-weight: bold; }
            .title-box { font-size: 6pt; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .section-header { background: #f0f0f0; font-weight: bold; font-size: 6.5pt;
              text-transform: uppercase; padding: 2mm; border: 1px solid #000; }
            .nfe-badge { border: 2px solid #000; text-align: center; padding: 2mm; }
            .chave { font-size: 6pt; letter-spacing: 1px; font-family: monospace; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .danfe { width: 100%; padding: 3mm; }
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const chaveExib = chave ? chaveFormatada(chave) : '0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000'
  const numExib   = numero ?? '000.000.000'
  const serieExib = serie  ?? form.serie ?? '001'
  const dataHoje  = new Date().toLocaleDateString('pt-BR')

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex flex-col items-center overflow-auto py-6">
      {/* Barra de ações */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold
            px-5 py-2 rounded-lg transition-colors shadow"
        >
          🖨️ Imprimir / Salvar PDF
        </button>
        <button
          onClick={onClose}
          className="bg-white/10 hover:bg-white/20 text-white text-sm
            px-4 py-2 rounded-lg transition-colors"
        >
          ✕ Fechar
        </button>
      </div>

      {/* Folha A4 */}
      <div ref={printRef}
        className="danfe bg-white shadow-2xl"
        style={{ width: '210mm', minHeight: '297mm', padding: '4mm', fontFamily: 'Arial, sans-serif', fontSize: '7pt', color: '#000' }}
      >

        {/* ── CABEÇALHO ── */}
        <table style={{ marginBottom: 0 }}>
          <tbody>
            <tr>
              {/* Emitente */}
              <td style={{ width: '45%', border: '1px solid #000', padding: '3mm', verticalAlign: 'middle' }}>
                <div style={{ fontWeight: 'bold', fontSize: '10pt', textTransform: 'uppercase' }}>{emitente.razao_social}</div>
                <div style={{ fontSize: '6.5pt', marginTop: '2px' }}>
                  {emitente.logradouro}, {emitente.numero} — {emitente.bairro}
                </div>
                <div style={{ fontSize: '6.5pt' }}>
                  {emitente.municipio} — {emitente.uf} &nbsp;|&nbsp; CEP: {emitente.cep}
                </div>
                {emitente.fone && (
                  <div style={{ fontSize: '6.5pt' }}>Fone: {emitente.fone}</div>
                )}
              </td>

              {/* DANFE centro */}
              <td style={{ width: '25%', border: '1px solid #000', textAlign: 'center', padding: '3mm', verticalAlign: 'middle' }}>
                <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>DANFE</div>
                <div style={{ fontSize: '6pt', marginTop: '2px' }}>Documento Auxiliar da</div>
                <div style={{ fontSize: '6pt' }}>Nota Fiscal Eletrônica</div>
                <div style={{ marginTop: '4px', fontSize: '6.5pt' }}>
                  <div>0 – ENTRADA</div>
                  <div style={{ fontWeight: 'bold' }}>1 – SAÍDA &nbsp; ☑</div>
                </div>
                <div style={{ marginTop: '6px', fontSize: '8pt', fontWeight: 'bold' }}>
                  Nº {numExib}
                </div>
                <div style={{ fontSize: '7pt' }}>Série {serieExib}</div>
                <div style={{ fontSize: '6pt', marginTop: '2px' }}>Folha 1/1</div>
              </td>

              {/* NF-e badge */}
              <td style={{ width: '30%', border: '1px solid #000', padding: '3mm', verticalAlign: 'top' }}>
                <div style={{ border: '2px solid #000', textAlign: 'center', padding: '2mm', marginBottom: '3mm' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '12pt' }}>NF-e</span>
                </div>
                <div style={{ fontSize: '6pt', marginBottom: '2px' }}>Chave de Acesso</div>
                <div style={{ fontSize: '6pt', fontFamily: 'monospace', letterSpacing: '0.5px', wordBreak: 'break-all' }}>
                  {chaveExib}
                </div>
                <div style={{ fontSize: '5.5pt', marginTop: '4px', color: '#555' }}>
                  Consulta de autenticidade no portal da NF-e:<br />
                  www.nfe.fazenda.gov.br/portal ou no site da SEFAZ Autorizadora
                </div>
              </td>
            </tr>

            {/* Natureza / IE / Data */}
            <tr>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Natureza da Operação</span>
                <span style={{ fontWeight: 'bold', fontSize: '7.5pt' }}>{form.natureza_operacao.toUpperCase()}</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Protocolo de Autorização</span>
                <span style={{ fontWeight: 'bold', fontSize: '7.5pt' }}>—</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Data/Hora da Autorização</span>
                <span style={{ fontWeight: 'bold', fontSize: '7.5pt' }}>—</span>
              </td>
            </tr>

            <tr>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Inscrição Estadual</span>
                <span style={{ fontWeight: 'bold' }}>{fmtDoc(emitente.ie)}</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>CNPJ</span>
                <span style={{ fontWeight: 'bold' }}>{fmtDoc(emitente.cnpj)}</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Data de Emissão</span>
                <span style={{ fontWeight: 'bold' }}>{dataHoje}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── DESTINATÁRIO ── */}
        <div style={{ border: '1px solid #000', borderTop: 'none', padding: '1.5mm 2mm', background: '#f0f0f0', fontWeight: 'bold', fontSize: '6.5pt', textTransform: 'uppercase' }}>
          Destinatário / Remetente
        </div>
        <table>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', width: '60%', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Nome / Razão Social</span>
                <span style={{ fontWeight: 'bold' }}>{d.nome || '—'}</span>
              </td>
              <td style={{ border: '1px solid #000', width: '25%', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>{d.tipo === 'juridica' ? 'CNPJ' : 'CPF'}</span>
                <span style={{ fontWeight: 'bold' }}>{fmtDoc(d.tipo === 'juridica' ? d.cnpj : d.cpf)}</span>
              </td>
              <td style={{ border: '1px solid #000', width: '15%', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Data Saída/Entrada</span>
                <span style={{ fontWeight: 'bold' }}>{dataHoje}</span>
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Endereço</span>
                <span style={{ fontWeight: 'bold' }}>{d.logradouro} {d.numero ? `, ${d.numero}` : ''}</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Bairro / Distrito</span>
                <span style={{ fontWeight: 'bold' }}>{d.bairro || '—'}</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Hora Saída</span>
                <span style={{ fontWeight: 'bold' }}>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Município</span>
                <span style={{ fontWeight: 'bold' }}>{d.municipio || '—'}</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>UF</span>
                <span style={{ fontWeight: 'bold' }}>{d.uf || '—'}</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>CEP</span>
                <span style={{ fontWeight: 'bold' }}>{d.cep || '—'}</span>
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>IE Destinatário</span>
                <span style={{ fontWeight: 'bold' }}>{d.ie || 'ISENTO'}</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>E-mail</span>
                <span style={{ fontWeight: 'bold' }}>{d.email || '—'}</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Telefone</span>
                <span style={{ fontWeight: 'bold' }}>{d.telefone || '—'}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── CÁLCULO DO IMPOSTO ── */}
        <div style={{ border: '1px solid #000', borderTop: 'none', padding: '1.5mm 2mm', background: '#f0f0f0', fontWeight: 'bold', fontSize: '6.5pt', textTransform: 'uppercase' }}>
          Cálculo do Imposto
        </div>
        <table>
          <tbody>
            <tr>
              {[
                ['Base Cálculo ICMS', '0,00'],
                ['Valor ICMS', '0,00'],
                ['Base Cálc. ICMS ST', '0,00'],
                ['Valor ICMS ST', '0,00'],
                ['Valor IPI', '0,00'],
                ['Valor Total Produtos', fmt(valorProdutos)],
                ['Valor Frete', fmt(form.valor_frete)],
                ['Valor Seguro', '0,00'],
                ['Desconto', fmt(form.valor_desconto)],
                ['Outras Despesas', '0,00'],
                ['Valor Total IPI', '0,00'],
                ['Valor Total NF', fmt(valorTotal)],
              ].map(([label, value]) => (
                <td key={label} style={{ border: '1px solid #000', padding: '2mm', textAlign: 'right' }}>
                  <span style={{ fontSize: '5.5pt', color: '#555', display: 'block', textAlign: 'left' }}>{label}</span>
                  <span style={{ fontWeight: 'bold', fontSize: '8pt' }}>{value}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {/* ── TRANSPORTADOR ── */}
        <div style={{ border: '1px solid #000', borderTop: 'none', padding: '1.5mm 2mm', background: '#f0f0f0', fontWeight: 'bold', fontSize: '6.5pt', textTransform: 'uppercase' }}>
          Transportador / Volumes Transportados
        </div>
        <table>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', padding: '2mm', width: '40%' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Razão Social</span>
                <span style={{ fontWeight: 'bold' }}>—</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm', width: '15%' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Frete por Conta</span>
                <span style={{ fontWeight: 'bold' }}>0 – REMETENTE</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm', width: '15%' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Código ANTT</span>
                <span style={{ fontWeight: 'bold' }}>—</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm', width: '15%' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Placa Veículo</span>
                <span style={{ fontWeight: 'bold' }}>—</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm', width: '15%' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>CNPJ / CPF</span>
                <span style={{ fontWeight: 'bold' }}>—</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── PRODUTOS / SERVIÇOS ── */}
        <div style={{ border: '1px solid #000', borderTop: 'none', padding: '1.5mm 2mm', background: '#f0f0f0', fontWeight: 'bold', fontSize: '6.5pt', textTransform: 'uppercase' }}>
          Dados dos Produtos / Serviços
        </div>
        <table>
          <thead>
            <tr style={{ background: '#f8f8f8' }}>
              {['Cód.', 'Descrição do Produto / Serviço', 'NCM/SH', 'CST', 'CFOP', 'Un.', 'Qtd.', 'Vl. Unit.', 'Vl. Total', 'B.C. ICMS', 'Al. ICMS', 'Vl. ICMS', 'Vl. IPI', 'Al. PIS', 'Vl. PIS', 'Al. COFINS', 'Vl. COFINS'].map(h => (
                <th key={h} style={{ border: '1px solid #000', padding: '1.5mm', fontSize: '5.5pt', textAlign: 'center', fontWeight: 'bold' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm' }}>{item.produto_desc || '—'}</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'center' }}>{item.ncm || '—'}</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'center' }}>{item.cst_csosn || '—'}</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'center' }}>{item.cfop || '—'}</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'center' }}>UN</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'right' }}>{item.quantidade}</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'right' }}>{fmt(item.valor_unit)}</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'right' }}>{fmt(item.valor_total)}</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'right' }}>0,00</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'right' }}>0,00</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'right' }}>0,00</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'right' }}>0,00</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'right' }}>0,00</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'right' }}>0,00</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'right' }}>0,00</td>
                <td style={{ border: '1px solid #000', padding: '1.5mm', textAlign: 'right' }}>0,00</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── CÁLCULO DO ISSQN ── */}
        <div style={{ border: '1px solid #000', borderTop: 'none', padding: '1.5mm 2mm', background: '#f0f0f0', fontWeight: 'bold', fontSize: '6.5pt', textTransform: 'uppercase' }}>
          Cálculo do ISSQN
        </div>
        <table>
          <tbody>
            <tr>
              {['Inscrição Municipal', 'Valor Total dos Serviços', 'Base de Cálculo ISSQN', 'Valor Total do ISSQN'].map(label => (
                <td key={label} style={{ border: '1px solid #000', padding: '2mm' }}>
                  <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>{label}</span>
                  <span style={{ fontWeight: 'bold' }}>0,00</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {/* ── DADOS ADICIONAIS ── */}
        <div style={{ border: '1px solid #000', borderTop: 'none', padding: '1.5mm 2mm', background: '#f0f0f0', fontWeight: 'bold', fontSize: '6.5pt', textTransform: 'uppercase' }}>
          Dados Adicionais
        </div>
        <table>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', padding: '2mm', width: '70%', minHeight: '20mm', verticalAlign: 'top' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Informações Complementares</span>
                <span style={{ fontSize: '7pt' }}>{form.informacoes_adicionais || '—'}</span>
              </td>
              <td style={{ border: '1px solid #000', padding: '2mm', width: '30%', verticalAlign: 'top' }}>
                <span style={{ fontSize: '5.5pt', color: '#555', display: 'block' }}>Reservado ao Fisco</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Rodapé */}
        <div style={{ marginTop: '3mm', fontSize: '5.5pt', color: '#888', textAlign: 'center' }}>
          DANFE gerado em {new Date().toLocaleString('pt-BR')} — Rascunho sem valor fiscal
        </div>
      </div>
    </div>
  )
}
