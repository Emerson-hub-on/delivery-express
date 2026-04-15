import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic' // ← garante que a route nunca é estática

export async function GET(req: NextRequest) {
  // ── Instancia aqui dentro para evitar erro no build ──────────
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  )

  // ── 1. Autenticação ──────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── 2. Slug obrigatório ──────────────────────────────────────
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ error: 'Query ?slug= obrigatória' }, { status: 400 })
  }

  // ── 3. Resolve company_id pelo slug ─────────────────────────
  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .single()

  if (companyError || !company) {
    return NextResponse.json(
      { error: `Empresa "${slug}" não encontrada` },
      { status: 404 },
    )
  }

  // ── 4. Chama /api/ifood/poll ─────────────────────────────────
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  try {
    const res = await fetch(`${baseUrl}/api/ifood/poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
      body: JSON.stringify({ companyId: company.id }),
    })

    const data: unknown = await res.json()
    return NextResponse.json({ slug, companyId: company.id, ...(data as object) }, { status: res.status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[iFood Cron]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}