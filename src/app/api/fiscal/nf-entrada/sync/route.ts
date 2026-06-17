import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import https from 'https'
import { XMLParser } from 'fast-xml-parser'
import { upsertSupplier, resolverContribuinte } from '@/lib/fiscal/upsertSupplier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Types ──────────────────────────────────────────────────────────────────────

interface ItemNota {
  codigo:         string
  descricao:      string
  ean:            string | null
  ncm:            string
  cfop:           string
  cst:            string
  unidade:        string
  quantidade:     number
  valor_unitario: number
  valor_total:    number
  produto_id:     number | null
  produto_nome:   string | null
}

interface NotaExtraida {
  chave:          string
  numero:         string
  serie:          string
  emitente_razao: string
  emitente_cnpj:  string
  valor_total:    number
  data_emissao:   string
  xml:            string
  nsu:            string
  emit:           Record<string, unknown> | undefined
  itens:          ItemNota[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function soapRequest(xmlBody: string, pfxBuffer: Buffer, senha: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ pfx: pfxBuffer, passphrase: senha, rejectUnauthorized: true })
    const bodyBuffer = Buffer.from(xmlBody, 'utf-8')
    const options = {
      hostname: 'www1.nfe.fazenda.gov.br',
      path:     '/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
      method:   'POST',
      agent,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"',
        'Content-Length': bodyBuffer.length,
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.write(bodyBuffer)
    req.end()
  })
}

function buildSoapEnvelope({ tipo, valor, ultNSU, ambiente, cUFAutor }: {
  tipo: 'cpf' | 'cnpj'; valor: string; ultNSU: string; ambiente: number; cUFAutor: string
}) {
  const docTag     = tipo === 'cpf' ? `<CPF>${valor}</CPF>` : `<CNPJ>${valor}</CNPJ>`
  const distDFeInt = `<distDFeInt versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${ambiente}</tpAmb><cUFAutor>${cUFAutor}</cUFAutor>${docTag}<distNSU><ultNSU>${ultNSU}</ultNSU></distNSU></distDFeInt>`
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfed="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><soap:Header/><soap:Body><nfed:nfeDistDFeInteresse><nfed:nfeDadosMsg>${distDFeInt}</nfed:nfeDadosMsg></nfed:nfeDistDFeInteresse></soap:Body></soap:Envelope>`
}

// Extrai itens do infNFe já parseado
function extrairItens(infNFe: any): ItemNota[] {
  const dets = infNFe.det
  if (!dets) return []
  const lista = Array.isArray(dets) ? dets : [dets]

  return lista.map((det: any): ItemNota => {
    // CST pode estar em ICMS00, ICMS40, ICMSSN102 etc. — pega o primeiro filho
    const icmsGrupo  = det.imposto?.ICMS ?? {}
    const icmsValores = Object.values(icmsGrupo) as any[]
    const cst =
      icmsValores[0]?.CST?.toString() ??
      icmsValores[0]?.CSOSN?.toString() ??
      ''

    const ean = det.prod?.cEAN?.toString()
    return {
      codigo:         det.prod?.cProd?.toString()  ?? '',
      descricao:      det.prod?.xProd?.toString()  ?? '',
      ean:            ean && ean !== 'SEM GTIN' ? ean : null,
      ncm:            det.prod?.NCM?.toString()    ?? '',
      cfop:           det.prod?.CFOP?.toString()   ?? '',
      cst,
      unidade:        det.prod?.uCom?.toString()   ?? '',
      quantidade:     parseFloat(det.prod?.qCom    ?? '0'),
      valor_unitario: parseFloat(det.prod?.vUnCom  ?? '0'),
      valor_total:    parseFloat(det.prod?.vProd   ?? '0'),
      produto_id:     null,
      produto_nome:   null,
    }
  })
}

async function extrairNotas(xmlResposta: string): Promise<NotaExtraida[]> {
  const parser = new XMLParser({ ignoreAttributes: false })
  const parsed = parser.parse(xmlResposta)

  const body =
    parsed?.['soap:Envelope']?.['soap:Body'] ??
    parsed?.['soap12:Envelope']?.['soap12:Body']

  const retorno =
    body?.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult?.retDistDFeInt ??
    body?.nfeDistDFeIntResponse?.nfeDistDFeIntResult?.retDistDFeInt

  console.log('cStat:', retorno?.cStat, '|', retorno?.xMotivo)
  if (!retorno) return []

  const cStat = Number(retorno?.cStat)
  if (![137, 138].includes(cStat)) return []

  const docs = retorno?.loteDistDFeInt?.docZip
  if (!docs) return []

  const lista = Array.isArray(docs) ? docs : [docs]

  const { gunzip }  = await import('zlib')
  const { promisify } = await import('util')
  const gunzipAsync = promisify(gunzip)

  const notas: NotaExtraida[] = []

  for (const doc of lista) {
    if (!doc) continue
    try {
      const buffer  = Buffer.from(doc['#text'] ?? doc, 'base64')
      const xmlNota = (await gunzipAsync(buffer)).toString('utf-8')

      const p2 = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
      const nfe = p2.parse(xmlNota)

      const infNFe = nfe?.nfeProc?.NFe?.infNFe ?? nfe?.NFe?.infNFe
      if (!infNFe) continue

      notas.push({
        chave:          infNFe['@_Id']?.replace('NFe', '') ?? doc['@_NSU'],
        numero:         infNFe.ide?.nNF?.toString()        ?? '',
        serie:          infNFe.ide?.serie?.toString()      ?? '',
        emitente_razao: infNFe.emit?.xNome                 ?? '',
        emitente_cnpj:  infNFe.emit?.CNPJ                  ?? '',
        valor_total:    parseFloat(infNFe.total?.ICMSTot?.vNF ?? '0'),
        data_emissao:   infNFe.ide?.dhEmi ?? infNFe.ide?.dEmi ?? '',
        xml:            xmlNota,
        nsu:            doc['@_NSU'],
        emit:           infNFe.emit as Record<string, unknown> | undefined,
        itens:          extrairItens(infNFe),
      })
    } catch {
      // CT-e, evento, resNFe resumido etc. — ignora
    }
  }

  return notas
}

async function salvarLote(companyId: string, notas: NotaExtraida[]) {
  if (notas.length === 0) return

  // 1. Upsert das notas (sem itens_nota — coluna legada)
  const { data: notasSalvas, error } = await supabaseAdmin
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
    .select('id, chave')

  if (error) {
    console.error('[salvarLote] erro nf_entrada upsert:', error)
    return
  }

  // 2. Monta mapa chave → id
  const chaveParaId = new Map<string, string>(
    (notasSalvas ?? []).map((r: any) => [r.chave.trim(), r.id])
  )

  // 3. Insere itens apenas para notas recém-inseridas (id presente no retorno)
  const itensPorInserir: any[] = []

  for (const nota of notas) {
    const nfEntradaId = chaveParaId.get(nota.chave.trim())
    if (!nfEntradaId) continue // nota já existia (ignoreDuplicates) — não reescreve itens

    for (const item of nota.itens) {
      itensPorInserir.push({
        nf_entrada_id:  nfEntradaId,
        company_id:     companyId,
        chave:          nota.chave,
        codigo:         item.codigo,
        descricao:      item.descricao,
        ean:            item.ean,
        ncm:            item.ncm,
        cfop:           item.cfop,
        cst:            item.cst,
        unidade:        item.unidade,
        quantidade:     item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total:    item.valor_total,
        produto_id:     null,
        produto_nome:   null,
        fator_conversao: 1,
      })
    }
  }

  if (itensPorInserir.length > 0) {
    const { error: itensError } = await supabaseAdmin
      .from('nf_entrada_itens')
      .insert(itensPorInserir)

    if (itensError) console.error('[salvarLote] erro nf_entrada_itens insert:', itensError)
    else console.log(`[salvarLote] ${itensPorInserir.length} itens inseridos`)
  }

  // 4. Upsert fornecedores
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
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json()
    if (!companyId) return NextResponse.json({ message: 'companyId é obrigatório' }, { status: 400 })

    // 1. Config fiscal
    const { data: cfg, error: cfgError } = await supabaseAdmin
      .from('fiscal_configs')
      .select('cnpj,cpf,cert_pfx_base64,cert_senha,cert_cpf_pfx_base64,cert_cpf_senha,ambiente,codigo_ibge')
      .eq('company_id', companyId)
      .single()

    if (cfgError || !cfg) return NextResponse.json({ message: 'Configuração fiscal não encontrada' }, { status: 400 })

    // 2. Modo
    const tipo  = cfg.cpf ? 'cpf' : 'cnpj'
    const valor = cfg.cpf ? cfg.cpf : cfg.cnpj
    if (!valor) return NextResponse.json({ message: tipo === 'cpf' ? 'CPF não configurado' : 'CNPJ não configurado' }, { status: 400 })

    // 3. Certificado
    const pfxBase64 = cfg.cpf ? cfg.cert_cpf_pfx_base64 : cfg.cert_pfx_base64
    const pfxSenha  = cfg.cpf ? cfg.cert_cpf_senha       : cfg.cert_senha

    if (!pfxBase64) return NextResponse.json({
      message: cfg.cpf ? 'e-CPF não configurado' : 'Certificado digital não configurado'
    }, { status: 400 })

    if (!pfxSenha) return NextResponse.json({
      message: cfg.cpf ? 'Senha do e-CPF não configurada' : 'Senha do certificado não configurada'
    }, { status: 400 })

    // 4. Sanitiza PFX
    let pfxBase64Clean = pfxBase64.replace(/\s+/g, '')
    if (pfxBase64Clean.includes(',')) pfxBase64Clean = pfxBase64Clean.split(',')[1] ?? pfxBase64Clean
    pfxBase64Clean = pfxBase64Clean.replace(/[^A-Za-z0-9+/=]/g, '')
    const pfxBuffer = Buffer.from(pfxBase64Clean, 'base64')

    if (pfxBuffer.length < 4 || pfxBuffer[0] !== 0x30)
      return NextResponse.json({ message: `PFX inválido: magic byte incorreto (0x${pfxBuffer[0]?.toString(16)})` }, { status: 400 })

    try {
      const { createSecureContext } = await import('tls')
      createSecureContext({ pfx: pfxBuffer, passphrase: pfxSenha })
    } catch (cryptoErr: any) {
      const msg  = (cryptoErr?.message ?? '').toLowerCase()
      const hint = msg.includes('bad decrypt') || msg.includes('mac') ? 'Senha incorreta para este certificado.'
        : msg.includes('unsupported') ? 'Formato PFX não suportado.'
        : cryptoErr?.message
      return NextResponse.json({ message: `Certificado rejeitado: ${hint}` }, { status: 400 })
    }

    // 5. cUFAutor
    const cUFAutor = cfg.codigo_ibge?.substring(0, 2)
    if (!cUFAutor) return NextResponse.json({ message: 'Código IBGE não configurado' }, { status: 400 })

    // 6. Último NSU
    const { data: nsuRow } = await supabaseAdmin
      .from('nf_entrada_nsu')
      .select('ult_nsu')
      .eq('company_id', companyId)
      .single()

    const ultNSU = nsuRow?.ult_nsu ?? '000000000000000'

    // 7. Busca + salva (sem loop — uma chamada por request)
    const envelope = buildSoapEnvelope({ tipo, valor, ultNSU, ambiente: cfg.ambiente, cUFAutor })

    let xmlResposta: string
    try {
      xmlResposta = await soapRequest(envelope, pfxBuffer, pfxSenha)
    } catch (e: any) {
      return NextResponse.json({ message: `Erro ao conectar na SEFAZ: ${e.message}` }, { status: 502 })
    }

    const notas = await extrairNotas(xmlResposta)
    console.log(`[sync] ${notas.length} notas extraídas | ultNSU: ${ultNSU}`)

    await salvarLote(companyId, notas)

    // 8. Avança NSU
    if (notas.length > 0) {
      const maiorNSU = notas[notas.length - 1].nsu
      await supabaseAdmin
        .from('nf_entrada_nsu')
        .upsert({ company_id: companyId, ult_nsu: maiorNSU, updated_at: new Date().toISOString() }, { onConflict: 'company_id' })
    }

    return NextResponse.json({ synced: notas.length })

  } catch (e: any) {
    return NextResponse.json({ message: e?.message ?? 'Erro interno ao sincronizar notas' }, { status: 500 })
  }
}