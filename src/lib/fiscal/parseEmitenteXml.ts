/**
 * Extrai os dados do emitente de um XML de NF-e.
 * Funciona tanto no Node (DOMParser via @xmldom/xmldom) quanto no browser.
 */
export function parseEmitenteXml(xmlContent: string) {
  let doc: Document

  if (typeof DOMParser !== 'undefined') {
    doc = new DOMParser().parseFromString(xmlContent, 'application/xml')
  } else {
    // Node.js — instale: npm i @xmldom/xmldom
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DOMParser: NodeDOMParser } = require('@xmldom/xmldom')
    doc = new NodeDOMParser().parseFromString(xmlContent, 'application/xml')
  }

  const get = (tag: string) =>
    doc.getElementsByTagName(tag)[0]?.textContent?.trim() ?? null

  // <CRT> — Código de Regime Tributário
  // 1 = Simples Nacional, 2 = Simples Nacional excesso, 3 = Regime Normal
  const crtMap: Record<string, string> = {
    '1': 'simples',
    '2': 'simples_excesso',
    '3': 'lucro_real',       // pode ser lucro real ou presumido; sem dado extra no XML
  }
  const crt = get('CRT')

  return {
    cnpj:             get('CNPJ')    ?? '',
    razao_social:     get('xNome')   ?? '',
    nome_fantasia:    get('xFant'),
    regime_tributario: crt ? (crtMap[crt] ?? null) : null,
    telefone:         get('fone'),
    email:            get('email'),
    endereco: {
      logradouro: get('xLgr'),
      numero:     get('nro'),
      bairro:     get('xBairro'),
      municipio:  get('xMun'),
      uf:         get('UF'),
      cep:        get('CEP'),
    },
  }
}