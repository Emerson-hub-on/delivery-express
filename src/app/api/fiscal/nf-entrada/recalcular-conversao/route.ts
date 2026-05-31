import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { converterCfopCst, type Finalidade } from '@/lib/fiscal/conversao-cfop-cst'

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
  const { companyId, chave, finalidade } = (await req.json()) as {
    companyId: string
    chave: string
    finalidade: Finalidade
  }

  if (!companyId || !chave || !finalidade) {
    return NextResponse.json({ message: 'Parâmetros inválidos' }, { status: 400 })
  }

  try {
    // 1. Busca a nota com os itens originais
    const { data: nota, error: notaError } = await supabaseAdmin
      .from('nf_entrada')
      .select('itens_nota')
      .eq('company_id', companyId)
      .eq('chave', chave)
      .single<{ itens_nota: ItemNota[] }>()

    if (notaError || !nota) {
      return NextResponse.json({ message: 'Nota não encontrada' }, { status: 404 })
    }

    const itens: ItemNota[] = nota.itens_nota ?? []

    // 2. Recalcula conversão com a nova finalidade usando regras do banco
    const itensOriginais = itens.map(i => ({ cfop: i.cfop, cst: i.cst }))

    const itensConvertidos = await converterCfopCst({
      companyId,
      itens: itensOriginais,
      finalidade,
    })

    const requer_revisao = itensConvertidos.some(i => !i.convertido)

    // 3. Salva finalidade e itens convertidos
    const { error: updateError } = await supabaseAdmin
      .from('nf_entrada')
      .update({
        finalidade,
        itens_convertidos: itensConvertidos,
        requer_revisao,
      })
      .eq('company_id', companyId)
      .eq('chave', chave)

    if (updateError) throw updateError

    return NextResponse.json({
      itens_convertidos: itensConvertidos,
      requer_revisao,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ message }, { status: 500 })
  }
}