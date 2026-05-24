import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import https from 'https'
import { XMLParser } from 'fast-xml-parser'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Upsert de fornecedor ───────────────────────────────────────────────────

const CRT_MAP: Record<string, string> = {
  '1': 'simples',
  '2': 'simples_excesso',
  '3': 'lucro_real',
}

async function upsertSupplier(
  companyId: string,
  emit: Record<string, unknown>,
  enderNode: Record<string, unknown> | undefined
) {
  const cnpj = String(emit['CNPJ'] ?? '').replace(/\D/g, '')
  if (!cnpj) return

  const str = (v: unknown) => (v != null ? String(v).trim() : null)
  const crt = str(emit['CRT'])

  const novosDados = {
    razao_social:      str(emit['xNome']),
    nome_fantasia:     str(emit['xFant']),
    regime_tributario: crt ? (CRT_MAP[crt] ?? null) : null,
    telefone:          str(emit['fone']),
    email:             str(emit['email']),
    endereco: enderNode
      ? {
          logradouro: str(enderNode['xLgr']),
          numero:     str(enderNode['nro']),
          bairro:     str(enderNode['xBairro']),
          municipio:  str(enderNode['xMun']),
          uf:         str(enderNode['UF']),
          cep:        str(enderNode['CEP']),
        }
      : null,
  }

  const { data: existing } = await supabaseAdmin
    .from('suppliers')
    .select('id, razao_social, nome_fantasia, regime_tributario, endereco, telefone, email')
    .eq('company_id', companyId)
    .eq('cnpj', cnpj)
    .maybeSingle()

  if (!existing) {
    await supabaseAdmin
      .from('suppliers')
      .insert({ company_id: companyId, cnpj, ...novosDados })
    return
  }

  // Diff — atualiza apenas campos que mudaram
  const updates: Record<string, unknown> = {}

  if (novosDados.razao_social && novosDados.razao_social !== existing.razao_social)
    updates.razao_social = novosDados.razao_social

  if (novosDados.nome_fantasia && novosDados.nome_fantasia !== existing.nome_fantasia)
    updates.nome_fantasia = novosDados.nome_fantasia

  if (novosDados.regime_tributario && novosDados.regime_tributario !== existing.regime_tributario)
    updates.regime_tributario = novosDados.regime_tributario

  if (novosDados.telefone && novosDados.telefone !== existing.telefone)
    updates.telefone = novosDados.telefone

  if (novosDados.email && novosDados.email !== existing.email)
    updates.email = novosDados.email

  if (
    novosDados.endereco &&
    JSON.stringify(novosDados.endereco) !== JSON.stringify(existing.endereco ?? {})
  )
    updates.endereco = novosDados.endereco

  if (Object.keys(updates).length === 0) return

  updates.updated_at = new Date().toISOString()

  await supabaseAdmin
    .from('suppliers')
    .update(updates)
    .eq('company_id', companyId)
    .eq('cnpj', cnpj)
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => { resolve(data) })
    })

    req.on('error', reject)
    req.write(xmlBody)
    req.end()
  })
}

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
  if (![137, 138].includes(cStat)) return []

  const docs = retorno?.loteDistDFeInt?.docZip
  if (!docs) return []

  const lista = Array.isArray(docs) ? docs : [docs]

  const { gunzip } = await import('zlib')
  const { promisify } = await import('util')
  const gunzipAsync = promisify(gunzip)

  const notas = []

  for (const doc of lista) {
    if (!doc) continue

    try {
      const buffer   = Buffer.from(doc['#text'] ?? doc, 'base64')
      const xmlNota  = (await gunzipAsync(buffer)).toString('utf-8')

      const p2 = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
      const nfe = p2.parse(xmlNota)

      const infNFe =
        nfe?.nfeProc?.NFe?.infNFe ??
        nfe?.NFe?.infNFe

      if (!infNFe) continue

      notas.push({
        chave:          infNFe['@_Id']?.replace('NFe', '') ?? doc['@_NSU'],
        numero:         infNFe.ide?.nNF?.toString() ?? '',
        serie:          infNFe.ide?.serie?.toString() ?? '',
        emitente_razao: infNFe.emit?.xNome ?? '',
        emitente_cnpj:  infNFe.emit?.CNPJ ?? '',
        valor_total:    parseFloat(infNFe.total?.ICMSTot?.vNF ?? '0'),
        data_emissao:   infNFe.ide?.dhEmi ?? infNFe.ide?.dEmi ?? '',
        xml:            xmlNota,
        nsu:            doc['@_NSU'],
        // guarda o nó emit para usar no upsertSupplier
        emit:           infNFe.emit as Record<string, unknown> | undefined,
      })
    } catch {
      // Pode ser evento, CT-e etc. — ignora documentos não compatíveis
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

    // 2. Define modo (CPF = teste, CNPJ = produção)
    const tipo  = cfg.cpf ? 'cpf' : 'cnpj'
    const valor = cfg.cpf ? cfg.cpf : cfg.cnpj

    if (!valor) {
      return NextResponse.json(
        { message: tipo === 'cpf' ? 'CPF não configurado' : 'CNPJ não configurado' },
        { status: 400 }
      )
    }

    // 3. Seleciona certificado
    const pfxBase64 = cfg.cpf ? cfg.cert_cpf_pfx_base64 : cfg.cert_pfx_base64
    const pfxSenha  = cfg.cpf ? cfg.cert_cpf_senha       : cfg.cert_senha

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

    const pfxBuffer = Buffer.from(pfxBase64, 'base64')

    // 4. cUFAutor = 2 primeiros dígitos IBGE
    const cUFAutor = cfg.codigo_ibge?.substring(0, 2)
    if (!cUFAutor) {
      return NextResponse.json(
        { message: 'Código IBGE não configurado' },
        { status: 400 }
      )
    }

    // 5. Recupera último NSU
    const { data: nsuRow } = await supabase
      .from('nf_entrada_nsu')
      .select('ult_nsu')
      .eq('company_id', companyId)
      .single()

    const ultNSU = nsuRow?.ult_nsu ?? '000000000000000'

    // 6. Monta envelope SOAP
    const envelope = buildSoapEnvelope({ tipo, valor, ultNSU, ambiente: cfg.ambiente, cUFAutor })

    // 7. Envia para SEFAZ
    let xmlResposta: string
    try {
      xmlResposta = await soapRequest(envelope, pfxBuffer, pfxSenha)
    } catch (e: any) {
      return NextResponse.json(
        { message: `Erro ao conectar na SEFAZ: ${e.message}` },
        { status: 502 }
      )
    }

    // 8. Extrai notas
    const notas = await extrairNotas(xmlResposta)

    // 9. Salva no banco + upsert de fornecedores
    if (notas.length > 0) {
      await supabase
        .from('nf_entrada')
        .upsert(
          notas.map((n) => ({
            company_id:     companyId,
            chave:          n.chave,
            numero:         n.numero,
            serie:          n.serie,
            emitente_razao: n.emitente_razao,
            emitente_cnpj:  n.emitente_cnpj,
            valor_total:    n.valor_total,
            data_emissao:   n.data_emissao,
            status:         'pendente',
            xml_raw:        n.xml,
          })),
          { onConflict: 'company_id,chave', ignoreDuplicates: true }
        )

      // ── Upsert fornecedores ──────────────────────────────────
      // Silencioso: falha individual não bloqueia o sync
      await Promise.allSettled(
        notas.map(async (n) => {
          if (!n.emit) return
          const enderEmit = n.emit['enderEmit'] as Record<string, unknown> | undefined
          await upsertSupplier(companyId, n.emit, enderEmit)
        })
      )

      // Atualiza último NSU
      const maiorNSU = notas[notas.length - 1].nsu
      await supabase
        .from('nf_entrada_nsu')
        .upsert(
          { company_id: companyId, ult_nsu: maiorNSU },
          { onConflict: 'company_id' }
        )
    }

    return NextResponse.json({ synced: notas.length })

  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? 'Erro interno ao sincronizar notas' },
      { status: 500 }
    )
  }
}