import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { companyId, chave, atualizacoes, fatores } = await req.json() as {
    companyId:   string
    chave:       string
    atualizacoes: { produtoId: number; novoPrecoVenda: number }[]
    fatores?:    { itemId?: string; itemCodigo?: string; fatorConversao: number }[]
  }

  if (!companyId || !chave) {
    return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 })
  }

  try {
    // 1. Busca itens vinculados na tabela relacional
    const { data: itens, error: itensError } = await supabaseAdmin
      .from('nf_entrada_itens')
      .select('id, codigo, produto_id, quantidade, valor_unitario')
      .eq('company_id', companyId)
      .eq('chave', chave)
      .not('produto_id', 'is', null)

    if (itensError) throw itensError
    if (!itens || itens.length === 0) {
      return NextResponse.json({ message: 'Nenhum item vinculado encontrado' }, { status: 404 })
    }

    // 2. Atualiza custo, estoque e preço de cada produto
    await Promise.all(
      itens.map(async (item) => {
        // Fator de conversão para este item
        const fatorItem = fatores?.find(f => f.itemId === item.id || f.itemCodigo === item.codigo)
        const fator = fatorItem?.fatorConversao ?? 1

        const { data: prod } = await supabaseAdmin
          .from('products')
          .select('stock')
          .eq('id', item.produto_id)
          .eq('company_id', companyId)
          .single<{ stock: number | null }>()

        const qtdEstoque = item.quantidade * fator

        const updates: Record<string, number> = {
          cost_price: item.valor_unitario,
          stock: prod?.stock === null || prod?.stock === undefined
            ? qtdEstoque
            : prod.stock + qtdEstoque,
        }

        const decisao = atualizacoes?.find(a => a.produtoId === item.produto_id)
        if (decisao) {
          updates.price = decisao.novoPrecoVenda
        }

        await supabaseAdmin
          .from('products')
          .update(updates)
          .eq('id', item.produto_id)
          .eq('company_id', companyId)

        // Persiste o fator usado na tabela de itens
        if (fator !== 1) {
          await supabaseAdmin
            .from('nf_entrada_itens')
            .update({ fator_conversao: fator })
            .eq('id', item.id)
        }
      })
    )

    // 3. Marca nota como confirmada
    const { error: updateError } = await supabaseAdmin
      .from('nf_entrada')
      .update({ status: 'confirmada' })
      .eq('company_id', companyId)
      .eq('chave', chave)

    if (updateError) throw updateError

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ message }, { status: 500 })
  }
}