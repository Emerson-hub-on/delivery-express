import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function POST(req: NextRequest) {
  const { companyId, chave, atualizacoes } = await req.json() as {
    companyId: string
    chave: string
    atualizacoes: { produtoId: number; novoPrecoVenda: number }[]
  }

  console.log('confirmar-entrada payload:', { companyId, chave, atualizacoes })

  if (!companyId || !chave) {
    return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 })
  }

  try {
    const { data: nota, error: notaError } = await supabaseAdmin
      .from('nf_entrada')
      .select('itens_nota')
      .eq('company_id', companyId)
      .eq('chave', chave)
      .single<{ itens_nota: ItemNota[] }>()

    console.log('nota:', nota)
    console.log('notaError:', notaError)

    if (notaError || !nota) {
      return NextResponse.json({ message: 'Nota não encontrada' }, { status: 404 })
    }

    const itens: ItemNota[] = nota.itens_nota ?? []

    // Atualiza custo e estoque de todos os itens com produto_id
    await Promise.all(
      itens
        .filter((i): i is ItemNota & { produto_id: number } => i.produto_id !== null)
        .map(async item => {
          const { data: prod } = await supabaseAdmin
            .from('products')
            .select('stock')
            .eq('id', item.produto_id)
            .eq('company_id', companyId)
            .single<{ stock: number | null }>()

            const updates: Record<string, number> = {
            cost_price: item.valor_unitario,
            }

            if (prod) {
            updates.stock = prod.stock === null
                ? item.quantidade
                : prod.stock + item.quantidade
            }

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

    // Marca a nota como confirmada
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