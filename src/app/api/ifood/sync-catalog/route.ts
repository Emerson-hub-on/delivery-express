// app/api/ifood/sync-catalog/route.ts
//
// Suporta dois modos:
//   previewOnly: true  → retorna diferenças sem salvar "updated" (apenas cria os "created")
//   previewOnly: false → salva só os IDs passados em applyIds (para "updated")

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x400/f3f4f6/9ca3af?text=Sem+Foto'

function resolveIfoodImage(logosUrls?: string[]): string {
  const raw = logosUrls?.[0]
  if (!raw) return PLACEHOLDER_IMAGE
  if (raw.startsWith('http')) return raw
  return `https://static-images.ifood.com.br/image/upload/t_medium/pratos/${raw}`
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SellableItem {
  itemId:         string
  itemName:       string
  categoryId:     string
  categoryName:   string
  categoryIndex?: number
  logosUrls?:     string[]
  itemPrice?:     { value: number; originalValue?: number | null }
  itemDescription?: string
  status?:        string
}

interface NormalizedItem {
  id:          string
  name:        string
  details:     string | null
  unitPrice:   number
  imagePath:   string
  status:      string
  categoryId:  string
  categoryName: string
  categoryIndex: number
}

type SyncAction = 'created' | 'updated' | 'skipped'

interface SyncResult {
  ifood_id:      string
  name:          string
  action:        SyncAction
  reason?:       string
  ifood_price?:  number
  current_price?: number
  ifood_name?:   string
  current_name?: string
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
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params,
    }
  )
  if (!res.ok) throw new Error(`iFood auth: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return (data.accessToken ?? data.access_token) as string
}

// ── Fetch sellableItems ───────────────────────────────────────────────────────

async function fetchItems(token: string, merchantId: string, groupId: string): Promise<NormalizedItem[]> {
  const url = `https://merchant-api.ifood.com.br/catalog/v1.0/merchants/${merchantId}/catalogs/${groupId}/sellableItems`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  console.log('SELLABLE STATUS:', res.status)
  if (!res.ok) throw new Error(`sellableItems: ${res.status}`)

  const raw: SellableItem[] = await res.json()
  console.log('SELLABLE COUNT:', raw.length)

  return raw.map(item => {
    const rawPrice = item.itemPrice?.value ?? 0
    const price    = rawPrice > 500 ? rawPrice / 100 : rawPrice

    return {
      id:            item.itemId,
      name:          item.itemName ?? '',
      details:       item.itemDescription ?? null,
      unitPrice:     price,
      imagePath:     resolveIfoodImage(item.logosUrls),
      status:        item.status ?? 'AVAILABLE',
      categoryId:    item.categoryId   ?? 'sem-categoria',
      categoryName:  item.categoryName ?? 'Sem categoria',
      categoryIndex: item.categoryIndex ?? 0,
    }
  })
}

// ── Garante categoria ─────────────────────────────────────────────────────────

async function upsertCategory(companyId: string, name: string, sortOrder: number) {
  const { error } = await supabase
    .from('categories')
    .upsert(
      { name, label: name, company_id: companyId, active: true, sort_order: sortOrder },
      { onConflict: 'name', ignoreDuplicates: true }
    )
  if (error) console.warn(`Categoria "${name}":`, error.message)
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  console.log('ENV CHECK:', {
    clientId:     process.env.IFOOD_CLIENT_ID     ? '✅' : '❌',
    clientSecret: process.env.IFOOD_CLIENT_SECRET ? '✅' : '❌',
    merchantId:   process.env.IFOOD_MERCHANT_ID   ? '✅' : '❌',
  })

  try {
    // ── Auth ───────────────────────────────────────────────────
    const accessToken = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
    if (!accessToken) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })

    const { data: company } = await supabase
      .from('companies').select('id').eq('user_id', user.id).single()
    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })

    const companyId  = company.id
    const body       = await req.json().catch(() => ({}))
    const merchantId: string = body.merchantId ?? process.env.IFOOD_MERCHANT_ID ?? ''
    if (!merchantId) return NextResponse.json({ error: 'merchantId obrigatório' }, { status: 400 })

    const previewOnly: boolean  = body.previewOnly !== false  // default true
    const applyIds: string[]    = body.applyIds ?? []         // IDs a salvar quando !previewOnly

    // ── Catálogo ───────────────────────────────────────────────
    const token   = await getIfoodToken()
    const listRes = await fetch(
      `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!listRes.ok) throw new Error(`catalogs list: ${listRes.status}`)

    const catalogs = await listRes.json()
    console.log('CATALOGS:', JSON.stringify(catalogs))

    const groupId = catalogs[0]?.groupId ?? ''
    if (!groupId) throw new Error('groupId não encontrado')

    const items = await fetchItems(token, merchantId, groupId)
    if (items.length === 0) {
      return NextResponse.json({
        message: 'Nenhum item encontrado no iFood.',
        summary: { created: 0, updated: 0, skipped: 0, total: 0 },
        results: [],
      })
    }

    // ── Produtos existentes no banco ───────────────────────────
    const { data: existingProducts } = await supabase
      .from('products')
      .select('ifood_id, price, name')
      .eq('company_id', companyId)
      .not('ifood_id', 'is', null)

    const existingMap = new Map(
      (existingProducts ?? []).map(p => [p.ifood_id as string, p as { price: number; name: string }])
    )

    // ── Monta resultados e lotes ───────────────────────────────
    const results:      SyncResult[]              = []
    const toCreate:     Record<string, unknown>[] = []
    const toUpdate:     Record<string, unknown>[] = []
    const categoryDone = new Set<string>()

    for (const item of items) {
      if (!item.name) {
        results.push({ ifood_id: item.id, name: item.id, action: 'skipped', reason: 'Item sem nome' })
        continue
      }
      if (!item.unitPrice || item.unitPrice <= 0) {
        results.push({ ifood_id: item.id, name: item.name, action: 'skipped', reason: 'Preço inválido ou zero' })
        continue
      }

      const existing = existingMap.get(item.id)
      const row = {
        ifood_id:    item.id,
        company_id:  companyId,
        name:        item.name,
        description: item.details ?? null,
        image:       item.imagePath,
        price:       item.unitPrice,
        category:    item.categoryName,
        active:      item.status !== 'UNAVAILABLE',
        cfop:        '5102',
        unit_com:    'UN',
        origem:      0,
        icms_csosn:  '400',
        pis_cst:     '07',
        pis_aliq:    0,
        cofins_cst:  '07',
        cofins_aliq: 0,
      }

      if (!existing) {
        // Novo → sempre cria (não depende de previewOnly)
        toCreate.push(row)
        results.push({
          ifood_id:    item.id,
          name:        item.name,
          action:      'created',
          ifood_price: item.unitPrice,
        })

        // Cadastra categoria se novo
        if (!categoryDone.has(item.categoryId)) {
          await upsertCategory(companyId, item.categoryName, item.categoryIndex)
          categoryDone.add(item.categoryId)
        }
      } else {
        // Já existe → mostra diferença, atualiza só se selecionado
        results.push({
          ifood_id:      item.id,
          name:          item.name,
          action:        'updated',
          ifood_price:   item.unitPrice,
          current_price: existing.price,
          ifood_name:    item.name,
          current_name:  existing.name,
        })

        if (!previewOnly && applyIds.includes(item.id)) {
          toUpdate.push(row)

          if (!categoryDone.has(item.categoryId)) {
            await upsertCategory(companyId, item.categoryName, item.categoryIndex)
            categoryDone.add(item.categoryId)
          }
        }
      }
    }

    // ── Persistência ───────────────────────────────────────────

    // Cria novos sempre
    if (toCreate.length > 0) {
      const { error } = await supabase
        .from('products')
        .upsert(toCreate, { onConflict: 'ifood_id,company_id', ignoreDuplicates: false })
      if (error) throw new Error(`Supabase create: ${error.message}`)
    }

    // Atualiza selecionados (só no modo apply)
    if (!previewOnly && toUpdate.length > 0) {
      const { error } = await supabase
        .from('products')
        .upsert(toUpdate, { onConflict: 'ifood_id,company_id', ignoreDuplicates: false })
      if (error) throw new Error(`Supabase update: ${error.message}`)
    }

    const summary = {
      created: results.filter(r => r.action === 'created').length,
      updated: results.filter(r => r.action === 'updated').length,
      skipped: results.filter(r => r.action === 'skipped').length,
      total:   results.length,
    }

    const modeMsg = previewOnly
      ? `Prévia: ${summary.created} novos criados, ${summary.updated} para revisar, ${summary.skipped} ignorados.`
      : `Atualização concluída: ${toUpdate.length} produto(s) atualizados, ${summary.created} criados.`

    return NextResponse.json({ message: modeMsg, summary, results })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[ifood/sync-catalog]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}