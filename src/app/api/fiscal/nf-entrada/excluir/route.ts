import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ItemNota = {
  codigo: string
  quantidade: number
  produto_id: number | null
  valor_unitario: number
}

type NotaComItens = {
  status: string
  itens_nota: ItemNota[] | null
}

export async function POST(req: NextRequest) {
  const { companyId, chave } = await req.json() as {
    companyId: string
    chave: string
  }

  if (!companyId || !chave) {
    return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 })
  }

  try {
    // Busca a nota antes de excluir para reverter estoque
    const { data: nota, error: notaError } = await supabaseAdmin
      .from('nf_entrada')
      .select('status, itens_nota')
      .eq('company_id', companyId)
      .eq('chave', chave)
      .single<NotaComItens>()

    if (notaError || !nota) {
      return NextResponse.json({ message: 'Nota não encontrada' }, { status: 404 })
    }

    // Só reverte estoque se a nota foi confirmada
    // Notas pendentes/recusadas/canceladas não alteraram o estoque
    if (nota.status === 'confirmada' && Array.isArray(nota.itens_nota)) {
      const itensVinculados = nota.itens_nota.filter(
        (i): i is ItemNota & { produto_id: number } => i.produto_id !== null
      )

      await Promise.all(
        itensVinculados.map(async item => {
          const { data: prod } = await supabaseAdmin
            .from('products')
            .select('stock, created_at')
            .eq('id', item.produto_id)
            .eq('company_id', companyId)
            .single<{ stock: number | null; created_at: string }>()

          if (!prod) return

          const estoqueAtual = prod.stock ?? 0
          const estoqueAposReversao = estoqueAtual - item.quantidade

          // Se o estoque após reversão for <= 0, volta para null
          // (significa que essa nota foi a origem do estoque)
          const novoEstoque = estoqueAposReversao <= 0 ? null : estoqueAposReversao

          await supabaseAdmin
            .from('products')
            .update({ stock: novoEstoque })
            .eq('id', item.produto_id)
            .eq('company_id', companyId)
        })
      )
    }

    // Exclui a nota
    const { error: deleteError } = await supabaseAdmin
      .from('nf_entrada')
      .delete()
      .eq('company_id', companyId)
      .eq('chave', chave)

    if (deleteError) throw deleteError

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ message }, { status: 500 })
  }
}