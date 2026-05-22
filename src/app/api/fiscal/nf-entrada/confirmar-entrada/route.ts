import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { companyId, chave, atualizacoes } = await req.json() as {
    companyId: string
    chave: string
    atualizacoes: { produtoId: number; novoPrecoVenda: number }[]
  }

  if (!companyId || !chave) {
    return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 })
  }

  try {
    // Busca a nota para pegar os itens vinculados
    const { data: nota, error: notaError } = await supabaseAdmin
      .from('nf_entrada')
      .select('itens_nota')
      .eq('company_id', companyId)
      .eq('chave', chave)
      .single()

    if (notaError || !nota) {
      return NextResponse.json({ message: 'Nota não encontrada' }, { status: 404 })
    }

    const itens: any[] = nota.itens_nota ?? []

    // Atualiza custo e estoque de todos os itens com produto_id
    await Promise.all(
      itens
        .filter(i => i.produto_id !== null)
        .map(async item => {
          const { data: prod } = await supabaseAdmin
            .from('products')
            .select('stock')
            .eq('id', item.produto_id)
            .eq('company_id', companyId)
            .single()

          const updates: Record<string, any> = {
            cost_price: item.valor_unitario,
          }

          // Soma estoque só se o produto controla
          if (prod && prod.stock !== null) {
            updates.stock = (prod.stock ?? 0) + item.quantidade
          }

          // Atualiza preço de venda se o usuário optou
          const decisao = atualizacoes.find(a => a.produtoId === item.produto_id)
          if (decisao) {
            updates.price = decisao.novoPrecoVenda
          }

          await supabaseAdmin
            .from('products')
            .update(updates)
            .eq('id', item.produto_id)
            .eq('company_id', companyId)
        })
    )

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 })
  }
}