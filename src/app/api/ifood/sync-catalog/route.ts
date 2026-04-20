// app/api/ifood/sync-catalog/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Placeholder SVG em data URI — usado quando o item não tem imagem no iFood
const PLACEHOLDER_IMAGE =
  'https://placehold.co/400x400/f3f4f6/9ca3af?text=Sem+Foto'

// Monta URL completa da imagem iFood.
// logosUrls pode vir como:
//   - URL completa: "https://static-images.ifood.com.br/image/upload/..."
//   - UUID/path:    "7b1a2c3d-..." ou "image/upload/7b1..."
function resolveIfoodImage(logosUrls: string[] | undefined): string {
  const raw = logosUrls?.[0]
  if (!raw) return PLACEHOLDER_IMAGE

  // Já é URL completa
  if (raw.startsWith('http')) return raw

  // Path relativo → monta URL do CDN do iFood
  const base = 'https://static-images.ifood.com.br/image/upload/t_medium/pratos/'
  return `${base}${raw}`
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SellableItem {
  itemId: string
  itemName: string
  categoryId: string
  categoryName: string
  categoryIndex?: number
  logosUrls?: string[]
  itemPrice?: { value: number; originalValue?: number | null }
  itemDescription?: string
  status?: string
}

interface IfoodCategory {
  id: string
  name: string
  status: 'AVAILABLE' | 'UNAVAILABLE'
  sequence?: number
  items: {
    id: string
    name: string
    details: string | null
    unitPrice: number
    imagePath: string
    status: string
  }[]
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

// ── Fetch sellableItems v1.0 ──────────────────────────────────────────────────

async function fetchSellableItems(
  token: string,
  merchantId: string,
  groupId: string
): Promise<IfoodCategory[] | null> {
  const url = `https://merchant-api.ifood.com.br/catalog/v1.0/merchants/${merchantId}/catalogs/${groupId}/sellableItems`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  console.log('SELLABLE STATUS:', res.status)
  if (!res.ok) return null

  const raw: SellableItem[] = await res.json()
  console.log('SELLABLE COUNT:', raw.length)
  console.log('SELLABLE SAMPLE:', JSON.stringify(raw).slice(0, 800))

  if (!Array.isArray(raw) || raw.length === 0) return null

  const map = new Map<string, IfoodCategory>()

  for (const item of raw) {
    const catId    = item.categoryId   ?? 'sem-categoria'
    const catName  = item.categoryName ?? 'Sem categoria'
    const catIndex = item.categoryIndex ?? 0

    if (!map.has(catId)) {
      map.set(catId, {
        id:       catId,
        name:     catName,
        status:   'AVAILABLE',
        sequence: catIndex,
        items:    [],
      })
    }

    const price = item.itemPrice?.value ?? 0
    // Heurística: iFood às vezes retorna em centavos (>500)
    const resolvedPrice = price > 500 ? price / 100 : price

    map.get(catId)!.items.push({
      id:        item.itemId,
      name:      item.itemName ?? '',
      details:   item.itemDescription ?? null,
      unitPrice: resolvedPrice,
      imagePath: resolveIfoodImage(item.logosUrls),
      status:    item.status ?? 'AVAILABLE',
    })
  }

  return Array.from(map.values())
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
    // ── Auth Supabase ──────────────────────────────────────────
    const authHeader  = req.headers.get('Authorization') ?? ''
    const accessToken = authHeader.replace('Bearer ', '').trim()
    if (!accessToken) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })

    const companyId  = company.id
    const body       = await req.json().catch(() => ({}))
    const merchantId = body.merchantId ?? process.env.IFOOD_MERCHANT_ID ?? ''
    if (!merchantId) return NextResponse.json({ error: 'merchantId obrigatório' }, { status: 400 })

    // ── Catálogo iFood ─────────────────────────────────────────
    const token   = await getIfoodToken()
    const listRes = await fetch(
      `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!listRes.ok) throw new Error(`iFood catalogs list: ${listRes.status}`)
    const catalogs = await listRes.json()
    console.log('CATALOGS:', JSON.stringify(catalogs))

    const groupId = catalogs[0]?.groupId ?? ''
    if (!groupId) throw new Error('groupId não encontrado no catálogo')

    const categories = await fetchSellableItems(token, merchantId, groupId)

    if (!categories || categories.length === 0) {
      return NextResponse.json({
        message: 'Nenhum item encontrado no iFood. Verifique se há produtos ativos no cardápio.',
        summary: { created: 0, updated: 0, skipped: 0, total: 0 },
        results: [],
      })
    }

    // ── ifood_ids já no banco ──────────────────────────────────
    const { data: existing } = await supabase
      .from('products')
      .select('ifood_id')
      .eq('company_id', companyId)
      .not('ifood_id', 'is', null)

    const existingIds = new Set((existing ?? []).map(r => r.ifood_id as string))

    // ── Processa ───────────────────────────────────────────────
    type SyncAction = 'created' | 'updated' | 'skipped'
    interface SyncResult { ifood_id: string; name: string; action: SyncAction; reason?: string }

    const results:  SyncResult[]              = []
    const toUpsert: Record<string, unknown>[] = []

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i]

      if (cat.items.length > 0) {
        await upsertCategory(companyId, cat.name, cat.sequence ?? i)
      }

      for (const item of cat.items) {
        if (!item.name) {
          results.push({ ifood_id: item.id, name: item.id, action: 'skipped', reason: 'Item sem nome' })
          continue
        }
        if (!item.unitPrice || item.unitPrice <= 0) {
          results.push({ ifood_id: item.id, name: item.name, action: 'skipped', reason: 'Preço inválido ou zero' })
          continue
        }

        toUpsert.push({
          ifood_id:    item.id,
          company_id:  companyId,
          name:        item.name,
          description: item.details ?? null,
          image:       item.imagePath,   // URL completa ou placeholder
          price:       item.unitPrice,
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
          name:     item.name,
          action:   existingIds.has(item.id) ? 'updated' : 'created',
        })
      }
    }

    // ── Upsert em lote ─────────────────────────────────────────
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