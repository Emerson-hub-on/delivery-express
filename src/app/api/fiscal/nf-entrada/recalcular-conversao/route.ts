import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { converterCfopCst, type Finalidade } from '@/lib/fiscal/conversao-cfop-cst'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { companyId, chave, finalidade } = (await req.json()) as {
    companyId: string
    chave:     string
    finalidade: Finalidade
  }

  if (!companyId || !chave || !finalidade) {
    return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 })
  }

  try {
    // 1. Busca CFOPs/CSTs dos itens na tabela relacional
    const { data: itens, error: itensError } = await supabaseAdmin
      .from('nf_entrada_itens')
      .select('cfop, cst')
      .eq('company_id', companyId)
      .eq('chave', chave)

    if (itensError) throw itensError
    if (!itens || itens.length === 0) {
      return NextResponse.json({ message: 'Nenhum item encontrado para esta nota' }, { status: 404 })
    }

    // 2. Recalcula conversão com a nova finalidade
    const itensConvertidos = await converterCfopCst({
      companyId,
      itens: itens.map(i => ({ cfop: i.cfop, cst: i.cst })),
      finalidade,
    })

    const requer_revisao = itensConvertidos.some(i => !i.convertido)

    // 3. Salva finalidade e itens convertidos na nota
    const { error: updateError } = await supabaseAdmin
      .from('nf_entrada')
      .update({ finalidade, itens_convertidos: itensConvertidos, requer_revisao })
      .eq('company_id', companyId)
      .eq('chave', chave)

    if (updateError) throw updateError

    return NextResponse.json({ itens_convertidos: itensConvertidos, requer_revisao })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ message }, { status: 500 })
  }
}