import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Product } from '@/types/product'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

type ProdutoVinculo = Pick<Product, 'id' | 'name' | 'price' | 'cost_price' | 'stock'> & {
  fator_conversao: number
  unidade_estoque: string
}

export async function POST(req: NextRequest) {
  const { companyId, chave, itemCodigo, produtoId } = await req.json() as {
    companyId: string
    chave: string
    itemCodigo: string
    produtoId: number
  }

  console.log('vincular-item payload:', { companyId, chave, itemCodigo, produtoId })

  if (!companyId || !chave || !itemCodigo || !produtoId) {
    return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 })
  }

  try {
    const [{ data: notaData }, { data: produto }] = await Promise.all([
      supabaseAdmin
        .from('nf_entrada')
        .select('itens_nota')
        .eq('company_id', companyId)
        .eq('chave', chave)
        .single<{ itens_nota: ItemNota[] }>(),
      supabaseAdmin
        .from('products')
        // ← inclui os dois novos campos
        .select('id, name, stock, cost_price, price, fator_conversao, unidade_estoque')
        .eq('id', produtoId)
        .eq('company_id', companyId)
        .single<ProdutoVinculo>(),
    ])

    if (!notaData || !produto) {
      return NextResponse.json({ message: 'Nota ou produto não encontrado' }, { status: 404 })
    }

    const itens: ItemNota[] = notaData.itens_nota ?? []
    const idx = itens.findIndex(i => i.codigo === itemCodigo)

    if (idx === -1) {
      return NextResponse.json({ message: 'Item não encontrado na nota' }, { status: 404 })
    }

    if (itens[idx].produto_id === produtoId) {
      return NextResponse.json({ message: 'Item já vinculado a este produto' }, { status: 409 })
    }

    // Apenas salva o vínculo — estoque é atualizado só na confirmação
    itens[idx] = { ...itens[idx], produto_id: produtoId, produto_nome: produto.name }

    const { error } = await supabaseAdmin
      .from('nf_entrada')
      .update({ itens_nota: itens })
      .eq('company_id', companyId)
      .eq('chave', chave)

    if (error) throw error

    return NextResponse.json({ ok: true, produto })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ message }, { status: 500 })
  }
}