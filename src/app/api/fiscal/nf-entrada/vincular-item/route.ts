import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Product } from '@/types/product'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ProdutoVinculo = Pick<Product, 'id' | 'name' | 'price' | 'cost_price' | 'stock'> & {
  fator_conversao: number
  unidade_estoque: string
}

export async function POST(req: NextRequest) {
  const { companyId, chave, itemId, itemCodigo, produtoId } = await req.json() as {
    companyId: string
    chave:      string
    itemId:     string       // id da nf_entrada_itens (preferencial)
    itemCodigo: string       // fallback
    produtoId:  number
  }

  if (!companyId || !chave || !produtoId || (!itemId && !itemCodigo)) {
    return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 })
  }

  try {
    // 1. Busca produto
    const { data: produto } = await supabaseAdmin
      .from('products')
      .select('id, name, stock, cost_price, price, fator_conversao, unidade_estoque')
      .eq('id', produtoId)
      .eq('company_id', companyId)
      .single<ProdutoVinculo>()

    if (!produto) {
      return NextResponse.json({ message: 'Produto não encontrado' }, { status: 404 })
    }

    // 2. Atualiza o item na tabela relacional
    let query = supabaseAdmin
      .from('nf_entrada_itens')
      .update({ produto_id: produtoId, produto_nome: produto.name })
      .eq('company_id', companyId)
      .eq('chave', chave)

    if (itemId) {
      query = query.eq('id', itemId)
    } else {
      query = query.eq('codigo', itemCodigo)
    }

    const { error } = await query

    if (error) throw error

    return NextResponse.json({ ok: true, produto })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ message }, { status: 500 })
  }
}