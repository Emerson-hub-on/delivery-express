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

// ── Estilos inline reutilizáveis ─────────────────────────────────────────────
const cellStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: '1.5mm 2mm',
  verticalAlign: 'top',
}
const labelStyle: React.CSSProperties = {
  fontSize: '5.5pt',
  color: '#444',
  display: 'block',
  marginBottom: '1px',
  textTransform: 'uppercase',
  fontWeight: 'normal',
}
const valueStyle: React.CSSProperties = {
  fontSize: '7.5pt',
  fontWeight: 'bold',
  display: 'block',
}
const sectionHeaderStyle: React.CSSProperties = {
  background: '#e8e8e8',
  border: '1px solid #000',
  borderTop: 'none',
  padding: '1mm 2mm',
  fontSize: '6pt',
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
}
const thStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: '1mm',
  fontSize: '5pt',
  textAlign: 'center',
  fontWeight: 'bold',
  background: '#f0f0f0',
  textTransform: 'uppercase',
}

function LabelValue({ label, value, style }: { label: string; value: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ ...cellStyle, ...style }}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value || '—'}</span>
    </td>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function DanfePreview({ form, numero, serie, chave, emitente, onClose }: DanfePreviewProps) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!emitente) return null

  const d = form.destinatario
  const itens = form.itens

  const valorProdutos = itens.reduce((s, i) => s + (i.valor_total || 0), 0)
  const valorTotal    = Math.max(0, valorProdutos - form.valor_desconto + form.valor_frete)

  const chaveExib  = chave ? chaveFormatada(chave) : '2526 0555 9252 0600 0114 5500 1000 0000 4510 0006 8199'
  const numExib    = numero ?? '000.000.000'
  const serieExib  = serie ?? form.serie ?? '001'
  const dataHoje   = new Date().toLocaleDateString('pt-BR')
  const horaAgora  = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // CNPJ formatado
  const cnpjFmt = (v: string) => {
    const n = v.replace(/\D/g, '')
    return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') || v
  }
  const cpfFmt = (v: string) => {
    const n = v.replace(/\D/g, '')
    return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') || v
  }
  const cepFmt = (v: string) => {
    const n = v.replace(/\D/g, '')
    return n.replace(/^(\d{5})(\d{3})$/, '$1-$2') || v
  }

  function handlePrint() {
    const content = printRef.current?.innerHTML ?? ''
    const win = window.open('', '_blank', 'width=900,height=750')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>DANFE - NF-e ${numExib}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,Helvetica,sans-serif;font-size:7pt;color:#000;background:#fff}
      .danfe-wrap{width:210mm;margin:0 auto;padding:3mm}
      table{width:100%;border-collapse:collapse}
      td,th{border:1px solid #000;padding:1.5mm 2mm;vertical-align:top}
      @media print{
        body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .danfe-wrap{width:100%;padding:2mm}
      }
    </style>
  </head>
  <body><div class="danfe-wrap">${content}</div></body>
</html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col items-center overflow-auto py-6 px-2">
      {/* Barra de ações */}
      <div className="flex items-center gap-3 mb-4 sticky top-0 z-10">
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg shadow transition-colors"
        >
          🖨️ Imprimir / Salvar PDF
        </button>
        <button
          onClick={onClose}
          className="bg-white/15 hover:bg-white/25 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          ✕ Fechar
        </button>
      </div>

      {/* Folha A4 */}
      <div
        ref={printRef}
        style={{
          width: '210mm',
          minHeight: '297mm',
          background: '#fff',
          padding: '3mm',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '7pt',
          color: '#000',
          boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
        }}
      >

        {/* ══════════════════════════════════════════════════════════════════
            CANHOTO
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ border: '1px solid #000', marginBottom: '2mm', padding: '1.5mm 2mm' }}>
          <table style={{ borderCollapse: 'collapse', border: 'none' }}>
            <tbody>
              <tr>
                <td style={{ border: 'none', width: '70%', padding: '0 2mm 0 0', verticalAlign: 'top' }}>
                  <div style={{ fontSize: '6pt', marginBottom: '1mm' }}>
                    Recebemos de <strong>{emitente.razao_social}</strong> os produtos e/ou serviços constantes da
                    Nota Fiscal Eletrônica indicada ao lado.
                  </div>
                  <div style={{ fontSize: '6pt' }}>
                    Destinatário: <strong>{d.nome || '—'}</strong>
                    {d.logradouro ? ` - ${d.logradouro}${d.numero ? `, ${d.numero}` : ''} - ${d.bairro} - ${d.municipio} - ${d.uf}` : ''}
                  </div>
                  <div style={{ fontSize: '6pt', marginTop: '1mm' }}>
                    Emissão: <strong>{dataHoje}</strong>
                    &nbsp;&nbsp;&nbsp;Valor Total: <strong>R$ {fmt(valorTotal)}</strong>
                  </div>
                </td>
                <td style={{ border: 'none', width: '30%', padding: '0 0 0 2mm', verticalAlign: 'top', borderLeft: '1px dashed #000' }}>
                  <div style={{ fontSize: '5.5pt', color: '#444', marginBottom: '1mm' }}>DATA DO RECEBIMENTO</div>
                  <div style={{ borderBottom: '1px solid #ccc', marginBottom: '3mm', height: '5mm' }} />
                  <div style={{ fontSize: '5.5pt', color: '#444', marginBottom: '1mm' }}>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
                  <div style={{ borderBottom: '1px solid #ccc', height: '5mm' }} />
                </td>
                <td style={{ border: 'none', width: '18%', padding: '0 0 0 3mm', verticalAlign: 'top', borderLeft: '1px dashed #000', textAlign: 'center' }}>
                  <div style={{ border: '2px solid #000', display: 'inline-block', padding: '1mm 3mm', marginBottom: '1mm' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '12pt', letterSpacing: '1px' }}>NF-e</span>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '8pt' }}>Nº {numExib}</div>
                  <div style={{ fontSize: '7pt' }}>Série {serieExib}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CABEÇALHO PRINCIPAL
        ══════════════════════════════════════════════════════════════════ */}
        <table style={{ borderCollapse: 'collapse', marginBottom: 0 }}>
          <tbody>
            <tr>
              {/* Logo + dados emitente */}
              <td style={{ ...cellStyle, width: '42%', verticalAlign: 'middle' }}>
                <table style={{ border: 'none', borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    <tr>
                      {/* Ícone NF-e estilizado (substitui brasão real) */}
                      <td style={{ border: 'none', width: '22mm', verticalAlign: 'middle', paddingRight: '2mm' }}>
                        <div style={{
                          width: '20mm', height: '20mm', border: '2px solid #000',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '8pt', fontWeight: 'bold', color: '#000',
                          flexDirection: 'column', gap: '1px',
                        }}>
                          <span style={{ fontSize: '14pt', lineHeight: 1 }}>NF</span>
                          <span style={{ fontSize: '6pt', fontWeight: 'normal' }}>eletrônica</span>
                        </div>
                      </td>
                      <td style={{ border: 'none', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '9pt', textTransform: 'uppercase', lineHeight: 1.3 }}>
                          {emitente.razao_social}
                        </div>
                        <div style={{ fontSize: '6pt', marginTop: '1.5mm', lineHeight: 1.5 }}>
                          {emitente.logradouro}, {emitente.numero}
                        </div>
                        <div style={{ fontSize: '6pt', lineHeight: 1.5 }}>
                          {emitente.bairro} — {emitente.municipio} — {emitente.uf}
                        </div>
                        <div style={{ fontSize: '6pt', lineHeight: 1.5 }}>
                          Fone: {emitente.fone || '—'} &nbsp; CEP: {cepFmt(emitente.cep)}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>

              {/* DANFE centro */}
              <td style={{ ...cellStyle, width: '22%', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ fontWeight: 'bold', fontSize: '13pt', letterSpacing: '2px' }}>DANFE</div>
                <div style={{ fontSize: '6pt', marginTop: '1mm', lineHeight: 1.5 }}>
                  Documento Auxiliar da<br />Nota Fiscal Eletrônica
                </div>
                <div style={{ marginTop: '2mm', fontSize: '6.5pt', lineHeight: 1.8 }}>
                  <div>0 - ENTRADA</div>
                  <div style={{ fontWeight: 'bold' }}>1 - SAÍDA &nbsp;&nbsp; {form.finalidade === 1 ? '☑' : '☐'}</div>
                </div>
                <div style={{ marginTop: '2mm', fontWeight: 'bold', fontSize: '9pt' }}>Nº {numExib}</div>
                <div style={{ fontSize: '7pt' }}>Série {serieExib}</div>
                <div style={{ fontSize: '6pt', marginTop: '1mm' }}>Folha 1/1</div>
              </td>

              {/* Chave de acesso + código de barras */}
              <td style={{ ...cellStyle, width: '36%', verticalAlign: 'top' }}>
                <div style={{ fontSize: '5.5pt', color: '#444', textTransform: 'uppercase', marginBottom: '1mm' }}>
                  Chave de Acesso
                </div>
                {/* Simulação de código de barras */}
                <div style={{
                  display: 'flex', height: '10mm', marginBottom: '1.5mm',
                  alignItems: 'stretch', gap: '0.3px',
                }}>
                  {Array.from({ length: 80 }, (_, i) => (
                    <div key={i} style={{
                      flex: 1,
                      background: i % 3 === 0 ? '#fff' : '#000',
                      minWidth: '0.5px',
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: '6pt', fontFamily: 'monospace', letterSpacing: '1px', wordBreak: 'break-all', textAlign: 'center', marginBottom: '2mm' }}>
                  {chaveExib}
                </div>
                <div style={{ fontSize: '5.5pt', color: '#444', marginTop: '1mm', lineHeight: 1.5 }}>
                  Consulta de autenticidade no portal da NF-e<br />
                  www.nfe.fazenda.gov.br/portal ou no site da SEFAZ Autenticadora
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Natureza / Protocolo / IE / CNPJ / Data */}
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <LabelValue label="Natureza da Operação" value={form.natureza_operacao.toUpperCase()} style={{ width: '55%' }} />
              <LabelValue label="Protocolo de Autorização de Uso" value="NFe sem Autorização de Uso da SEFAZ" style={{ width: '45%' }} />
            </tr>
            <tr>
              <LabelValue label="Inscrição Estadual" value={fmtDoc(emitente.ie)} style={{ width: '28%' }} />
              <LabelValue label="Inscrição Estadual do Substituto Tributário" value="—" style={{ width: '27%' }} />
              <LabelValue label="CNPJ" value={cnpjFmt(emitente.cnpj)} style={{ width: '45%' }} />
            </tr>
          </tbody>
        </table>

        {/* ══════════════════════════════════════════════════════════════════
            DESTINATÁRIO / REMETENTE
        ══════════════════════════════════════════════════════════════════ */}
        <div style={sectionHeaderStyle}>Destinatário / Remetente</div>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <LabelValue
                label="Nome / Razão Social"
                value={d.nome}
                style={{ width: '60%' }}
              />
              <LabelValue
                label={d.tipo === 'juridica' ? 'CNPJ / CPF' : 'CNPJ / CPF'}
                value={d.tipo === 'juridica' ? cnpjFmt(d.cnpj) : cpfFmt(d.cpf)}
                style={{ width: '25%' }}
              />
              <LabelValue label="Data da Emissão" value={dataHoje} style={{ width: '15%' }} />
            </tr>
            <tr>
              <LabelValue
                label="Endereço"
                value={`${d.logradouro || ''}${d.numero ? `, ${d.numero}` : ''}`}
                style={{ width: '60%' }}
              />
              <LabelValue label="Bairro / Distrito" value={d.bairro} style={{ width: '25%' }} />
              <LabelValue label="Data da Saída" value={dataHoje} style={{ width: '15%' }} />
            </tr>
            <tr>
              <LabelValue label="Município" value={d.municipio} style={{ width: '40%' }} />
              <td style={{ ...cellStyle, width: '5%' }}>
                <span style={labelStyle}>UF</span>
                <span style={valueStyle}>{d.uf || '—'}</span>
              </td>
              <LabelValue label="Telefone / Fax" value={d.telefone} style={{ width: '20%' }} />
              <LabelValue label="Inscrição Estadual" value={d.ie || 'ISENTO'} style={{ width: '20%' }} />
              <LabelValue label="CEP" value={d.cep ? cepFmt(d.cep) : '—'} style={{ width: '15%' }} />
            </tr>
          </tbody>
        </table>

        {/* ══════════════════════════════════════════════════════════════════
            CÁLCULO DO IMPOSTO
        ══════════════════════════════════════════════════════════════════ */}
        <div style={sectionHeaderStyle}>Cálculo do Imposto</div>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              {[
                ['Base de Cálculo do ICMS', '0,00'],
                ['Valor do ICMS', '0,00'],
                ['Base de Cálculo do ICMS Substituição', '0,00'],
                ['Valor do ICMS Substituição', '0,00'],
                ['Valor Total dos Produtos', fmt(valorProdutos)],
                ['Valor do IPI', '0,00'],
              ].map(([label, value]) => (
                <td key={label} style={{ ...cellStyle, textAlign: 'right' }}>
                  <span style={{ ...labelStyle, textAlign: 'left', display: 'block' }}>{label}</span>
                  <span style={valueStyle}>{value}</span>
                </td>
              ))}
            </tr>
            <tr>
              {[
                ['Valor do Frete', fmt(form.valor_frete)],
                ['Valor do Seguro', '0,00'],
                ['Desconto', fmt(form.valor_desconto)],
                ['Outras Despesas Acessórias', '0,00'],
                ['Valor Total da Nota', fmt(valorTotal)],
              ].map(([label, value], idx) => (
                <td key={label} style={{
                  ...cellStyle,
                  textAlign: 'right',
                  ...(idx === 4 ? { fontWeight: 'bold', fontSize: '9pt' } : {}),
                }}>
                  <span style={{ ...labelStyle, textAlign: 'left', display: 'block' }}>{label}</span>
                  <span style={{ ...valueStyle, ...(idx === 4 ? { fontSize: '9pt' } : {}) }}>{value}</span>
                </td>
              ))}
              {/* célula vazia para fechar a linha (tinha 6 colunas em cima) */}
              <td style={{ ...cellStyle }} />
            </tr>
          </tbody>
        </table>

        {/* ══════════════════════════════════════════════════════════════════
            TRANSPORTADOR
        ══════════════════════════════════════════════════════════════════ */}
        <div style={sectionHeaderStyle}>Transportador / Volumes Transportados</div>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <LabelValue label="Nome / Razão Social" value="—" style={{ width: '35%' }} />
              <LabelValue label="Frete por Conta" value="0 - REMETENTE" style={{ width: '18%' }} />
              <LabelValue label="Código ANTT" value="—" style={{ width: '14%' }} />
              <LabelValue label="Placa do Veículo" value="—" style={{ width: '14%' }} />
              <td style={{ ...cellStyle, width: '5%' }}>
                <span style={labelStyle}>UF</span>
                <span style={valueStyle}>—</span>
              </td>
              <LabelValue label="CNPJ / CPF" value="—" style={{ width: '14%' }} />
            </tr>
            <tr>
              <LabelValue label="Endereço" value="—" style={{ width: '45%' }} />
              <LabelValue label="Município" value="—" style={{ width: '30%' }} />
              <td style={{ ...cellStyle, width: '5%' }}>
                <span style={labelStyle}>UF</span>
                <span style={valueStyle}>—</span>
              </td>
              <LabelValue label="Inscrição Estadual" value="—" style={{ width: '20%' }} />
            </tr>
            <tr>
              <LabelValue label="Quantidade" value="—" style={{ width: '12%' }} />
              <LabelValue label="Espécie" value="—" style={{ width: '15%' }} />
              <LabelValue label="Marca" value="—" style={{ width: '15%' }} />
              <LabelValue label="Numeração" value="—" style={{ width: '20%' }} />
              <LabelValue label="Peso Bruto" value="—" style={{ width: '19%' }} />
              <LabelValue label="Peso Líquido" value="—" style={{ width: '19%' }} />
            </tr>
          </tbody>
        </table>

        {/* ══════════════════════════════════════════════════════════════════
            DADOS DOS PRODUTOS / SERVIÇOS
        ══════════════════════════════════════════════════════════════════ */}
        <div style={sectionHeaderStyle}>Dados dos Produtos / Serviços</div>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[
                ['Código\nProduto', '7%'],
                ['Descrição do Produto / Serviço', '23%'],
                ['NCM/SH', '6%'],
                ['CSOSN', '5%'],
                ['CFOP', '5%'],
                ['Unid.', '4%'],
                ['Quantidade', '6%'],
                ['Valor\nUnitário', '7%'],
                ['Valor\nDesconto', '7%'],
                ['Valor\nTotal', '8%'],
                ['Base de\nCálc. ICMS', '7%'],
                ['Valor\nICMS', '5%'],
                ['Valor\nIPI', '5%'],
                ['ICMS', '3%'],
                ['IPI', '3%'],
              ].map(([label, width]) => (
                <th key={String(label)} style={{ ...thStyle, width }}>
                  {String(label).split('\n').map((l, i) => <span key={i} style={{ display: 'block' }}>{l}</span>)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'center' }}>{String(idx + 1).padStart(10, '0')}</td>
                <td style={{ ...cellStyle, fontSize: '6pt' }}>{item.produto_desc || '—'}</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'center' }}>{item.ncm || '—'}</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'center' }}>{item.cst_csosn || '—'}</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'center' }}>{item.cfop || '—'}</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'center' }}>UN</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'right' }}>{item.quantidade}</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'right' }}>{fmt(item.valor_unit)}</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'right' }}>0,00</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'right' }}>{fmt(item.valor_total)}</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'right' }}>0,00</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'right' }}>0,00</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'right' }}>0,00</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'right' }}>0,00</td>
                <td style={{ ...cellStyle, fontSize: '6pt', textAlign: 'right' }}>0,00</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ══════════════════════════════════════════════════════════════════
            CÁLCULO DO ISSQN
        ══════════════════════════════════════════════════════════════════ */}
        <div style={sectionHeaderStyle}>Cálculo do ISSQN</div>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <LabelValue label="Inscrição Municipal" value="—" style={{ width: '25%' }} />
              <LabelValue label="Valor Total dos Serviços" value="0,00" style={{ width: '25%' }} />
              <LabelValue label="Base de Cálculo do ISSQN" value="0,00" style={{ width: '25%' }} />
              <LabelValue label="Valor Total do ISSQN" value="0,00" style={{ width: '25%' }} />
            </tr>
          </tbody>
        </table>

        {/* ══════════════════════════════════════════════════════════════════
            DADOS ADICIONAIS
        ══════════════════════════════════════════════════════════════════ */}
        <div style={sectionHeaderStyle}>Dados Adicionais</div>
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ ...cellStyle, width: '70%', minHeight: '25mm', verticalAlign: 'top' }}>
                <span style={labelStyle}>Informações Complementares</span>
                <div style={{ fontSize: '6.5pt', marginTop: '1mm', lineHeight: 1.6 }}>
                  {form.informacoes_adicionais || '—'}
                </div>
              </td>
              <td style={{ ...cellStyle, width: '30%', minHeight: '25mm', verticalAlign: 'top' }}>
                <span style={labelStyle}>Reservado ao Fisco</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Rodapé */}
        <div style={{ marginTop: '2mm', fontSize: '5.5pt', color: '#888', textAlign: 'center' }}>
          DATA E HORA DA IMPRESSÃO: {new Date().toLocaleString('pt-BR')} — Rascunho sem valor fiscal
        </div>
      </div>
    </div>
  )
}