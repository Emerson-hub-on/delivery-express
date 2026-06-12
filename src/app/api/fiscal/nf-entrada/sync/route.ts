import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { XMLParser } from 'fast-xml-parser'
import { upsertSupplier, resolverContribuinte } from '@/lib/fiscal/upsertSupplier'

// FIX: usa supabaseAdmin (service role) em TODAS as queries.
// O client anon não passa pelo RLS sem o JWT do usuário,
// causando "Configuração fiscal não encontrada" mesmo com companyId correto.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    const bodyBuffer = Buffer.from(xmlBody, 'utf-8')

    const options = {
      hostname: 'www1.nfe.fazenda.gov.br',
      path: '/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
        'Content-Length': bodyBuffer.length,
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => { resolve(data) })
    })

    req.on('error', reject)
    req.write(bodyBuffer)
    req.end()
  })
}

function buildSoapEnvelope({ tipo, valor, ultNSU, ambiente, cUFAutor }: {
  tipo: 'cpf' | 'cnpj'
  valor: string
  ultNSU: string
  ambiente: number
  cUFAutor: string
}) {
  const docTag = tipo === 'cpf' ? `<CPF>${valor}</CPF>` : `<CNPJ>${valor}</CNPJ>`

  // distDFeInt: XML interno que vai dentro de nfeDadosMsg
  const distDFeInt = `<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${ambiente}</tpAmb><cUFAutor>${cUFAutor}</cUFAutor>${docTag}<distNSU><ultNSU>${ultNSU}</ultNSU></distNSU></distDFeInt>`

  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfed="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><soap:Header/><soap:Body><nfed:nfeDistDFeInteresse><nfed:nfeDadosMsg>${distDFeInt}</nfed:nfeDadosMsg></nfed:nfeDistDFeInteresse></soap:Body></soap:Envelope>`
}

async function extrairNotas(xmlResposta: string) {
  const parser = new XMLParser({ ignoreAttributes: false })
  const parsed = parser.parse(xmlResposta)

  const body =
    parsed?.['soap:Envelope']?.['soap:Body'] ??
    parsed?.['soap12:Envelope']?.['soap12:Body']

  // Método correto é nfeDistDFeInteresse, não nfeDistDFeInt
  const retorno =
    body?.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult?.retDistDFeInt ??
    body?.nfeDistDFeIntResponse?.nfeDistDFeIntResult?.retDistDFeInt // fallback legado

  console.log('cStat:', retorno?.cStat)
  console.log('xMotivo:', retorno?.xMotivo)

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
      const buffer  = Buffer.from(doc['#text'] ?? doc, 'base64')
      const xmlNota = (await gunzipAsync(buffer)).toString('utf-8')

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

    // 1. Busca configuração fiscal — usa supabaseAdmin para bypassar RLS
    const { data: cfg, error: cfgError } = await supabaseAdmin
      .from('fiscal_configs')
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

    // ── Sanitiza e valida o base64 do PFX ────────────────────────────────────
    // Remove whitespace e o prefixo data:...;base64, se o upload salvou errado
    let pfxBase64Clean = pfxBase64.replace(/\s+/g, '')
    if (pfxBase64Clean.includes(',')) {
      // Salvo com prefixo data:application/...;base64,MIACA...
      pfxBase64Clean = pfxBase64Clean.split(',')[1] ?? pfxBase64Clean
    }
    // Remove qualquer caractere não-base64
    pfxBase64Clean = pfxBase64Clean.replace(/[^A-Za-z0-9+/=]/g, '')
    const pfxBuffer = Buffer.from(pfxBase64Clean, 'base64')

    // Valida magic byte do PKCS#12 (deve começar com 0x30)
    if (pfxBuffer.length < 4 || pfxBuffer[0] !== 0x30) {
      return NextResponse.json(
        { message: `PFX inválido: magic byte incorreto (0x${pfxBuffer[0]?.toString(16)}). O base64 pode estar corrompido ao salvar.` },
        { status: 400 }
      )
    }

    // Testa se o Node consegue criar um contexto TLS com o PFX+senha
    // Se a senha estiver errada, lança ERR_OSSL_BAD_DECRYPT ou similar
    try {
      const { createSecureContext } = await import('tls')
      createSecureContext({
        pfx:        pfxBuffer,
        passphrase: pfxSenha,
      })
    } catch (cryptoErr: any) {
      const msg = (cryptoErr?.message ?? String(cryptoErr)).toLowerCase()
      const hint = msg.includes('bad decrypt') || msg.includes('wrong password') || msg.includes('mac')
        ? 'Senha incorreta para este certificado.'
        : msg.includes('unsupported') || msg.includes('pkcs12')
        ? 'Formato PFX não suportado. O arquivo pode estar corrompido.'
        : cryptoErr?.message ?? String(cryptoErr)
      return NextResponse.json(
        { message: `Certificado rejeitado: ${hint}` },
        { status: 400 }
      )
    }

    // 4. cUFAutor = 2 primeiros dígitos IBGE
    const cUFAutor = cfg.codigo_ibge?.substring(0, 2)
    if (!cUFAutor) {
      return NextResponse.json(
        { message: 'Código IBGE não configurado' },
        { status: 400 }
      )
    }

    // 5. Recupera último NSU
    const { data: nsuRow } = await supabaseAdmin
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
    // ── LOG TEMPORÁRIO — remover após diagnóstico ──────────────
    console.log('=== RESPOSTA SEFAZ RAW ===')
    console.log(xmlResposta)
    console.log('=== FIM RESPOSTA ===')

    // 8. Extrai notas
    const notas = await extrairNotas(xmlResposta)
    console.log('Notas extraídas:', notas.length)
    // 9. Salva no banco + upsert de fornecedores
    if (notas.length > 0) {
      await supabaseAdmin
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

      // Upsert fornecedores — silencioso, falha individual não bloqueia o sync
      await Promise.allSettled(
        notas.map(async (n) => {
          if (!n.emit) return
          const enderEmit = n.emit['enderEmit'] as Record<string, unknown> | undefined
          await upsertSupplier(companyId, {
            cnpj:               String(n.emit['CNPJ']  ?? ''),
            razao_social:       String(n.emit['xNome'] ?? ''),
            nome_fantasia:      n.emit['xFant'] ? String(n.emit['xFant']) : null,
            inscricao_estadual: n.emit['IE']    ? String(n.emit['IE'])    : null,
            contribuinte:       resolverContribuinte(n.emit['IE']),
            regime_tributario:  n.emit['CRT']
              ? ({ '1': 'simples', '2': 'simples_excesso', '3': 'lucro_real' }[String(n.emit['CRT'])] ?? null)
              : null,
            codigo_municipio:   enderEmit?.['cMun'] ? String(enderEmit['cMun']) : null,
            telefone:           n.emit['fone']  ? String(n.emit['fone'])  : null,
            email:              n.emit['email'] ? String(n.emit['email']) : null,
            endereco: enderEmit ? {
              logradouro: enderEmit['xLgr']    ? String(enderEmit['xLgr'])    : undefined,
              numero:     enderEmit['nro']     ? String(enderEmit['nro'])     : undefined,
              bairro:     enderEmit['xBairro'] ? String(enderEmit['xBairro']) : undefined,
              municipio:  enderEmit['xMun']    ? String(enderEmit['xMun'])    : undefined,
              uf:         enderEmit['UF']      ? String(enderEmit['UF'])      : undefined,
              cep:        enderEmit['CEP']     ? String(enderEmit['CEP'])     : undefined,
            } : null,
          })
        })
      )

      // Atualiza último NSU
      const maiorNSU = notas[notas.length - 1].nsu
      await supabaseAdmin
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