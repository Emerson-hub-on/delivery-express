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
  id:         string
  produto_id: number | null
  quantidade: number
}

export async function POST(req: NextRequest) {
  const { companyId, chave, evento, fatores } = await req.json() as {
    companyId: string
    chave: string
    evento: Evento
    fatores?: Record<string, number> // item.id (uuid da nf_entrada_itens) → fator
  }

  if (!companyId || !chave || !evento) {
    return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 })
  }

  if (!['ciencia', 'confirmacao', 'recusa', 'cancelamento', 'reabrir'].includes(evento)) {
    return NextResponse.json({ message: `Evento inválido: ${evento}` }, { status: 400 })
  }

  try {
    const novoStatus = STATUS_MAP[evento]

    // Atualiza o status e já recupera o id da nota (necessário para
    // consultar a tabela relacional nf_entrada_itens em seguida)
    const { data: notaRow, error } = await supabaseAdmin
      .from('nf_entrada')
      .update({ status: novoStatus })
      .eq('company_id', companyId)
      .eq('chave', chave)
      .select('id')
      .single<{ id: string }>()

    if (error || !notaRow) throw error ?? new Error('Nota não encontrada')

    // Atualiza estoque apenas na confirmação
    if (evento === 'confirmacao' && fatores) {
      // ── Busca os itens na tabela relacional (nf_entrada_itens) ──────────
      // Antes lia de nf_entrada.itens_nota (snapshot legado, anterior à
      // migração para a tabela relacional) — por isso o select falhava e
      // o endpoint retornava 500 mesmo após confirmar a nota.
      const { data: itensData, error: itensError } = await supabaseAdmin
        .from('nf_entrada_itens')
        .select('id, produto_id, quantidade')
        .eq('nf_entrada_id', notaRow.id)

      if (itensError) throw itensError

      const itens = (itensData ?? []) as ItemNota[]

      await Promise.all(
        itens.map(async (item) => {
          if (!item.produto_id) return

          // fatores é indexado pelo id (uuid) do item, não pela posição no array
          const fator = fatores[item.id] ?? 1
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
            .update({ stock: Math.round((produto.stock ?? 0) + qtdFinal) })
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