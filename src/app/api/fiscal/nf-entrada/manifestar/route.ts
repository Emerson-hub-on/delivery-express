import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Evento = 'ciencia' | 'confirmacao' | 'recusa' | 'cancelamento' | 'reabrir'

const STATUS_MAP: Record<Evento, 'pendente' | 'confirmada' | 'recusada' | 'cancelada'> = {
  ciencia:      'pendente',
  confirmacao:  'confirmada',
  recusa:       'recusada',
  cancelamento: 'cancelada',
  reabrir:      'pendente',
}

type ItemNota = {
  produto_id: number | null
  quantidade: number
}

export async function POST(req: NextRequest) {
  const { companyId, chave, evento, fatores } = await req.json() as {
    companyId: string
    chave: string
    evento: Evento
    fatores?: Record<number, number> // idx → fator
  }

  if (!companyId || !chave || !evento) {
    return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 })
  }

  if (!['ciencia', 'confirmacao', 'recusa', 'cancelamento', 'reabrir'].includes(evento)) {
    return NextResponse.json({ message: `Evento inválido: ${evento}` }, { status: 400 })
  }

  try {
    const novoStatus = STATUS_MAP[evento]

    const { error } = await supabaseAdmin
      .from('nf_entrada')
      .update({ status: novoStatus })
      .eq('company_id', companyId)
      .eq('chave', chave)

    if (error) throw error

    // Atualiza estoque apenas na confirmação
    if (evento === 'confirmacao' && fatores) {
      // Busca os itens da nota
      const { data: nota, error: notaError } = await supabaseAdmin
        .from('nf_entrada')
        .select('itens_nota')
        .eq('company_id', companyId)
        .eq('chave', chave)
        .single<{ itens_nota: ItemNota[] }>()

      if (notaError || !nota) throw new Error('Nota não encontrada')

      const itens = nota.itens_nota ?? []

      await Promise.all(
        itens.map(async (item, idx) => {
          if (!item.produto_id) return

          const fator = fatores[idx] ?? 1
          const qtdFinal = item.quantidade * fator

          // Busca estoque atual
          const { data: produto } = await supabaseAdmin
            .from('products')
            .select('stock')
            .eq('id', item.produto_id)
            .eq('company_id', companyId)
            .single<{ stock: number }>()

          if (!produto) return

          await supabaseAdmin
            .from('products')
            .update({ stock: (produto.stock ?? 0) + qtdFinal })
            .eq('id', item.produto_id)
            .eq('company_id', companyId)
        })
      )
    }

    return NextResponse.json({ ok: true, status: novoStatus })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ message }, { status: 500 })
  }
}