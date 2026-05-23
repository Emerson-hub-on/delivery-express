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

export async function POST(req: NextRequest) {
  const { companyId, chave, evento } = await req.json() as {
    companyId: string
    chave: string
    evento: Evento
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

    return NextResponse.json({ ok: true, status: novoStatus })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ message }, { status: 500 })
  }
}