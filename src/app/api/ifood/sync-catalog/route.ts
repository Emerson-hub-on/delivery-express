// app/api/ifood/sync-catalog/route.ts
//
// Usa sellableItems v1.0 (com groupId) como estratégia principal,
// pois a API v2.0 retorna items:[] nas categorias e 404 nos items por categoria.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface IfoodItem {
  id: string
  name?: string
  description?: string
  details?: string
  unitPrice?: number
  imagePath?: string
  logoUrl?: string
  price?: { value: number }
  status?: string
}

interface IfoodCategory {
  id: string
  name: string
  status: 'AVAILABLE' | 'UNAVAILABLE'
  sequence?: number
  items: IfoodItem[]
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
  if (!res.ok) throw new Error(`iFood auth: ${res.status} ${await res.text()}`)

  const data = await res.json()
  return (data.accessToken ?? data.access_token) as string
}

// ── Estratégia 1: sellableItems v1.0 (groupId) ───────────────────────────────

async function fetchViaSellableItems(
  token: string,
  merchantId: string,
  groupId: string
): Promise<IfoodCategory[] | null> {
  const url = `https://merchant-api.ifood.com.br/catalog/v1.0/merchants/${merchantId}/catalogs/${groupId}/sellableItems`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  console.log('SELLABLE STATUS:', res.status)

  if (!res.ok) return null

  const raw = await res.json()
  console.log('SELLABLE COUNT:', Array.isArray(raw) ? raw.length : 'não é array')
  console.log('SELLABLE SAMPLE:', JSON.stringify(raw).slice(0, 600))

  if (!Array.isArray(raw) || raw.length === 0) return null

  // Agrupa por categoria
  const map = new Map<string, IfoodCategory>()
  for (const item of raw) {
    const catId   = item.categoryId   ?? 'sem-categoria'
    const catName = item.categoryName ?? 'Sem categoria'

    if (!map.has(catId)) {
      map.set(catId, { id: catId, name: catName, status: 'AVAILABLE', items: [] })
    }

    map.get(catId)!.items.push({
      id:          item.itemId ?? item.id,
      name:        item.itemName ?? item.name ?? item.description ?? '',
      description: item.itemName ?? item.name ?? '',
      details:     item.itemDescription ?? item.details ?? null,
      unitPrice:   item.itemPrice?.value ?? item.unitPrice ?? item.price?.value ?? 0,
      imagePath:   item.logosUrls?.[0] ?? item.imagePath ?? item.logoUrl ?? '',
      status:      item.status ?? 'AVAILABLE',
    })
  }

  return Array.from(map.values())
}

// ── Estratégia 2: catalog v2.0 items direto ───────────────────────────────────

async function fetchViaV2Full(
  token: string,
  merchantId: string,
  catalogId: string
): Promise<IfoodCategory[] | null> {
  const url = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/items`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  console.log('V2 ITEMS STATUS:', res.status)

  if (!res.ok) return null

  const raw = await res.json()
  console.log('V2 ITEMS SAMPLE:', JSON.stringify(raw).slice(0, 600))

  const items: any[] = Array.isArray(raw) ? raw : raw.items ?? []
  if (items.length === 0) return null

  const map = new Map<string, IfoodCategory>()
  for (const item of items) {
    const catId   = item.categoryId   ?? 'sem-categoria'
    const catName = item.categoryName ?? 'Sem categoria'
    if (!map.has(catId)) {
      map.set(catId, { id: catId, name: catName, status: 'AVAILABLE', items: [] })
    }
    map.get(catId)!.items.push({
      id:        item.id,
      name:      item.name ?? item.description ?? '',
      details:   item.details ?? null,
      unitPrice: item.price?.value ?? item.unitPrice ?? 0,
      imagePath: item.imagePath ?? item.logoUrl ?? '',
      status:    item.status ?? 'AVAILABLE',
    })
  }
  return Array.from(map.values())
}

// ── Estratégia 3: merchant menu ───────────────────────────────────────────────

async function fetchViaMerchantMenu(
  token: string,
  merchantId: string
): Promise<IfoodCategory[] | null> {
  const url = `https://merchant-api.ifood.com.br/merchant/v1.0/merchants/${merchantId}/menu`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  console.log('MERCHANT MENU STATUS:', res.status)

  if (!res.ok) return null

  const raw = await res.json()
  console.log('MERCHANT MENU SAMPLE:', JSON.stringify(raw).slice(0, 600))

  const sections: any[] = raw.sections ?? raw.categories ?? raw.menu ?? []
  if (sections.length === 0) return null

  return sections.map((sec: any) => ({
    id:     sec.id ?? sec.categoryId ?? '',
    name:   sec.name ?? sec.categoryName ?? 'Sem categoria',
    status: sec.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',
    items:  (sec.items ?? sec.itemOffers ?? []).map((i: any) => ({
      id:        i.id,
      name:      i.name ?? i.description ?? '',
      details:   i.details ?? null,
      unitPrice: i.price?.value ?? i.unitPrice ?? 0,
      imagePath: i.imagePath ?? i.logoUrl ?? '',
      status:    i.status ?? 'AVAILABLE',
    })),
  }))
}

// ── Garante categoria no Supabase ─────────────────────────────────────────────

async function upsertCategory(companyId: string, name: string, sortOrder: number) {
  const { error } = await supabase
    .from('categories')
    .upsert(
      { name, label: name, company_id: companyId, active: true, sort_order: sortOrder },
      { onConflict: 'name', ignoreDuplicates: true }
    )
  if (error) console.warn(`Aviso categoria "${name}":`, error.message)
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log('ENV CHECK:', {
    clientId:     process.env.IFOOD_CLIENT_ID     ? '✅ presente' : '❌ ausente',
    clientSecret: process.env.IFOOD_CLIENT_SECRET ? '✅ presente' : '❌ ausente',
    merchantId:   process.env.IFOOD_MERCHANT_ID   ? '✅ presente' : '❌ ausente',
  })

  try {
    const authHeader  = req.headers.get('Authorization') ?? ''
    const accessToken = authHeader.replace('Bearer ', '').trim()
    if (!accessToken) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })
    }

    const companyId = company.id
    const body = await req.json().catch(() => ({}))
    const merchantId: string = body.merchantId ?? process.env.IFOOD_MERCHANT_ID ?? ''
    if (!merchantId) return NextResponse.json({ error: 'merchantId obrigatório' }, { status: 400 })

    // 1. Token + info do catálogo
    const token = await getIfoodToken()

    const listRes = await fetch(
      `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!listRes.ok) throw new Error(`iFood catalogs list: ${listRes.status}`)
    const catalogs = await listRes.json()
    console.log('CATALOGS:', JSON.stringify(catalogs))

    const catalog   = catalogs[0]
    const catalogId = catalog?.catalogId ?? ''
    const groupId   = catalog?.groupId   ?? ''

    // 2. Tenta estratégias em ordem até obter itens
    let categories: IfoodCategory[] | null = null

    console.log('--- Tentando sellableItems v1.0 ---')
    categories = await fetchViaSellableItems(token, merchantId, groupId)

    if (!categories || categories.every(c => c.items.length === 0)) {
      console.log('--- Tentando items v2.0 direto no catálogo ---')
      categories = await fetchViaV2Full(token, merchantId, catalogId)
    }

    if (!categories || categories.every(c => c.items.length === 0)) {
      console.log('--- Tentando merchant menu ---')
      categories = await fetchViaMerchantMenu(token, merchantId)
    }

    if (!categories || categories.length === 0) {
      return NextResponse.json({
        message: 'Nenhum item encontrado no iFood. Verifique se há produtos ativos no cardápio.',
        summary: { created: 0, updated: 0, skipped: 0, total: 0 },
        results: [],
      })
    }

    console.log('TOTAL CATEGORIES WITH ITEMS:', categories.filter(c => c.items.length > 0).length)

    // 3. ifood_ids já existentes
    const { data: existing } = await supabase
      .from('products')
      .select('ifood_id')
      .eq('company_id', companyId)
      .not('ifood_id', 'is', null)

    const existingIds = new Set((existing ?? []).map(r => r.ifood_id as string))

    // 4. Processa
    type SyncAction = 'created' | 'updated' | 'skipped'
    interface SyncResult { ifood_id: string; name: string; action: SyncAction; reason?: string }

    const results:  SyncResult[]              = []
    const toUpsert: Record<string, unknown>[] = []

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i]

      if (cat.status === 'AVAILABLE' && cat.items.length > 0) {
        await upsertCategory(companyId, cat.name, cat.sequence ?? i)
      }

      for (const item of cat.items) {
        const name = item.name ?? item.description ?? ''

        if (cat.status === 'UNAVAILABLE') {
          results.push({ ifood_id: item.id, name, action: 'skipped', reason: 'Categoria indisponível' })
          continue
        }
        if (!name) {
          results.push({ ifood_id: item.id, name: item.id, action: 'skipped', reason: 'Item sem nome' })
          continue
        }

        const rawPrice = item.price?.value ?? item.unitPrice ?? 0
        if (!rawPrice || rawPrice <= 0) {
          results.push({ ifood_id: item.id, name, action: 'skipped', reason: 'Preço inválido ou zero' })
          continue
        }

        // Heurística centavos: se > 500 divide por 100
        const price = rawPrice > 500 ? rawPrice / 100 : rawPrice

        toUpsert.push({
          ifood_id:    item.id,
          company_id:  companyId,
          name,
          description: item.details ?? null,
          image:       item.imagePath ?? '',
          price,
          category:    cat.name,
          active:      item.status !== 'UNAVAILABLE',
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

    // 5. Upsert em lote
    if (toUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('products')
        .upsert(toUpsert, { onConflict: 'ifood_id,company_id', ignoreDuplicates: false })
      if (upsertError) throw new Error(`Supabase: ${upsertError.message}`)
    }

    const summary = {
      created: results.filter(r => r.action === 'created').length,
      updated: results.filter(r => r.action === 'updated').length,
      skipped: results.filter(r => r.action === 'skipped').length,
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