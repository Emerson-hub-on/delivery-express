import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import https from 'https'
import { XMLParser } from 'fast-xml-parser'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Faz a requisição SOAP com mTLS usando o Agent do Node.js */
function soapRequest(
  xmlBody: string,
  pfxBuffer: Buffer,
  senha: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({
      pfx: pfxBuffer,
      passphrase: senha,
      rejectUnauthorized: true,
    })

    const options = {
      hostname: 'www1.nfe.fazenda.gov.br',
      path: '/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction:
          'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInt',
        'Content-Length': Buffer.byteLength(xmlBody),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        resolve(data)
      })
    })

    req.on('error', reject)

    req.write(xmlBody)
    req.end()
  })
}

/** Monta o envelope SOAP para distNSU */
function buildSoapEnvelope({
  tipo,
  valor,
  ultNSU,
  ambiente,
  cUFAutor,
}: {
  tipo: 'cpf' | 'cnpj'
  valor: string
  ultNSU: string
  ambiente: number
  cUFAutor: string
}) {
  const docTag =
    tipo === 'cpf'
      ? `<CPF>${valor}</CPF>`
      : `<CNPJ>${valor}</CNPJ>`

  const nfeDist = `
    <distNSU xmlns="http://www.portalfiscal.inf.br/nfe">
      <tpAmb>${ambiente}</tpAmb>
      <cUFAutor>${cUFAutor}</cUFAutor>
      ${docTag}
      <distNSU>
        <ultNSU>${ultNSU}</ultNSU>
      </distNSU>
    </distNSU>
  `.trim()

  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInt xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDist>${nfeDist}</nfeDist>
    </nfeDistDFeInt>
  </soap12:Body>
</soap12:Envelope>`
}

/** Extrai e descomprime os documentos retornados (base64 + gzip) */
async function extrairNotas(xmlResposta: string) {
  const parser = new XMLParser({ ignoreAttributes: false })

  const parsed = parser.parse(xmlResposta)

  const body =
    parsed?.['soap:Envelope']?.['soap:Body'] ??
    parsed?.['soap12:Envelope']?.['soap12:Body']

  const retorno =
    body?.nfeDistDFeIntResponse?.nfeDistDFeIntResult?.retDistDFeInt

  if (!retorno) return []

  const cStat = Number(retorno?.cStat)

  // 137 = documentos localizados
  // 138 = nenhum documento localizado
  if (![137, 138].includes(cStat)) {
    return []
  }

  const docs = retorno?.loteDistDFeInt?.docZip

  if (!docs) {
    return []
  }

  const lista = Array.isArray(docs) ? docs : [docs]

  const { gunzip } = await import('zlib')
  const { promisify } = await import('util')

  const gunzipAsync = promisify(gunzip)

  const notas = []

  for (const doc of lista) {
    if (!doc) continue

    try {
      const buffer = Buffer.from(doc['#text'] ?? doc, 'base64')

      const xmlNota = (
        await gunzipAsync(buffer)
      ).toString('utf-8')

      const p2 = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      })

      const nfe = p2.parse(xmlNota)

      const infNFe =
        nfe?.nfeProc?.NFe?.infNFe ??
        nfe?.NFe?.infNFe

      if (!infNFe) continue

      notas.push({
        chave:
          infNFe['@_Id']?.replace('NFe', '') ??
          doc['@_NSU'],

        numero:
          infNFe.ide?.nNF?.toString() ?? '',

        serie:
          infNFe.ide?.serie?.toString() ?? '',

        emitente_razao:
          infNFe.emit?.xNome ?? '',

        emitente_cnpj:
          infNFe.emit?.CNPJ ?? '',

        valor_total: parseFloat(
          infNFe.total?.ICMSTot?.vNF ?? '0'
        ),

        data_emissao:
          infNFe.ide?.dhEmi ??
          infNFe.ide?.dEmi ??
          '',

        xml: xmlNota,

        nsu: doc['@_NSU'],
      })
    } catch {
      // Pode ser evento, CT-e etc.
      // Ignora documentos não compatíveis
    }
  }

  return notas
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json()

    if (!companyId) {
      return NextResponse.json(
        { message: 'companyId é obrigatório' },
        { status: 400 }
      )
    }

    // 1. Busca configuração fiscal
    const { data: cfg, error: cfgError } = await supabase
      .from('fiscal_config')
      .select(`
        cnpj,
        cpf,
        cert_pfx_base64,
        cert_senha,
        cert_cpf_pfx_base64,
        cert_cpf_senha,
        ambiente,
        codigo_ibge
      `)
      .eq('company_id', companyId)
      .single()

    if (cfgError || !cfg) {
      return NextResponse.json(
        { message: 'Configuração fiscal não encontrada' },
        { status: 400 }
      )
    }

    // 2. Define modo
    // CPF = homologação/teste
    // CNPJ = produção
    const tipo = cfg.cpf ? 'cpf' : 'cnpj'

    const valor = cfg.cpf
      ? cfg.cpf
      : cfg.cnpj

    if (!valor) {
      return NextResponse.json(
        {
          message:
            tipo === 'cpf'
              ? 'CPF não configurado'
              : 'CNPJ não configurado',
        },
        { status: 400 }
      )
    }

    // 3. Seleciona certificado correto
    // CPF → e-CPF
    // CNPJ → e-CNPJ
    const pfxBase64 = cfg.cpf
      ? cfg.cert_cpf_pfx_base64
      : cfg.cert_pfx_base64

    const pfxSenha = cfg.cpf
      ? cfg.cert_cpf_senha
      : cfg.cert_senha

    if (!pfxBase64) {
      return NextResponse.json(
        {
          message: cfg.cpf
            ? 'e-CPF não configurado — carregue seu certificado pessoal nas configurações fiscais'
            : 'Certificado digital não configurado',
        },
        { status: 400 }
      )
    }

    if (!pfxSenha) {
      return NextResponse.json(
        {
          message: cfg.cpf
            ? 'Senha do e-CPF não configurada'
            : 'Senha do certificado digital não configurada',
        },
        { status: 400 }
      )
    }

    const pfxBuffer = Buffer.from(
      pfxBase64,
      'base64'
    )

    // cUFAutor = 2 primeiros dígitos IBGE
    const cUFAutor =
      cfg.codigo_ibge?.substring(0, 2)

    if (!cUFAutor) {
      return NextResponse.json(
        {
          message:
            'Código IBGE não configurado',
        },
        { status: 400 }
      )
    }

    // 4. Recupera último NSU
    const { data: nsuRow } = await supabase
      .from('nf_entrada_nsu')
      .select('ult_nsu')
      .eq('company_id', companyId)
      .single()

    const ultNSU =
      nsuRow?.ult_nsu ??
      '000000000000000'

    // 5. Monta envelope SOAP
    const envelope = buildSoapEnvelope({
      tipo,
      valor,
      ultNSU,
      ambiente: cfg.ambiente,
      cUFAutor,
    })

    // 6. Envia para SEFAZ
    let xmlResposta: string

    try {
      xmlResposta = await soapRequest(
        envelope,
        pfxBuffer,
        pfxSenha
      )
    } catch (e: any) {
      return NextResponse.json(
        {
          message: `Erro ao conectar na SEFAZ: ${e.message}`,
        },
        { status: 502 }
      )
    }

    // 7. Extrai notas
    const notas = await extrairNotas(
      xmlResposta
    )

    // 8. Salva no banco
    if (notas.length > 0) {
      await supabase
        .from('nf_entrada')
        .upsert(
          notas.map((n) => ({
            company_id: companyId,
            chave: n.chave,
            numero: n.numero,
            serie: n.serie,
            emitente_razao:
              n.emitente_razao,
            emitente_cnpj:
              n.emitente_cnpj,
            valor_total:
              n.valor_total,
            data_emissao:
              n.data_emissao,
            status: 'pendente',
            xml_raw: n.xml,
          })),
          {
            onConflict:
              'company_id,chave',
            ignoreDuplicates: true,
          }
        )

      // Atualiza último NSU
      const maiorNSU =
        notas[notas.length - 1].nsu

      await supabase
        .from('nf_entrada_nsu')
        .upsert(
          {
            company_id: companyId,
            ult_nsu: maiorNSU,
          },
          {
            onConflict: 'company_id',
          }
        )
    }

    return NextResponse.json({
      synced: notas.length,
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        message:
          e?.message ??
          'Erro interno ao sincronizar notas',
      },
      { status: 500 }
    )
  }
}