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
  description?: string  // v1.0
  name?: string         // v2.0
  details?: string
  unitPrice?: number    // v1.0
  unitMinPrice?: number
  imagePath?: string
  logoUrl?: string
  price?: { value: number; originalValue?: number } // v2.0
}

interface IfoodCategory {
  id: string
  name: string
  status: 'AVAILABLE' | 'UNAVAILABLE'
  itemOffers?: IfoodItem[] // v1.0
  items?: IfoodItem[]      // v2.0
}

interface IfoodCatalog {
  categories: IfoodCategory[]
}

// ── Auth iFood ────────────────────────────────────────────────────────────────

async function getIfoodToken(): Promise<string> {
  const params = [
    `grantType=client_credentials`,
    `clientId=${encodeURIComponent(process.env.IFOOD_CLIENT_ID ?? '')}`,
    `clientSecret=${encodeURIComponent(process.env.IFOOD_CLIENT_SECRET ?? '')}`,
  ].join('&')

  const res = await fetch(
    'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`iFood auth: ${res.status} ${text}`)
  }

  const data = await res.json()
  return (data.accessToken ?? data.access_token) as string
}

// ── Busca catálogo ────────────────────────────────────────────────────────────

async function fetchCatalog(token: string, merchantId: string): Promise<IfoodCatalog> {
  // 1. Lista catálogos
  const listRes = await fetch(
    `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!listRes.ok) throw new Error(`iFood catalogs list: ${listRes.status}`)

  const catalogs = await listRes.json()
  console.log('CATALOGS:', JSON.stringify(catalogs))

  const catalog = catalogs[0]
  if (!catalog) throw new Error('Nenhum catálogo encontrado')

  const groupId   = catalog.groupId    // ← para sellableItems
  const catalogId = catalog.catalogId  // ← para categories

  // 2a. Tenta /categories?include_items=true (v2.0)
  const catRes = await fetch(
    `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories?include_items=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  console.log('CATEGORIES STATUS:', catRes.status)

  if (catRes.ok) {
    const categories = await catRes.json()
    console.log('CATEGORIES SAMPLE:', JSON.stringify(categories).slice(0, 400))
    return { categories: Array.isArray(categories) ? categories : categories.categories ?? [] }
  }

  // 2b. Fallback: /sellableItems com groupId (v1.0)
  console.log('Tentando sellableItems com groupId:', groupId)
  const sellRes = await fetch(
    `https://merchant-api.ifood.com.br/catalog/v1.0/merchants/${merchantId}/catalogs/${groupId}/sellableItems`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  console.log('SELLABLE STATUS:', sellRes.status)

  if (!sellRes.ok) throw new Error(`iFood sellableItems: ${sellRes.status}`)

  const items = await sellRes.json()
  console.log('SELLABLE SAMPLE:', JSON.stringify(items).slice(0, 400))

  // Converte formato sellableItems → IfoodCatalog
  const categoryMap = new Map<string, IfoodCategory>()
  for (const item of items) {
    const catId = item.categoryId
    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        id: catId,
        name: item.categoryName ?? 'Sem categoria',
        status: 'AVAILABLE',
        itemOffers: [],
      })
    }
    categoryMap.get(catId)!.itemOffers!.push({
      id: item.itemId,
      description: item.itemName,
      details: item.itemDescription,
      unitPrice: item.itemPrice?.value ?? 0,
      imagePath: item.logosUrls?.[0] ?? '',
    })
  }

  return { categories: Array.from(categoryMap.values()) }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log('ENV CHECK:', {
    clientId:   process.env.IFOOD_CLIENT_ID     ? '✅ presente' : '❌ ausente',
    clientSecret: process.env.IFOOD_CLIENT_SECRET ? '✅ presente' : '❌ ausente',
    merchantId: process.env.IFOOD_MERCHANT_ID   ? '✅ presente' : '❌ ausente',
  })

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

    const body = await req.json().catch(() => ({}))
    const merchantId: string = body.merchantId ?? process.env.IFOOD_MERCHANT_ID ?? ''
    if (!merchantId) {
      return NextResponse.json({ error: 'merchantId obrigatório' }, { status: 400 })
    }

    // 1. Busca catálogo no iFood
    const token   = await getIfoodToken()
    const catalog = await fetchCatalog(token, merchantId)

    // 2. Busca ifood_ids já existentes no banco
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

    const results: SyncResult[]            = []
    const toUpsert: Record<string, unknown>[] = []

    for (const cat of catalog.categories) {
      // Compatibilidade v1.0 (itemOffers) e v2.0 (items)
      const offers = cat.itemOffers ?? cat.items ?? []

      for (const item of offers) {
        const name = item.description ?? item.name ?? ''

        if (cat.status === 'UNAVAILABLE') {
          results.push({ ifood_id: item.id, name, action: 'skipped', reason: 'Categoria indisponível no iFood' })
          continue
        }

        // v2.0 retorna price.value, v1.0 retorna unitPrice direto
        const rawPrice = item.price?.value ?? item.unitPrice ?? 0

        if (!rawPrice || rawPrice <= 0) {
          results.push({ ifood_id: item.id, name, action: 'skipped', reason: 'Preço inválido ou zero' })
          continue
        }

        // Divide por 100 se vier em centavos (heurística: > 500)
        const price = rawPrice > 500 ? rawPrice / 100 : rawPrice

        toUpsert.push({
          ifood_id:    item.id,
          company_id:  companyId,
          name,
          description: item.details ?? null,
          image:       item.imagePath ?? item.logoUrl ?? '',
          price,
          category:    cat.name,
          active:      true,
          // Defaults fiscais Simples Nacional
          cfop:        '5102',
          unit_com:    'UN',
          origem:      0,
          icms_csosn:  '400',
          pis_cst:     '07',
          pis_aliq:    0,
          cofins_cst:  '07',
          cofins_aliq: 0,
        })

        results.push({
          ifood_id: item.id,
          name,
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
      total:   results.length,
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