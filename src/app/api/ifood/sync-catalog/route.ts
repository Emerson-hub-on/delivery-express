// app/api/ifood/sync-catalog/route.ts
//
// Sincroniza o catálogo do iFood com a tabela `products` do Supabase.
// - Se o produto já existe (por ifood_id OU por nome similar): atualiza preço, descrição, imagem, ativo.
// - Se não existe: cadastra como novo produto.
//
// POST /api/ifood/sync-catalog
// Body: { merchantId: string }   (opcional se IFOOD_MERCHANT_ID estiver no .env)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

// ── Supabase admin (bypassa RLS para upsert server-side) ────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // service_role — nunca exponha no client
)

// ── iFood API base ───────────────────────────────────────────────────────────
const IFOOD_API = 'https://merchant-api.ifood.com.br'

// ── Tipos do iFood ───────────────────────────────────────────────────────────
interface IfoodTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface IfoodItem {
  id: string
  externalCode?: string
  name: string
  description?: string
  price?: { value: number; originalValue?: number }
  serving?: string
  logoUrl?: string
  available?: boolean
  sequence?: number
}

interface IfoodCategory {
  id: string
  name: string
  externalCode?: string
  items?: IfoodItem[]
}

interface IfoodCatalog {
  id?: string
  catalogGroupId?: string
  status?: string
  channels?: string[]
  menu?: { categories?: IfoodCategory[] }[]
  categories?: IfoodCategory[]
}

// ── Resultado por produto ───────────────────────────────────────────────────
interface SyncResult {
  ifood_id: string
  name: string
  action: 'created' | 'updated' | 'skipped'
  reason?: string
}

// ── 1. Autenticação iFood (client_credentials) ──────────────────────────────
async function getIfoodToken(): Promise<string> {
  const clientId = process.env.IFOOD_CLIENT_ID!
  const clientSecret = process.env.IFOOD_CLIENT_SECRET!

  const basic = Buffer
    .from(`${clientId}:${clientSecret}`)
    .toString('base64')

  const response = await axios.post(
    'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token',
    'grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept-Encoding': 'identity', // 🔥 ESSA LINHA RESOLVE
      },
      transformRequest: [(data) => data],
      decompress: false, // 🔥 IMPORTANTE TAMBÉM
    }
  )

  console.log('[IFOOD AUTH OK]', response.data)
  console.log('[HEADERS SENT]', response.config.headers)

  return response.data.access_token
}
// ── 2. Busca catálogo do merchant ───────────────────────────────────────────
async function getIfoodCatalog(token: string, merchantId: string): Promise<IfoodItem[]> {
  // Busca lista de catálogos do merchant
  const catalogsRes = await fetch(
    `${IFOOD_API}/catalog/v2.0/merchants/${merchantId}/catalogs`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!catalogsRes.ok) {
    const body = await catalogsRes.text()
    throw new Error(`Erro ao buscar catálogos: ${catalogsRes.status} — ${body}`)
  }

  const catalogs: IfoodCatalog[] = await catalogsRes.json()

  if (!catalogs.length) {
    throw new Error('Nenhum catálogo encontrado para este merchant.')
  }

  // Usa o primeiro catálogo ativo (ou o primeiro da lista)
  const catalog = catalogs.find(c => c.status === 'AVAILABLE') ?? catalogs[0]

  // Busca o catálogo completo com itens
  const detailRes = await fetch(
    `${IFOOD_API}/catalog/v2.0/merchants/${merchantId}/catalogs/${catalog.id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!detailRes.ok) {
    const body = await detailRes.text()
    throw new Error(`Erro ao buscar detalhe do catálogo: ${detailRes.status} — ${body}`)
  }

  const detail: IfoodCatalog = await detailRes.json()

  // Extrai todos os itens das categorias
  const items: IfoodItem[] = []
  const menus = detail.menu ?? []

  for (const menu of menus) {
    for (const cat of menu.categories ?? []) {
      for (const item of cat.items ?? []) {
        items.push(item)
      }
    }
  }

  // Fallback: catálogos que retornam `categories` direto
  if (!items.length) {
    for (const cat of detail.categories ?? []) {
      for (const item of cat.items ?? []) {
        items.push(item)
      }
    }
  }

  return items
}

// ── 3. Normaliza nome para comparação (remove acentos, lowercase, espaços) ──
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── 4. Handler principal ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body       = await req.json().catch(() => ({}))
    const merchantId = body.merchantId ?? process.env.IFOOD_MERCHANT_ID

    if (!merchantId) {
      return NextResponse.json(
        { error: 'merchantId não fornecido. Passe no body ou configure IFOOD_MERCHANT_ID no .env' },
        { status: 400 }
      )
    }

    // Identifica a empresa pelo header (token Supabase do usuário logado)
    const authHeader = req.headers.get('authorization') ?? ''
    const jwt        = authHeader.replace('Bearer ', '')

    if (!jwt) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })
    }

    const companyId = user.id

    // 4.1 Autentica no iFood e busca itens
    const token      = await getIfoodToken()
    const ifoodItems = await getIfoodCatalog(token, merchantId)

    if (!ifoodItems.length) {
      return NextResponse.json({ message: 'Nenhum item encontrado no catálogo do iFood.', synced: 0 })
    }

    // 4.2 Busca produtos locais da empresa
    const { data: localProducts, error: localError } = await supabase
      .from('products')
      .select('id, name, ifood_id')
      .eq('company_id', companyId)

    if (localError) throw new Error(localError.message)

    // Índices para lookup rápido
    const byIfoodId  = new Map<string, { id: number; name: string }>()
    const byNormName = new Map<string, { id: number; name: string }>()

    for (const p of localProducts ?? []) {
      if (p.ifood_id) byIfoodId.set(p.ifood_id, p)
      byNormName.set(normalizeName(p.name), p)
    }

    // 4.3 Processa cada item do iFood
    const results: SyncResult[] = []

    for (const item of ifoodItems) {
      const ifoodId   = item.externalCode ?? item.id
      const price     = item.price?.value ?? 0
      const name      = item.name?.trim() ?? ''
      const normName  = normalizeName(name)

      if (!name || price <= 0) {
        results.push({ ifood_id: ifoodId, name, action: 'skipped', reason: 'Nome vazio ou preço inválido' })
        continue
      }

      // Monta payload de atualização
      const patch: Record<string, unknown> = {
        price,
        active:   item.available !== false,
        ifood_id: ifoodId,
      }

      if (item.description)  patch.description = item.description
      if (item.logoUrl)      patch.image        = item.logoUrl

      // Verifica se já existe pelo ifood_id
      const existingById   = byIfoodId.get(ifoodId)
      // Verifica se já existe pelo nome normalizado
      const existingByName = byNormName.get(normName)
      const existing       = existingById ?? existingByName

      if (existing) {
        // ── ATUALIZA ───────────────────────────────────────────
        const { error: updError } = await supabase
          .from('products')
          .update(patch)
          .eq('id', existing.id)

        if (updError) {
          results.push({ ifood_id: ifoodId, name, action: 'skipped', reason: updError.message })
        } else {
          results.push({ ifood_id: ifoodId, name, action: 'updated' })
          // Atualiza índices para evitar duplicatas no mesmo lote
          byIfoodId.set(ifoodId, existing)
          byNormName.set(normName, existing)
        }
      } else {
        // ── CRIA ───────────────────────────────────────────────
        const newProduct = {
          name,
          price,
          active:     item.available !== false,
          ifood_id:   ifoodId,
          description: item.description ?? null,
          image:       item.logoUrl ?? '',
          category:    'iFood',        // categoria padrão — edite depois se quiser
          company_id:  companyId,
          // Defaults fiscais do Simples Nacional
          cfop:        '5102',
          unit_com:    'UN',
          origem:      0,
          icms_csosn:  '400',
          pis_cst:     '07',
          pis_aliq:    0,
          cofins_cst:  '07',
          cofins_aliq: 0,
        }

        const { data: created, error: insError } = await supabase
          .from('products')
          .insert([newProduct])
          .select('id, name')
          .single()

        if (insError) {
          results.push({ ifood_id: ifoodId, name, action: 'skipped', reason: insError.message })
        } else {
          results.push({ ifood_id: ifoodId, name, action: 'created' })
          byIfoodId.set(ifoodId, created)
          byNormName.set(normName, created)
        }
      }
    }

    // 4.4 Resumo
    const created = results.filter(r => r.action === 'created').length
    const updated = results.filter(r => r.action === 'updated').length
    const skipped = results.filter(r => r.action === 'skipped').length

    return NextResponse.json({
      message: `Sincronização concluída: ${created} criados, ${updated} atualizados, ${skipped} ignorados.`,
      summary: { created, updated, skipped, total: results.length },
      results,
    })
  } catch (err: any) {
    console.error('[ifood/sync-catalog]', err)
    return NextResponse.json({ error: err.message ?? 'Erro interno.' }, { status: 500 })
  }
}