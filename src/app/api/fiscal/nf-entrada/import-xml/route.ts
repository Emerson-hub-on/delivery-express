import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { XMLParser } from 'fast-xml-parser'
import { converterCfopCst, Finalidade } from '@/lib/fiscal/conversao-cfop-cst'
import type { Product } from '@/types/product'
import { upsertSupplier, resolverContribuinte } from '@/lib/fiscal/upsertSupplier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Tipos locais ──────────────────────────────────────────────

type ItemNota = {
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
  produto_id: number | null
  produto_nome: string | null
}

type ProdutoCasado = Pick<Product, 'id' | 'name' | 'stock'> & {
  ean?: string | null
  code: number
}

type DetNFe = {
  prod?: {
    cEAN?: string | number
    cProd?: string | number
    xProd?: string
    NCM?: string | number
    CFOP?: string | number
    uCom?: string
    qCom?: string | number
    vUnCom?: string | number
    vProd?: string | number
  }
  imposto?: {
    ICMS?: Record<string, { CST?: string }>
  }
}

type ItensCasado = {
  item: ItemNota
  produto_id: number | null
  produto_nome: string | null
}

// ── Handler ───────────────────────────────────────────────────

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
    const parsed = parser.parse(xmlContent) as {
      nfeProc?: { NFe?: { infNFe?: Record<string, unknown> } }
      NFe?:     { infNFe?: Record<string, unknown> }
    }

    const infNFe =
      parsed?.nfeProc?.NFe?.infNFe ??
      parsed?.NFe?.infNFe

    if (!infNFe) {
      return NextResponse.json(
        { message: 'XML inválido — estrutura NF-e não encontrada' },
        { status: 422 }
      )
    }

    const rawId = (infNFe['@_Id'] as string | undefined)?.replace('NFe', '')
    if (!rawId || rawId.length !== 44) {
      return NextResponse.json(
        { message: 'Chave de acesso inválida no XML' },
        { status: 422 }
      )
    }
    const chave = rawId

    const rawDet = infNFe['det'] as DetNFe | DetNFe[] | undefined
    const dets: DetNFe[] = Array.isArray(rawDet) ? rawDet : rawDet ? [rawDet] : []

    // ── Itens da nota ─────────────────────────────────────────
    const itensNota: ItemNota[] = dets.map((det) => {
      const icmsObj  = det.imposto?.ICMS
      const icmsVals = icmsObj ? Object.values(icmsObj) : []
      const cst      = icmsVals[0]?.CST ?? ''

      return {
        ean:            det.prod?.cEAN && det.prod.cEAN !== 'SEM GTIN'
                          ? String(det.prod.cEAN) : '',
        codigo:         String(det.prod?.cProd ?? ''),
        descricao:      det.prod?.xProd ?? '',
        ncm:            String(det.prod?.NCM ?? ''),
        cfop:           String(det.prod?.CFOP ?? ''),
        cst,
        unidade:        det.prod?.uCom ?? 'UN',
        quantidade:     parseFloat(String(det.prod?.qCom ?? '1')),
        valor_unitario: parseFloat(String(det.prod?.vUnCom ?? '0')),
        valor_total:    parseFloat(String(det.prod?.vProd ?? '0')),
        produto_id:     null,
        produto_nome:   null,
      }
    })

    const itensOriginais   = itensNota.map(i => ({ cfop: i.cfop, cst: i.cst }))
    const itensConvertidos = await converterCfopCst({ companyId, itens: itensOriginais, finalidade })
    const requer_revisao   = itensConvertidos.some(i => !i.convertido)

    const ide     = infNFe['ide']   as Record<string, unknown> | undefined
    const emit    = infNFe['emit']  as Record<string, unknown> | undefined
    const total   = infNFe['total'] as Record<string, unknown> | undefined
    const icmsTot = total?.['ICMSTot'] as Record<string, unknown> | undefined

    // ── Upsert fornecedor ─────────────────────────────────────
    if (emit) {
      const enderEmit = emit['enderEmit'] as Record<string, unknown> | undefined
      await upsertSupplier(companyId, {
        cnpj:               String(emit['CNPJ']  ?? ''),
        razao_social:       String(emit['xNome'] ?? ''),
        nome_fantasia:      emit['xFant'] ? String(emit['xFant']) : null,
        inscricao_estadual: emit['IE']    ? String(emit['IE'])    : null,
        contribuinte:       resolverContribuinte(emit['IE']),
        regime_tributario:  emit['CRT']
          ? ({ '1': 'simples', '2': 'simples_excesso', '3': 'lucro_real' }[String(emit['CRT'])] ?? null)
          : null,
        codigo_municipio:   enderEmit?.['cMun'] ? String(enderEmit['cMun']) : null,
        telefone:           emit['fone']  ? String(emit['fone'])  : null,
        email:              emit['email'] ? String(emit['email']) : null,
        endereco: enderEmit ? {
          logradouro: enderEmit['xLgr']    ? String(enderEmit['xLgr'])    : undefined,
          numero:     enderEmit['nro']     ? String(enderEmit['nro'])     : undefined,
          bairro:     enderEmit['xBairro'] ? String(enderEmit['xBairro']) : undefined,
          municipio:  enderEmit['xMun']    ? String(enderEmit['xMun'])    : undefined,
          uf:         enderEmit['UF']      ? String(enderEmit['UF'])      : undefined,
          cep:        enderEmit['CEP']     ? String(enderEmit['CEP'])     : undefined,
        } : null,
      })
    }

    // ── Salva a nota ──────────────────────────────────────────
    const nota = {
      company_id:        companyId,
      chave,
      numero:            String(ide?.['nNF'] ?? ''),
      serie:             String(ide?.['serie'] ?? ''),
      emitente_razao:    String(emit?.['xNome'] ?? ''),
      emitente_cnpj:     String(emit?.['CNPJ'] ?? ''),
      valor_total:       parseFloat(String(icmsTot?.['vNF'] ?? '0')),
      data_emissao:      String(ide?.['dhEmi'] ?? ide?.['dEmi'] ?? ''),
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
      .returns<ProdutoCasado[]>()

    const produtos: ProdutoCasado[] = produtosEncontrados ?? []

    const itensCasados: ItensCasado[] = itensNota.map(item => {
      const match =
        (item.ean    && produtos.find(p => p.ean  === item.ean)) ||
        (item.codigo && produtos.find(p => String(p.code) === item.codigo))

      return {
        item,
        produto_id:   match ? match.id   : null,
        produto_nome: match ? match.name : null,
      }
    })

    // ── Atualiza estoque ──────────────────────────────────────
    await Promise.all(
      itensCasados
        .filter((c): c is ItensCasado & { produto_id: number } => c.produto_id !== null)
        .map(async ({ item, produto_id }) => {
          const prod = produtos.find(p => p.id === produto_id)
          if (!prod || prod.stock === null || prod.stock === undefined) return

          await supabaseAdmin
            .from('products')
            .update({ stock: (prod.stock ?? 0) + item.quantidade })
            .eq('id', produto_id)
            .eq('company_id', companyId)
        })
    )

    // ── Salva vínculo dos itens ───────────────────────────────
    await supabaseAdmin
      .from('nf_entrada')
      .update({
        itens_nota: itensCasados.map(c => ({
          ...c.item,
          produto_id:   c.produto_id,
          produto_nome: c.produto_nome,
        })),
      })
      .eq('company_id', companyId)
      .eq('chave', chave)

    const naoEncontrados = itensCasados.filter(c => c.produto_id === null)

    return NextResponse.json({
      nota,
      requer_revisao,
      itens_casados:   itensCasados.length,
      nao_encontrados: naoEncontrados.map(c => c.item),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ message }, { status: 500 })
  }
}