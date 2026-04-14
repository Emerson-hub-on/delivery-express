import { NextRequest, NextResponse } from 'next/server'
import { getMasterSession, supabaseAdmin } from '@/lib/master-auth'

export async function GET() {
  const session = await getMasterSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('id, name, email, slug, created_at, mp_public_key, mp_secret_key')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getMasterSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name, email, password, slug } = await req.json()

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: 'Slug inválido. Use apenas letras minúsculas, números e hífens.' },
      { status: 400 }
    )
  }

  const { data: existing } = await supabaseAdmin
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Esse slug já está em uso.' }, { status: 400 })
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, slug, is_company: true },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  await supabaseAdmin
    .from('companies')
    .update({ slug })
    .eq('id', authData.user.id)

  return NextResponse.json({ ok: true, id: authData.user.id, slug })
}

export async function PATCH(req: NextRequest) {
  const session = await getMasterSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, name, email, slug, password, mp_public_key, mp_secret_key } = await req.json()

  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  if (slug && !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Slug inválido.' }, { status: 400 })
  }

  if (slug) {
    const { data: existing } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('slug', slug)
      .neq('id', id)
      .maybeSingle()

    if (existing) return NextResponse.json({ error: 'Slug já em uso.' }, { status: 400 })
  }

  // Monta update da company — inclui mp_public_key e mp_secret_key
  const companyUpdate: Record<string, string | null> = { name, slug }

  // Permite salvar, atualizar ou limpar as keys (null = excluir)
  if (mp_public_key !== undefined) companyUpdate.mp_public_key = mp_public_key || null
  if (mp_secret_key !== undefined) companyUpdate.mp_secret_key = mp_secret_key || null

  const { error: companyError } = await supabaseAdmin
    .from('companies')
    .update(companyUpdate)
    .eq('id', id)

  if (companyError) return NextResponse.json({ error: companyError.message }, { status: 500 })

  const authUpdate: { email?: string; password?: string } = {}
  if (email) authUpdate.email = email
  if (password && password.length >= 6) authUpdate.password = password

  if (Object.keys(authUpdate).length > 0) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdate)
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}