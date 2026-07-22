// lib/fiscal/nfce-builder.ts
import type { FiscalConfig } from '@/types/fiscal'

export interface ItemNfce {
  descricao:      string
  ncm:            string
  cfop:           string
  cst_csosn:      string
  ean?:           string | null
  cest?:          string | null
  quantidade:     number
  valor_unitario: number
  valor_total:    number
  ind_escala?:    string
}

export interface DestinatarioNfce {
  cpf?:  string | null
  cnpj?: string | null
  nome?: string | null
}

export interface BuildNfceParams {
  config:        FiscalConfig
  itens:         ItemNfce[]
  valorTotal:    number
  formaPagamento: string
  troco?:        number
  destinatario?: DestinatarioNfce | null
  chaveBase43:   string   // 43 dígitos, sem DV
  numero:        number
  dhEmi:         string   // ISO com offset -03:00
}

function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function fmt2(n: number): string { return n.toFixed(2) }
function fmt4(n: number): string { return n.toFixed(4) }

function mapTpag(forma: string): string {
  const m: Record<string, string> = {
    dinheiro:       '01',
    cartao_credito: '03',
    cartao_debito:  '04',
    pix:            '17',
    boleto:         '15',
    sem_pagamento:  '90',
  }
  return m[forma] ?? '99'
}

function buildIcms(crt: number, cst: string): string {
  // Simples Nacional (CRT 1 ou 4) → CSOSN
  if (crt === 1 || crt === 4) {
    const csosn = cst.replace(/^0+/, '') || '400'
    const csosnValidos = ['102','103','300','400','500','900']
    const csosnFinal = csosnValidos.includes(csosn) ? csosn : '400'
    return `<ICMS><ICMSSN${csosnFinal}><orig>0</orig><CSOSN>${csosnFinal}</CSOSN></ICMSSN${csosnFinal}></ICMS>`
  }
  // Regime Normal (CRT 2 ou 3) → CST
  return `<ICMS><ICMS40><orig>0</orig><CST>40</CST></ICMS40></ICMS>`
}

export function buildNfceXml(p: BuildNfceParams): string {
  const cfg    = p.config
  const tpAmb  = cfg.ambiente === 1 ? '1' : '2'
  const cUF    = cfg.codigo_ibge.substring(0, 2)
  const cMunFG = cfg.codigo_ibge

  // FIX 1: série sem zeros à esquerda — parseInt remove o padding
  const serie  = parseInt(cfg.nfce_serie).toString()

  const cNF    = p.chaveBase43.substring(35, 43)

  // Destinatário
  const cpfDest  = p.destinatario?.cpf?.replace(/\D/g, '')  ?? ''
  const cnpjDest = p.destinatario?.cnpj?.replace(/\D/g, '') ?? ''
  const nomeDest = p.destinatario?.nome ?? ''

  let xmlDest = ''
  if (cpfDest.length === 11) {
    xmlDest = `
  <dest>
    <CPF>${cpfDest}</CPF>
    ${nomeDest ? `<xNome>${esc(nomeDest)}</xNome>` : ''}
    <indIEDest>9</indIEDest>
  </dest>`
  } else if (cnpjDest.length === 14) {
    xmlDest = `
  <dest>
    <CNPJ>${cnpjDest}</CNPJ>
    ${nomeDest ? `<xNome>${esc(nomeDest)}</xNome>` : ''}
    <indIEDest>9</indIEDest>
  </dest>`
  }

  // Itens
  const xmlItens = p.itens.map((item, idx) => {
    const nItem  = String(idx + 1)
    const vProd  = fmt2(item.valor_total)
    const qCom   = fmt4(item.quantidade)
    const vUnCom = fmt4(item.valor_unitario)
    const ncm    = (item.ncm ?? '').replace(/\D/g, '').padStart(8, '0')
    const ean    = item.ean && item.ean !== 'SEM GTIN' ? item.ean : 'SEM GTIN'
    const cest   = item.cest ? item.cest.replace(/\D/g, '').padStart(7, '0') : null
    const indEsc = item.ind_escala ?? 'S'

    return `
  <det nItem="${nItem}">
    <prod>
      <cProd>${nItem.padStart(6, '0')}</cProd>
      <cEAN>${ean}</cEAN>
      <xProd>${esc(item.descricao)}</xProd>
      <NCM>${ncm}</NCM>
      ${cest ? `<CEST>${cest}</CEST>` : ''}
      <indEscala>${indEsc}</indEscala>
      <CFOP>${item.cfop}</CFOP>
      <uCom>UN</uCom>
      <qCom>${qCom}</qCom>
      <vUnCom>${vUnCom}</vUnCom>
      <vProd>${vProd}</vProd>
      <cEANTrib>${ean}</cEANTrib>
      <uTrib>UN</uTrib>
      <qTrib>${qCom}</qTrib>
      <vUnTrib>${vUnCom}</vUnTrib>
      <indTot>1</indTot>
    </prod>
    <imposto>
      ${buildIcms(cfg.crt, item.cst_csosn)}
      <PIS><PISNT><CST>07</CST></PISNT></PIS>
      <COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>
    </imposto>
  </det>`
  }).join('')

  // Totais
  const vNF    = fmt2(p.valorTotal)
  const vProd  = fmt2(p.itens.reduce((s, i) => s + i.valor_total, 0))

  // Pagamento
  const tPag   = mapTpag(p.formaPagamento)
  const vPag   = fmt2(p.valorTotal)
  const vTroco = p.troco && p.troco > 0 ? fmt2(p.troco) : null

  // FIX 2: IE do emitente — inclui quando disponível, omite para Simples (CRT 1/4) sem IE
  const ieEmit = cfg.ie?.replace(/\D/g, '')
  const xmlIeEmit = ieEmit
    ? `<IE>${ieEmit}</IE>`
    : ''  // omite a tag se não houver IE (Simples sem IE cadastrada)

  // Informações adicionais Simples Nacional
  const infAdic = (cfg.crt === 1 || cfg.crt === 4)
    ? `<infAdic><infCpl>DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL - NAO GERA DIREITO A CREDITO FISCAL DE IPI</infCpl></infAdic>`
    : ''

  // URL de consulta por UF
  const urlConsulta = `www.sefaz${cfg.uf.toLowerCase()}.gov.br/nfce/consulta`

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
<infNFe Id="NFe${p.chaveBase43}0" versao="4.00">
  <ide>
    <cUF>${cUF}</cUF>
    <cNF>${cNF}</cNF>
    <natOp>VENDA</natOp>
    <mod>65</mod>
    <serie>${serie}</serie>
    <nNF>${p.numero}</nNF>
    <dhEmi>${p.dhEmi}</dhEmi>
    <tpNF>1</tpNF>
    <idDest>1</idDest>
    <cMunFG>${cMunFG}</cMunFG>
    <tpImp>4</tpImp>
    <tpEmis>1</tpEmis>
    <cDV>0</cDV>
    <tpAmb>${tpAmb}</tpAmb>
    <finNFe>1</finNFe>
    <indFinal>1</indFinal>
    <indPres>1</indPres>
    <procEmi>0</procEmi>
    <verProc>1.0.0</verProc>
  </ide>
  <emit>
    <CNPJ>${cfg.cnpj.replace(/\D/g, '')}</CNPJ>
    <xNome>${esc(cfg.razao_social)}</xNome>
    ${cfg.nome_fantasia ? `<xFant>${esc(cfg.nome_fantasia)}</xFant>` : ''}
    <enderEmit>
      <xLgr>${esc(cfg.logradouro)}</xLgr>
      <nro>${esc(cfg.numero)}</nro>
      ${cfg.complemento ? `<xCpl>${esc(cfg.complemento)}</xCpl>` : ''}
      <xBairro>${esc(cfg.bairro)}</xBairro>
      <cMun>${cfg.codigo_ibge}</cMun>
      <xMun>${esc(cfg.municipio)}</xMun>
      <UF>${cfg.uf.trim()}</UF>
      <CEP>${cfg.cep.replace(/\D/g, '')}</CEP>
      <cPais>1058</cPais>
      <xPais>Brasil</xPais>
      ${cfg.telefone ? `<fone>${cfg.telefone.replace(/\D/g, '')}</fone>` : ''}
    </enderEmit>
    ${xmlIeEmit}
    <CRT>${cfg.crt}</CRT>
  </emit>
  ${xmlDest}
  ${xmlItens}
  <total>
    <ICMSTot>
      <vBC>0.00</vBC>
      <vICMS>0.00</vICMS>
      <vICMSDeson>0.00</vICMSDeson>
      <vFCP>0.00</vFCP>
      <vBCST>0.00</vBCST>
      <vST>0.00</vST>
      <vFCPST>0.00</vFCPST>
      <vFCPSTRet>0.00</vFCPSTRet>
      <vProd>${vProd}</vProd>
      <vFrete>0.00</vFrete>
      <vSeg>0.00</vSeg>
      <vDesc>0.00</vDesc>
      <vII>0.00</vII>
      <vIPI>0.00</vIPI>
      <vIPIDevol>0.00</vIPIDevol>
      <vPIS>0.00</vPIS>
      <vCOFINS>0.00</vCOFINS>
      <vOutro>0.00</vOutro>
      <vNF>${vNF}</vNF>
    </ICMSTot>
  </total>
  <transp>
    <modFrete>9</modFrete>
  </transp>
  <pag>
    <detPag>
      <tPag>${tPag}</tPag>
      <vPag>${vPag}</vPag>
    </detPag>
    ${vTroco ? `<vTroco>${vTroco}</vTroco>` : ''}
  </pag>
  ${infAdic}
</infNFe>
<infNFeSupl>
  <qrCode></qrCode>
  <urlChave>${urlConsulta}</urlChave>
</infNFeSupl>
</NFe>`
}