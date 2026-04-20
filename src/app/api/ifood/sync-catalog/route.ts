// app/api/ifood/sync-catalog/route.ts
//
// Versão corrigida: busca itens por categoria individualmente (a rota
// /categories?include_items=true retorna items:[] no iFood).
// Também cadastra categorias automaticamente no Supabase se não existirem.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Tipos iFood ───────────────────────────────────────────────────────────────

interface IfoodItem {
  id: string
  description?: string   // v1.0
  name?: string          // v2.0
  details?: string
  unitPrice?: number     // v1.0
  unitMinPrice?: number
  imagePath?: string
  logoUrl?: string
  externalCode?: string
  serving?: string
  price?: { value: number; originalValue?: number }  // v2.0
  productImage?: { files?: { fileName?: string }[] } // v2.0
  status?: string
  sku?: string
}

interface IfoodCategory {
  id: string
  name: string
  status: 'AVAILABLE' | 'UNAVAILABLE'
  sequence?: number
  itemOffers?: IfoodItem[]  // v1.0 sellableItems
  items?: IfoodItem[]       // v2.0 categories (pode vir vazio!)
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

// ── Busca itens de uma categoria ──────────────────────────────────────────────

async function fetchItemsByCategory(
  token: string,
  merchantId: string,
  catalogId: string,
  categoryId: string
): Promise<IfoodItem[]> {
  const url = `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories/${categoryId}/items`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

  console.log(`  CATEGORY ${categoryId} items status: ${res.status}`)
  if (!res.ok) {
    console.warn(`  Falha ao buscar itens da categoria ${categoryId}: ${res.status}`)
    return []
  }

  const data = await res.json()
  // A resposta pode ser um array direto ou { items: [...] }
  return Array.isArray(data) ? data : (data.items ?? data.itemOffers ?? [])
}

// ── Busca catálogo completo ───────────────────────────────────────────────────

async function fetchCatalog(
  token: string,
  merchantId: string
): Promise<{ categories: IfoodCategory[]; catalogId: string }> {
  // 1. Lista catálogos disponíveis
  const listRes = await fetch(
    `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!listRes.ok) throw new Error(`iFood catalogs list: ${listRes.status}`)

  const catalogs = await listRes.json()
  console.log('CATALOGS:', JSON.stringify(catalogs))

  const catalog = catalogs[0]
  if (!catalog) throw new Error('Nenhum catálogo encontrado')

  const catalogId = catalog.catalogId
  const groupId   = catalog.groupId

  // 2. Busca categorias (sem items — iFood retorna items:[] nesta rota)
  const catRes = await fetch(
    `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}/categories`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  console.log('CATEGORIES STATUS:', catRes.status)

  if (catRes.ok) {
    const categories: IfoodCategory[] = await catRes.json().then(d =>
      Array.isArray(d) ? d : d.categories ?? []
    )
    console.log(`CATEGORIES COUNT: ${categories.length}`)

    // 3. Para cada categoria DISPONÍVEL, busca os itens individualmente
    for (const cat of categories) {
      if (cat.status !== 'AVAILABLE') continue
      const items = await fetchItemsByCategory(token, merchantId, catalogId, cat.id)
      cat.items = items
      console.log(`  ${cat.name}: ${items.length} item(s)`)
    }

    return { categories, catalogId }
  }

  // Fallback: sellableItems v1.0
  console.log('Tentando sellableItems com groupId:', groupId)
  const sellRes = await fetch(
    `https://merchant-api.ifood.com.br/catalog/v1.0/merchants/${merchantId}/catalogs/${groupId}/sellableItems`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  console.log('SELLABLE STATUS:', sellRes.status)

  if (!sellRes.ok) throw new Error(`iFood sellableItems: ${sellRes.status}`)

  const sellItems = await sellRes.json()
  console.log('SELLABLE SAMPLE:', JSON.stringify(sellItems).slice(0, 400))

  const categoryMap = new Map<string, IfoodCategory>()
  for (const item of sellItems) {
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

  return { categories: Array.from(categoryMap.values()), catalogId }
}

// ── Garante que categoria existe no Supabase ──────────────────────────────────

async function upsertCategory(
  companyId: string,
  name: string,
  sortOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .upsert(
      {
        name,
        label: name,       // label = name por padrão
        company_id: companyId,
        active: true,
        sort_order: sortOrder,
      },
      { onConflict: 'name', ignoreDuplicates: true }  // não sobrescreve se já existe
    )

  if (error) {
    console.warn(`Aviso ao upsert categoria "${name}":`, error.message)
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log('ENV CHECK:', {
    clientId:     process.env.IFOOD_CLIENT_ID     ? '✅ presente' : '❌ ausente',
    clientSecret: process.env.IFOOD_CLIENT_SECRET ? '✅ presente' : '❌ ausente',
    merchantId:   process.env.IFOOD_MERCHANT_ID   ? '✅ presente' : '❌ ausente',
  })

  try {
    // Auth: valida Bearer token do Supabase
    const authHeader  = req.headers.get('Authorization') ?? ''
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

    // 1. Busca catálogo completo (com itens por categoria)
    const token = await getIfoodToken()
    const { categories } = await fetchCatalog(token, merchantId)

    // 2. Busca ifood_ids já existentes no banco
    const { data: existing } = await supabase
      .from('products')
      .select('ifood_id')
      .eq('company_id', companyId)
      .not('ifood_id', 'is', null)

    const existingIds = new Set((existing ?? []).map((r) => r.ifood_id as string))

    // 3. Processa categorias e itens
    type SyncAction = 'created' | 'updated' | 'skipped'

    interface SyncResult {
      ifood_id: string
      name: string
      action: SyncAction
      reason?: string
    }

    const results: SyncResult[]             = []
    const toUpsert: Record<string, unknown>[] = []

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i]

      // Cadastra categoria no Supabase se não existir
      if (cat.status === 'AVAILABLE') {
        await upsertCategory(companyId, cat.name, cat.sequence ?? i)
      }

      // Compatibilidade v1.0 (itemOffers) e v2.0 (items)
      const offers = cat.items ?? cat.itemOffers ?? []

      for (const item of offers) {
        const name = item.name ?? item.description ?? ''

        if (cat.status === 'UNAVAILABLE') {
          results.push({ ifood_id: item.id, name, action: 'skipped', reason: 'Categoria indisponível no iFood' })
          continue
        }

        if (!name) {
          results.push({ ifood_id: item.id, name: item.id, action: 'skipped', reason: 'Item sem nome' })
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

        // Imagem: v2.0 pode vir em productImage.files ou imagePath/logoUrl
        const image =
          item.productImage?.files?.[0]?.fileName ??
          item.imagePath ??
          item.logoUrl ??
          ''

        toUpsert.push({
          ifood_id:    item.id,
          company_id:  companyId,
          name,
          description: item.details ?? null,
          image,
          price,
          category:    cat.name,
          active:      item.status !== 'UNAVAILABLE',
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