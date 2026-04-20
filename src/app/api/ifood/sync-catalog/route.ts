// app/api/ifood/sync-catalog/route.ts
//
// Versão detalhada do import: retorna created / updated / skipped por item.
// Esperado pelo componente IfoodSync.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Tipos iFood ───────────────────────────────────────────────────────────────

interface IfoodItem {
  id: string
  description: string
  details?: string
  unitPrice: number
  unitMinPrice?: number
  imagePath?: string
  logoUrl?: string
}

interface IfoodCategory {
  id: string
  name: string
  status: 'AVAILABLE' | 'UNAVAILABLE'
  itemOffers: IfoodItem[]
}

interface IfoodCatalog {
  categories: IfoodCategory[]
}

// ── Auth iFood ────────────────────────────────────────────────────────────────

async function getIfoodToken(): Promise<string> {
  const res = await fetch(
    'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grantType: 'client_credentials',
        clientId: process.env.IFOOD_CLIENT_ID!,
        clientSecret: process.env.IFOOD_CLIENT_SECRET!,
      }),
    }
  )
  if (!res.ok) throw new Error(`iFood auth: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.accessToken as string
}

// ── Busca catálogo ────────────────────────────────────────────────────────────

async function fetchCatalog(token: string, merchantId: string): Promise<IfoodCatalog> {
  // 1. Lista catálogos do merchant
  const listRes = await fetch(
    `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!listRes.ok) throw new Error(`iFood catalogs list: ${listRes.status}`)

const catalogs = await listRes.json()

console.log('CATALOG RESPONSE:', catalogs)

if (!Array.isArray(catalogs) && !catalogs.catalogs) {
  throw new Error(`Resposta inválida do iFood: ${JSON.stringify(catalogs)}`)
}

const catalogId =
  catalogs[0]?.catalogId ||
  catalogs.catalogs?.[0]?.id ||
  catalogs.catalogs?.[0]?.catalogId

if (!catalogId) {
  throw new Error('Nenhum catálogo encontrado no iFood')
}
  // 2. Detalhe do catálogo
  const detailRes = await fetch(
    `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!detailRes.ok) throw new Error(`iFood catalog detail: ${detailRes.status}`)

  return detailRes.json()
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Auth: valida Bearer token do Supabase
    const authHeader = req.headers.get('Authorization') ?? ''
    const accessToken = authHeader.replace('Bearer ', '').trim()
    if (!accessToken) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
    }

    // Busca company_id do usuário logado
// ✅ CORRETO (baseado no seu banco)
const { data: company, error: companyError } = await supabase
  .from('companies')
  .select('id')
  .eq('user_id', user.id)
  .single()

if (companyError || !company) {
  return NextResponse.json(
    { error: 'Empresa não encontrada para este usuário' },
    { status: 400 }
  )
}

const companyId = company.id
    if (!companyId) {
      return NextResponse.json({ error: 'company_id não encontrado para este usuário' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const merchantId: string = body.merchantId ?? process.env.IFOOD_MERCHANT_ID ?? ''
    if (!merchantId) {
      return NextResponse.json({ error: 'merchantId obrigatório' }, { status: 400 })
    }

    // 1. Busca catálogo no iFood
    const token = await getIfoodToken()
    const catalog = await fetchCatalog(token, merchantId)

    // 2. Busca ifood_ids já existentes no banco (para diferenciar created vs updated)
    const { data: existing } = await supabase
      .from('products')
      .select('ifood_id')
      .eq('company_id', companyId)
      .not('ifood_id', 'is', null)

    const existingIds = new Set((existing ?? []).map((r) => r.ifood_id as string))

    // 3. Monta lista e classifica cada item
    type SyncAction = 'created' | 'updated' | 'skipped'

    interface SyncResult {
      ifood_id: string
      name: string
      action: SyncAction
      reason?: string
    }

    const results: SyncResult[] = []
    const toUpsert: Record<string, unknown>[] = []

    for (const cat of catalog.categories) {
      for (const item of cat.itemOffers) {
        // Ignora categorias/itens indisponíveis
        if (cat.status === 'UNAVAILABLE') {
          results.push({ ifood_id: item.id, name: item.description, action: 'skipped', reason: 'Categoria indisponível no iFood' })
          continue
        }

        if (!item.unitPrice || item.unitPrice <= 0) {
          results.push({ ifood_id: item.id, name: item.description, action: 'skipped', reason: 'Preço inválido ou zero' })
          continue
        }

        // Preço: divide por 100 se vier em centavos (> 500 é heurística, ajuste se necessário)
        const price = item.unitPrice > 500 ? item.unitPrice / 100 : item.unitPrice

        toUpsert.push({
          ifood_id: item.id,
          company_id: companyId,
          name: item.description,
          description: item.details ?? null,
          image: item.imagePath ?? item.logoUrl ?? '',
          price,
          category: cat.name,
          active: true,
          // Defaults fiscais Simples Nacional
          cfop: '5102',
          unit_com: 'UN',
          origem: 0,
          icms_csosn: '400',
          pis_cst: '07',
          pis_aliq: 0,
          cofins_cst: '07',
          cofins_aliq: 0,
        })

        results.push({
          ifood_id: item.id,
          name: item.description,
          action: existingIds.has(item.id) ? 'updated' : 'created',
        })
      }
    }

    // 4. Upsert em lote
    if (toUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('products')
        .upsert(toUpsert, { onConflict: 'ifood_id,company_id', ignoreDuplicates: false })

      if (upsertError) throw new Error(`Supabase: ${upsertError.message}`)
    }

    // 5. Resumo
    const summary = {
      created: results.filter((r) => r.action === 'created').length,
      updated: results.filter((r) => r.action === 'updated').length,
      skipped: results.filter((r) => r.action === 'skipped').length,
      total: results.length,
    }

    return NextResponse.json({
      message: `Sincronização concluída: ${summary.created} criados, ${summary.updated} atualizados, ${summary.skipped} ignorados.`,
      summary,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[ifood/sync-catalog]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}