import { FiscalConfig } from '@/types/fiscal'

export type NfceItem = {
  order:          number
  product_id:     number
  product_name:   string
  variant_label?: string   // ← novo: "AMARELO / M", "VINHO", "GG" …
  ean:            string | null
  quantity:       number
  unit_price:     number
  discount:       number
  ncm:            string
  cfop:           string
  cst:            string
  unit:           string
}

export type NfceConsumer = {
  name: string
  cpf:  string
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

function fmtDate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}-03:00`
}

const tPagMap: Record<string, string> = {
  dinheiro: '01',
  cartao:   '03',
  pix:      '17',
}

const cUFMap: Record<string, string> = {
  AC: '12', AL: '27', AM: '13', AP: '16', BA: '29',
  CE: '23', DF: '53', ES: '32', GO: '52', MA: '21',
  MG: '31', MS: '50', MT: '51', PA: '15', PB: '25',
  PE: '26', PI: '22', PR: '41', RJ: '33', RN: '24',
  RO: '11', RR: '14', RS: '43', SC: '42', SE: '28',
  SP: '35', TO: '17',
}

function calcItem(item: NfceItem) {
  const unitLiq = item.unit_price * (1 - item.discount / 100)
  const vProd   = parseFloat((unitLiq * item.quantity).toFixed(2))
  const vDesc   = parseFloat((item.unit_price * item.quantity - vProd).toFixed(2))
  return { unitLiq, vProd, vDesc }
}

// Escapa caracteres especiais XML
function escXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildNfceXml(p: NfceBuildPayload): string {
  const now   = new Date()
  const dhEmi = fmtDate(now)

  const randomBuffer = new Uint32Array(1)
  crypto.getRandomValues(randomBuffer)
  const cNF = String(randomBuffer[0] % 99999999 + 1).padStart(8, '0')

  const nNF      = String(p.nfceNumero).padStart(9, '0')
  const mod      = '65'
  const tpNF     = '1'
  const indFinal = '1'
  const indPres  = '1'
  const tpAmb    = p.config.ambiente === 1 ? '1' : '2'
  const tpEmis   = p.contingencia ? '9' : '1'

  let vProdTotal = 0
  let vDescTotal = 0

  const itemsXml = p.items.map((item, idx) => {
    const { vProd, vDesc } = calcItem(item)
    vProdTotal += vProd
    vDescTotal += vDesc

    const nItem = String(idx + 1).padStart(3, '0')
    const cEAN  = item.ean ?? 'SEM GTIN'

    // ── xProd: nome do produto + variante (cor/tamanho) ──────────────────
    // Compõe antes de truncar para garantir que o label da variante
    // não seja cortado separado do nome base.
    // Ex: "Camisa Básica Mengotti AMARELO / M"
    const xProdRaw = [item.product_name, item.variant_label]
      .filter(Boolean)
      .join(' ')
    const xProd = escXml(xProdRaw.substring(0, 120))

    return `
    <det nItem="${nItem}">
      <prod>
        <cProd>${String(item.product_id).padStart(6, '0')}</cProd>
        <cEAN>${cEAN}</cEAN>
        <xProd>${xProd}</xProd>
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

  const isMei   = p.config.crt === 4
  const docEmit = isMei && p.config.cpf
    ? p.config.cpf.replace(/\D/g, '').padStart(14, '0')
    : p.config.cnpj
  const cUF  = cUFMap[p.config.uf] ?? '35'
  const yymm = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth()+1).padStart(2,'0')}`
  const chaveBase43 = `${cUF}${yymm}${docEmit}${mod}${p.serie.padStart(3,'0')}${nNF}${tpEmis}${cNF}`

  const consumerXml = p.consumer?.cpf
    ? `<dest>
        ${p.consumer.name ? `<xNome>${escXml(p.consumer.name.substring(0,60))}</xNome>` : ''}
        <CPF>${p.consumer.cpf.replace(/\D/g,'').substring(0,11)}</CPF>
      </dest>`
    : ''

  const tPag     = tPagMap[p.paymentMethod] ?? '01'
  const trocoXml = p.troco > 0 ? `<vTroco>${p.troco.toFixed(2)}</vTroco>` : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
<infNFe versao="4.00" Id="NFe${chaveBase43}0">
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
    ${isMei && p.config.cpf
      ? `<CPF>${p.config.cpf.replace(/\D/g, '')}</CPF>`
      : `<CNPJ>${p.config.cnpj}</CNPJ>`
    }
    <xNome>${escXml(p.config.razao_social.substring(0,60))}</xNome>
    ${p.config.nome_fantasia ? `<xFant>${escXml(p.config.nome_fantasia.substring(0,60))}</xFant>` : ''}
    <enderEmit>
      <xLgr>${escXml(p.config.logradouro)}</xLgr>
      <nro>${p.config.numero}</nro>
      ${p.config.complemento ? `<xCpl>${p.config.complemento}</xCpl>` : ''}
      <xBairro>${escXml(p.config.bairro)}</xBairro>
      <cMun>${p.config.codigo_ibge}</cMun>
      <xMun>${escXml(p.config.municipio)}</xMun>
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