import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { XMLParser } from 'fast-xml-parser'
import { converterCfopCst, Finalidade } from '@/lib/fiscal/conversao-cfop-cst'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { companyId, xmlContent, finalidade = 'revenda' } = await req.json() as {
    companyId: string
    xmlContent: string
    finalidade?: Finalidade
  }

  if (!xmlContent) {
    return NextResponse.json({ message: 'XML não informado' }, { status: 400 })
  }

  try {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
    const parsed = parser.parse(xmlContent)

    const infNFe =
      parsed?.nfeProc?.NFe?.infNFe ??
      parsed?.NFe?.infNFe

    if (!infNFe) {
      return NextResponse.json(
        { message: 'XML inválido — estrutura NF-e não encontrada' },
        { status: 422 }
      )
    }

    const chave = infNFe['@_Id']?.replace('NFe', '')
    if (!chave || chave.length !== 44) {
      return NextResponse.json(
        { message: 'Chave de acesso inválida no XML' },
        { status: 422 }
      )
    }

    const dets = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det].filter(Boolean)

    // ── Itens da nota ─────────────────────────────────────────
    const itensNota: {
      ean: string
      codigo: string
      descricao: string
      ncm: string
      cfop: string
      cst: string
      unidade: string
      quantidade: number
      valor_unitario: number
      valor_total: number
    }[] = dets.map((det: any) => ({
      ean:           det.prod?.cEAN && det.prod.cEAN !== 'SEM GTIN' ? det.prod.cEAN : '',
      codigo:        det.prod?.cProd?.toString() ?? '',
      descricao:     det.prod?.xProd ?? '',
      ncm:           det.prod?.NCM?.toString() ?? '',
      cfop:          det.prod?.CFOP?.toString() ?? '',
      cst:           det.imposto?.ICMS
                       ? (Object.values(det.imposto.ICMS)[0] as any)?.CST ?? ''
                       : '',
      unidade:       det.prod?.uCom ?? 'UN',
      quantidade:    parseFloat(det.prod?.qCom ?? '1'),
      valor_unitario: parseFloat(det.prod?.vUnCom ?? '0'),
      valor_total:   parseFloat(det.prod?.vProd ?? '0'),
    }))

    const itensOriginais = itensNota.map(i => ({ cfop: i.cfop, cst: i.cst }))
    const itensConvertidos = await converterCfopCst({ companyId, itens: itensOriginais, finalidade })
    const requer_revisao = itensConvertidos.some(i => !i.convertido)

    // ── Salva a nota ──────────────────────────────────────────
    const nota = {
      company_id:        companyId,
      chave,
      numero:            infNFe.ide?.nNF?.toString() ?? '',
      serie:             infNFe.ide?.serie?.toString() ?? '',
      emitente_razao:    infNFe.emit?.xNome ?? '',
      emitente_cnpj:     infNFe.emit?.CNPJ ?? '',
      valor_total:       parseFloat(infNFe.total?.ICMSTot?.vNF ?? '0'),
      data_emissao:      infNFe.ide?.dhEmi ?? infNFe.ide?.dEmi ?? '',
      status:            'pendente' as const,
      xml_raw:           xmlContent,
      finalidade,
      itens_convertidos: itensConvertidos,
      requer_revisao,
    }

    const { error: upsertError } = await supabaseAdmin
      .from('nf_entrada')
      .upsert(nota, { onConflict: 'company_id,chave', ignoreDuplicates: true })

    if (upsertError) throw upsertError

    // ── Tenta casar itens com produtos cadastrados ────────────
    const eans    = itensNota.map(i => i.ean).filter(Boolean)
    const codigos = itensNota.map(i => i.codigo).filter(Boolean)

    const { data: produtosEncontrados } = await supabaseAdmin
      .from('products')
      .select('id, name, ean, code, stock')
      .eq('company_id', companyId)
      .eq('active', true)
      .or(
        [
          eans.length    ? `ean.in.(${eans.join(',')})` : null,
          codigos.length ? `code.in.(${codigos.join(',')})` : null,
        ].filter(Boolean).join(',')
      )

    const produtos = produtosEncontrados ?? []

    // ── Associa cada item da nota a um produto cadastrado ─────
    const itensCasados: {
      item: typeof itensNota[0]
      produto_id: number | null
      produto_nome: string | null
    }[] = itensNota.map(item => {
      const match =
        (item.ean   && produtos.find(p => p.ean   === item.ean))   ||
        (item.codigo && produtos.find(p => String(p.code) === item.codigo))

      return {
        item,
        produto_id:   match ? match.id   : null,
        produto_nome: match ? match.name : null,
      }
    })

    // ── Atualiza estoque dos produtos casados ─────────────────
    const atualizacoes = itensCasados
      .filter(i => i.produto_id !== null)
      .map(async ({ item, produto_id }) => {
        const prod = produtos.find(p => p.id === produto_id)!
        if (prod.stock === null || prod.stock === undefined) return // não controla estoque

        const novoEstoque = (prod.stock ?? 0) + item.quantidade

        await supabaseAdmin
          .from('products')
          .update({ stock: novoEstoque })
          .eq('id', produto_id)
          .eq('company_id', companyId)
      })

    await Promise.all(atualizacoes)

    // ── Salva o vínculo dos itens na nota ─────────────────────
    await supabaseAdmin
      .from('nf_entrada')
      .update({
        itens_nota: itensCasados.map(i => ({
          ...i.item,
          produto_id:   i.produto_id,
          produto_nome: i.produto_nome,
        })),
      })
      .eq('company_id', companyId)
      .eq('chave', chave)

    const naoEncontrados = itensCasados.filter(i => i.produto_id === null)

    return NextResponse.json({
      nota,
      requer_revisao,
      itens_casados:      itensCasados.length,
      nao_encontrados:    naoEncontrados.map(i => i.item),
    })
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 })
  }
}