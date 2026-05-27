import { FiscalConfig } from '@/types/fiscal'

export type NfceItem = {
  order:        number
  product_id:   number
  product_name: string
  ean:          string | null
  quantity:     number
  unit_price:   number
  discount:     number   // percentual
  ncm:          string   // obrigatório SEFAZ — ex: '22021000'
  cfop:         string   // ex: '5102' (venda dentro do estado)
  cst:          string   // ex: '400' (simples nacional isento)
  unit:         string   // ex: 'UN'
}

export type NfceConsumer = {
  name: string
  cpf:  string   // 11 dígitos
}

export type NfceBuildPayload = {
  config:        FiscalConfig
  nfceNumero:    number
  serie:         string
  items:         NfceItem[]
  paymentMethod: 'dinheiro' | 'pix' | 'cartao'
  total:         number
  troco:         number
  consumer:      NfceConsumer | null
  contingencia:  boolean
}

// Formata data para padrão SEFAZ: AAAA-MM-DDTHH:MM:SS-03:00
function fmtDate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}-03:00`
}

// Forma de pagamento → código SEFAZ
const tPagMap: Record<string, string> = {
  dinheiro: '01',
  cartao:   '03',   // cartão de crédito (ajuste para '04' se débito)
  pix:      '17',
}

// Calcula impostos simples (Simples Nacional / CSOSN 400 = sem destaque)
// Para regime normal, implemente ICMS, PIS, COFINS completos
function calcItem(item: NfceItem) {
  const unitLiq  = item.unit_price * (1 - item.discount / 100)
  const vProd    = parseFloat((unitLiq * item.quantity).toFixed(2))
  const vDesc    = parseFloat((item.unit_price * item.quantity - vProd).toFixed(2))
  return { unitLiq, vProd, vDesc }
}

export function buildNfceXml(p: NfceBuildPayload): string {
  const now        = new Date()
  const dhEmi      = fmtDate(now)
  const cNF        = String(p.nfceNumero).padStart(8, '0')
  const nNF        = String(p.nfceNumero).padStart(9, '0')
  const mod        = '65'   // NFC-e
  const tpNF       = '1'    // saída
  const indFinal   = '1'    // consumidor final
  const indPres    = '1'    // presencial
  const tpAmb      = p.config.ambiente === 1 ? '1' : '2'
  const tpEmis     = p.contingencia ? '9' : '1'  // 9=contingência offline

  // Totais
  let vProdTotal = 0
  let vDescTotal = 0
  const itemsXml = p.items.map((item, idx) => {
    const { vProd, vDesc } = calcItem(item)
    vProdTotal += vProd
    vDescTotal += vDesc

    const nItem = String(idx + 1).padStart(3, '0')
    const cEAN  = item.ean ?? 'SEM GTIN'

    return `
    <det nItem="${nItem}">
      <prod>
        <cProd>${String(item.product_id).padStart(6, '0')}</cProd>
        <cEAN>${cEAN}</cEAN>
        <xProd>${item.product_name.substring(0, 120).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</xProd>
        <NCM>${item.ncm}</NCM>
        <CFOP>${item.cfop}</CFOP>
        <uCom>${item.unit}</uCom>
        <qCom>${item.quantity.toFixed(4)}</qCom>
        <vUnCom>${item.unit_price.toFixed(10)}</vUnCom>
        <vProd>${vProd.toFixed(2)}</vProd>
        <cEANTrib>${cEAN}</cEANTrib>
        <uTrib>${item.unit}</uTrib>
        <qTrib>${item.quantity.toFixed(4)}</qTrib>
        <vUnTrib>${item.unit_price.toFixed(10)}</vUnTrib>
        ${vDesc > 0 ? `<vDesc>${vDesc.toFixed(2)}</vDesc>` : ''}
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN400>
            <orig>0</orig>
            <CSOSN>${item.cst}</CSOSN>
          </ICMSSN400>
        </ICMS>
        <PIS>
          <PISNT>
            <CST>07</CST>
          </PISNT>
        </PIS>
        <COFINS>
          <COFINSNT>
            <CST>07</CST>
          </COFINSNT>
        </COFINS>
      </imposto>
    </det>`
  }).join('')

  vProdTotal = parseFloat(vProdTotal.toFixed(2))
  vDescTotal = parseFloat(vDescTotal.toFixed(2))
  const vNF  = parseFloat((vProdTotal - vDescTotal).toFixed(2))

  // Chave de acesso (44 dígitos) — sem dígito verificador aqui,
  // a Edge Function calcula o dígito e assina
  const cUF     = p.config.uf === 'SP' ? '35' :
                  p.config.uf === 'RJ' ? '33' :
                  p.config.uf === 'MG' ? '31' :
                  p.config.uf === 'RS' ? '43' :
                  p.config.uf === 'PR' ? '41' :
                  p.config.uf === 'SC' ? '42' :
                  p.config.uf === 'BA' ? '29' :
                  p.config.uf === 'PE' ? '26' :
                  p.config.uf === 'CE' ? '23' :
                  p.config.uf === 'PB' ? '25' : '35'

  const aamm    = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`
  // chave sem dígito verificador (43 dígitos) — Edge Function completa
  const chaveBase = `${cUF}${aamm}${p.config.cnpj}${mod}${p.serie.padStart(3,'0')}${nNF}${tpEmis}${cNF}`

  const consumerXml = p.consumer?.cpf
    ? `<dest>
        ${p.consumer.name ? `<xNome>${p.consumer.name.substring(0,60).replace(/&/g,'&amp;')}</xNome>` : ''}
        <CPF>${p.consumer.cpf.replace(/\D/g,'').substring(0,11)}</CPF>
      </dest>`
    : ''

  const tPag   = tPagMap[p.paymentMethod] ?? '01'
  const trocoXml = p.troco > 0 ? `<vTroco>${p.troco.toFixed(2)}</vTroco>` : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
<infNFe versao="4.00" Id="NFe${chaveBase}0">
  <ide>
    <cUF>${cUF}</cUF>
    <cNF>${cNF}</cNF>
    <natOp>VENDA</natOp>
    <mod>${mod}</mod>
    <serie>${p.serie}</serie>
    <nNF>${p.nfceNumero}</nNF>
    <dhEmi>${dhEmi}</dhEmi>
    <tpNF>${tpNF}</tpNF>
    <idDest>1</idDest>
    <cMunFG>${p.config.codigo_ibge}</cMunFG>
    <tpImp>4</tpImp>
    <tpEmis>${tpEmis}</tpEmis>
    <cDV>0</cDV>
    <tpAmb>${tpAmb}</tpAmb>
    <finNFe>1</finNFe>
    <indFinal>${indFinal}</indFinal>
    <indPres>${indPres}</indPres>
    <procEmi>0</procEmi>
    <verProc>1.0.0</verProc>
    ${p.contingencia ? `<dhCont>${dhEmi}</dhCont><xJust>Contingencia por falha de comunicacao com a SEFAZ</xJust>` : ''}
  </ide>
  <emit>
    <CNPJ>${p.config.cnpj}</CNPJ>
    <xNome>${p.config.razao_social.substring(0,60).replace(/&/g,'&amp;')}</xNome>
    ${p.config.nome_fantasia ? `<xFant>${p.config.nome_fantasia.substring(0,60).replace(/&/g,'&amp;')}</xFant>` : ''}
    <enderEmit>
      <xLgr>${p.config.logradouro.replace(/&/g,'&amp;')}</xLgr>
      <nro>${p.config.numero}</nro>
      ${p.config.complemento ? `<xCpl>${p.config.complemento}</xCpl>` : ''}
      <xBairro>${p.config.bairro.replace(/&/g,'&amp;')}</xBairro>
      <cMun>${p.config.codigo_ibge}</cMun>
      <xMun>${p.config.municipio.replace(/&/g,'&amp;')}</xMun>
      <UF>${p.config.uf}</UF>
      <CEP>${p.config.cep}</CEP>
      <cPais>1058</cPais>
      <xPais>Brasil</xPais>
      ${p.config.telefone ? `<fone>${p.config.telefone.replace(/\D/g,'')}</fone>` : ''}
    </enderEmit>
    <IE>${p.config.ie ?? 'ISENTO'}</IE>
    <CRT>${p.config.crt}</CRT>
  </emit>
  ${consumerXml}
  ${itemsXml}
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
      <vProd>${vProdTotal.toFixed(2)}</vProd>
      <vFrete>0.00</vFrete>
      <vSeg>0.00</vSeg>
      <vDesc>${vDescTotal.toFixed(2)}</vDesc>
      <vII>0.00</vII>
      <vIPI>0.00</vIPI>
      <vIPIDevol>0.00</vIPIDevol>
      <vPIS>0.00</vPIS>
      <vCOFINS>0.00</vCOFINS>
      <vOutro>0.00</vOutro>
      <vNF>${vNF.toFixed(2)}</vNF>
    </ICMSTot>
  </total>
  <transp>
    <modFrete>9</modFrete>
  </transp>
  <pag>
    <detPag>
      <tPag>${tPag}</tPag>
      <vPag>${vNF.toFixed(2)}</vPag>
      ${trocoXml}
    </detPag>
  </pag>
  <infAdic>
    <infCpl>NFC-e emitida em ambiente de ${tpAmb === '1' ? 'producao' : 'homologacao'}. ${p.contingencia ? 'EMITIDA EM CONTINGENCIA OFFLINE.' : ''}</infCpl>
  </infAdic>
  <infNFeSupl>
    <qrCode></qrCode>
    <urlChave>https://www.sefaz${p.config.uf.toLowerCase()}.gov.br/</urlChave>
  </infNFeSupl>
</infNFe>
</NFe>
</nfeProc>`
}