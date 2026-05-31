import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type RegraConversao = {
  id: number
  cfop_origem: string
  cst_origem: string
  crt: number
  cfop_entrada: string
  cst_entrada: string
  finalidade: string
  tem_icms: boolean
  descricao: string | null
  created_at: string
}

type RegraInput = {
  cfop_origem: string
  cst_origem: string
  crt: number
  cfop_entrada: string
  cst_entrada: string
  finalidade: string
  tem_icms: boolean
  descricao?: string | null
}

function validar(body: Partial<RegraInput>): string | null {
  if (!body.cfop_origem || !/^\d{4}$/.test(body.cfop_origem))
    return 'cfop_origem deve ter exatamente 4 dígitos numéricos'
  if (!body.cfop_entrada || !/^\d{4}$/.test(body.cfop_entrada))
    return 'cfop_entrada deve ter exatamente 4 dígitos numéricos'
  if (!body.cst_entrada || body.cst_entrada.trim() === '')
    return 'cst_entrada é obrigatório'
  if (!body.finalidade || body.finalidade.trim() === '')
    return 'finalidade é obrigatória'
  if (body.crt === undefined || ![1, 2, 3].includes(Number(body.crt)))
    return 'crt deve ser 1 (Simples Nacional), 2 (Simples Nacional Excesso) ou 3 (Regime Normal)'
  return null
}

/** GET /api/fiscal/conversao-regras
 *  Query params: finalidade?, crt?, busca?
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const finalidade = searchParams.get('finalidade')
  const crt        = searchParams.get('crt')
  const busca      = searchParams.get('busca')

  let query = supabaseAdmin
    .from('cfop_cst_conversao')
    .select('*')
    .order('finalidade')
    .order('cfop_origem')

  if (finalidade) query = query.eq('finalidade', finalidade)
  if (crt)        query = query.eq('crt', Number(crt))
  if (busca)      query = query.or(
    `cfop_origem.ilike.%${busca}%,cfop_entrada.ilike.%${busca}%,cst_origem.ilike.%${busca}%`
  )

  const { data, error } = await query
  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  return NextResponse.json({ regras: data ?? [] })
}

/** POST /api/fiscal/conversao-regras — cria nova regra */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as RegraInput

  const erro = validar(body)
  if (erro) return NextResponse.json({ message: erro }, { status: 400 })

  const payload = {
    cfop_origem:  body.cfop_origem.trim(),
    cst_origem:   (body.cst_origem ?? '').trim(),
    crt:          Number(body.crt),
    cfop_entrada: body.cfop_entrada.trim(),
    cst_entrada:  body.cst_entrada.trim(),
    finalidade:   body.finalidade.trim(),
    tem_icms:     body.tem_icms ?? true,
    descricao:    body.descricao?.trim() || null,
  }

  const { data, error } = await supabaseAdmin
    .from('cfop_cst_conversao')
    .insert(payload)
    .select()
    .single()

  if (error) {
    if (error.code === '23505')
      return NextResponse.json(
        { message: 'Já existe uma regra para este CFOP/CST/CRT/Finalidade' },
        { status: 409 }
      )
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ regra: data }, { status: 201 })
}

/** PUT /api/fiscal/conversao-regras — atualiza regra existente (id no body) */
export async function PUT(req: NextRequest) {
  const body = (await req.json()) as RegraInput & { id: number }

  if (!body.id) return NextResponse.json({ message: 'id é obrigatório' }, { status: 400 })

  const erro = validar(body)
  if (erro) return NextResponse.json({ message: erro }, { status: 400 })

  const payload = {
    cfop_origem:  body.cfop_origem.trim(),
    cst_origem:   (body.cst_origem ?? '').trim(),
    crt:          Number(body.crt),
    cfop_entrada: body.cfop_entrada.trim(),
    cst_entrada:  body.cst_entrada.trim(),
    finalidade:   body.finalidade.trim(),
    tem_icms:     body.tem_icms ?? true,
    descricao:    body.descricao?.trim() || null,
  }

  const { data, error } = await supabaseAdmin
    .from('cfop_cst_conversao')
    .update(payload)
    .eq('id', body.id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505')
      return NextResponse.json(
        { message: 'Já existe uma regra para este CFOP/CST/CRT/Finalidade' },
        { status: 409 }
      )
    return NextResponse.json({ message: error.message }, { status: 500 })
  }

  return NextResponse.json({ regra: data })
}

/** DELETE /api/fiscal/conversao-regras?id=123 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ message: 'id é obrigatório' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('cfop_cst_conversao')
    .delete()
    .eq('id', Number(id))

  if (error) return NextResponse.json({ message: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}