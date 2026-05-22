import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { companyId, chave, itemCodigo, produtoId } = await req.json() as {
    companyId: string
    chave: string
    itemCodigo: string   // codigo do item na nota (cProd)
    produtoId: number
  }

  if (!companyId || !chave || !itemCodigo || !produtoId) {
    return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 })
  }

  try {
    // Busca a nota e o produto
    const [{ data: notaData }, { data: produto }] = await Promise.all([
      supabaseAdmin
        .from('nf_entrada')
        .select('itens_nota')
        .eq('company_id', companyId)
        .eq('chave', chave)
        .single(),
      supabaseAdmin
        .from('products')
        .select('id, name, stock')
        .eq('id', produtoId)
        .eq('company_id', companyId)
        .single(),
    ])

    if (!notaData || !produto) {
      return NextResponse.json({ message: 'Nota ou produto não encontrado' }, { status: 404 })
    }

    const itens: any[] = notaData.itens_nota ?? []
    const idx = itens.findIndex(i => i.codigo === itemCodigo)
    if (idx === -1) {
      return NextResponse.json({ message: 'Item não encontrado na nota' }, { status: 404 })
    }

    const item = itens[idx]

    // Evita vínculo duplicado
    if (item.produto_id === produtoId) {
      return NextResponse.json({ message: 'Item já vinculado a este produto' }, { status: 409 })
    }

    // Atualiza o vínculo no array
    itens[idx] = { ...item, produto_id: produtoId, produto_nome: produto.name }

    await supabaseAdmin
      .from('nf_entrada')
      .update({ itens_nota: itens })
      .eq('company_id', companyId)
      .eq('chave', chave)

    // Atualiza estoque se o produto controla
    if (produto.stock !== null && produto.stock !== undefined) {
      const novoEstoque = (produto.stock ?? 0) + item.quantidade
      await supabaseAdmin
        .from('products')
        .update({ stock: novoEstoque })
        .eq('id', produtoId)
        .eq('company_id', companyId)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 })
  }
}