// app/api/fiscal/nf-entrada/reprocessar-itens/route.ts
// Rota temporária — popula nf_entrada_itens para as notas já salvas sem itens.
// Após rodar com sucesso, pode ser deletada.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { XMLParser } from 'fast-xml-parser'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function extrairItensDoXml(xmlRaw: string) {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const nfe    = parser.parse(xmlRaw)

  const infNFe = nfe?.nfeProc?.NFe?.infNFe ?? nfe?.NFe?.infNFe
  if (!infNFe) return []

  const dets = infNFe.det
  if (!dets) return []
  const lista = Array.isArray(dets) ? dets : [dets]

  return lista.map((det: any) => {
    const icmsGrupo   = det.imposto?.ICMS ?? {}
    const icmsValores = Object.values(icmsGrupo) as any[]
    const cst =
      icmsValores[0]?.CST?.toString() ??
      icmsValores[0]?.CSOSN?.toString() ??
      ''

    const ean = det.prod?.cEAN?.toString()
    return {
      codigo:          det.prod?.cProd?.toString() ?? '',
      descricao:       det.prod?.xProd?.toString() ?? '',
      ean:             ean && ean !== 'SEM GTIN' ? ean : null,
      ncm:             det.prod?.NCM?.toString()   ?? '',
      cfop:            det.prod?.CFOP?.toString()  ?? '',
      cst: (icmsValores[0]?.CST?.toString() ?? icmsValores[0]?.CSOSN?.toString() ?? '').padStart(3, '0'),
      unidade:         det.prod?.uCom?.toString()  ?? '',
      quantidade:      parseFloat(det.prod?.qCom   ?? '0'),
      valor_unitario:  parseFloat(det.prod?.vUnCom ?? '0'),
      valor_total:     parseFloat(det.prod?.vProd  ?? '0'),
      produto_id:      null,
      produto_nome:    null,
      fator_conversao: 1,
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json()
    if (!companyId) return NextResponse.json({ message: 'companyId é obrigatório' }, { status: 400 })

    // 1. Busca notas sem itens na nova tabela
    const { data: todasNotas, error } = await supabaseAdmin
      .from('nf_entrada')
      .select('id, chave, xml_raw')
      .eq('company_id', companyId)
      .not('xml_raw', 'is', null)

    if (error) return NextResponse.json({ message: error.message }, { status: 500 })

    // 2. Filtra as que ainda não têm itens na tabela relacional
    const { data: comItens } = await supabaseAdmin
      .from('nf_entrada_itens')
      .select('nf_entrada_id')
      .eq('company_id', companyId)

    const idsComItens = new Set((comItens ?? []).map((r: any) => r.nf_entrada_id))
    const semItens = (todasNotas ?? []).filter((n: any) => !idsComItens.has(n.id))

    console.log(`[reprocessar] ${semItens.length} notas sem itens de ${todasNotas?.length ?? 0} total`)

    let processadas = 0
    let erros = 0
    const itensPorInserir: any[] = []

    for (const nota of semItens) {
      try {
        const itens = extrairItensDoXml(nota.xml_raw)
        for (const item of itens) {
          itensPorInserir.push({
            nf_entrada_id: nota.id,
            company_id:    companyId,
            chave:         nota.chave,
            ...item,
          })
        }
        processadas++
      } catch (e) {
        console.error(`[reprocessar] erro na nota ${nota.chave}:`, e)
        erros++
      }
    }

    // 3. Insere em lotes de 500
    const BATCH = 500
    for (let i = 0; i < itensPorInserir.length; i += BATCH) {
      const lote = itensPorInserir.slice(i, i + BATCH)
      const { error: insertError } = await supabaseAdmin
        .from('nf_entrada_itens')
        .insert(lote)
      if (insertError) {
        console.error('[reprocessar] erro ao inserir lote:', insertError)
        erros++
      }
    }

    return NextResponse.json({
      processadas,
      erros,
      itens_inseridos: itensPorInserir.length,
    })

  } catch (e: any) {
    return NextResponse.json({ message: e?.message ?? 'Erro interno' }, { status: 500 })
  }
}