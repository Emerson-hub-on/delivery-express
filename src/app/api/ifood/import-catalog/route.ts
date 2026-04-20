// app/api/ifood/import-catalog/route.ts
//
// Importa o cardápio do iFood e salva no Supabase.
// Chame com: POST /api/ifood/import-catalog
// Body (opcional): { merchantId: "xxx" }  — sobrescreve a env IFOOD_MERCHANT_ID

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ── Supabase (service role para bypass RLS) ───────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Tipos iFood ───────────────────────────────────────────────────────────────

interface IfoodCatalogItem {
  id: string
  description: string
  details: string
  unitPrice: number
  unitMinPrice: number
  serving: string
  availabilitySchedules: unknown[]
  shifts: unknown[]
  logoUrl?: string
  imagePath?: string
  needChoices: boolean
  itemTags?: string[]
  externalCode?: string
  productTags?: string[]
}

interface IfoodCategory {
  id: string
  name: string
  sequence: number
  status: 'AVAILABLE' | 'UNAVAILABLE'
  externalCode?: string
  template?: string
  itemOffers: IfoodCatalogItem[]
}

interface IfoodCatalogResponse {
  catalogContext: string
  categories: IfoodCategory[]
}

// ── Autenticação iFood ────────────────────────────────────────────────────────

async function getIfoodToken(): Promise<string> {
  const res = await fetch('https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grantType: 'client_credentials',
      clientId: process.env.IFOOD_CLIENT_ID!,
      clientSecret: process.env.IFOOD_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`iFood auth failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data.accessToken as string
}

// ── Busca cardápio ────────────────────────────────────────────────────────────

async function fetchIfoodCatalog(token: string, merchantId: string): Promise<IfoodCatalogResponse> {
  const res = await fetch(
    `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`iFood catalog failed: ${res.status} ${text}`)
  }

  // A resposta é um array de catálogos; usamos o primeiro (geralmente "IFOOD")
  const catalogs = await res.json()
  const catalogId: string = catalogs[0]?.catalogId

  if (!catalogId) throw new Error('Nenhum catálogo encontrado')

  const detailRes = await fetch(
    `https://merchant-api.ifood.com.br/catalog/v2.0/merchants/${merchantId}/catalogs/${catalogId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!detailRes.ok) {
    const text = await detailRes.text()
    throw new Error(`iFood catalog detail failed: ${detailRes.status} ${text}`)
  }

  return detailRes.json()
}

// ── Mapeamento iFood → linha do Supabase ──────────────────────────────────────

function mapToProduct(
  item: IfoodCatalogItem,
  categoryName: string,
  companyId: string
) {
  // Preço: iFood envia em centavos em alguns planos, em reais em outros.
  // Ajuste a divisão abaixo conforme o retorno da sua conta.
  const price = item.unitPrice > 500 ? item.unitPrice / 100 : item.unitPrice

  return {
    ifood_id: item.id,
    company_id: companyId,
    name: item.description,
    description: item.details || null,
    // Imagem: prefere imagePath (CDN oficial), cai em logoUrl
    image: item.imagePath ?? item.logoUrl ?? '',
    price,
    category: categoryName,
    active: true,
    // Defaults fiscais para Simples Nacional — ajuste se necessário
    cfop: '5102',
    unit_com: 'UN',
    origem: 0,
    icms_csosn: '400',
    pis_cst: '07',
    pis_aliq: 0,
    cofins_cst: '07',
    cofins_aliq: 0,
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Só admins devem chamar esta rota — adicione seu middleware de auth aqui
    // ex: const session = await getServerSession(); if (!session?.user) return 401

    const body = await req.json().catch(() => ({}))
    const merchantId: string = body.merchantId ?? process.env.IFOOD_MERCHANT_ID ?? ''
    const companyId: string = body.companyId ?? process.env.IFOOD_COMPANY_ID ?? ''

    if (!merchantId) return NextResponse.json({ error: 'merchantId obrigatório' }, { status: 400 })
    if (!companyId) return NextResponse.json({ error: 'companyId obrigatório' }, { status: 400 })

    // 1. Autenticar
    const token = await getIfoodToken()

    // 2. Buscar cardápio
    const catalog = await fetchIfoodCatalog(token, merchantId)

    // 3. Montar lista de produtos para upsert
    const products = catalog.categories.flatMap((cat) =>
      cat.itemOffers.map((item) => mapToProduct(item, cat.name, companyId))
    )

    if (products.length === 0) {
      return NextResponse.json({ message: 'Nenhum produto encontrado no cardápio', imported: 0 })
    }

    // 4. Upsert no Supabase — usa ifood_id + company_id como chave única
    //    Crie uma unique constraint: UNIQUE(ifood_id, company_id)
    const { data, error } = await supabase
      .from('products')
      .upsert(products, { onConflict: 'ifood_id,company_id', ignoreDuplicates: false })
      .select('id, name, ifood_id')

    if (error) throw new Error(`Supabase upsert error: ${error.message}`)

    return NextResponse.json({
      message: 'Cardápio importado com sucesso',
      imported: data?.length ?? products.length,
      categories: catalog.categories.map((c) => ({
        name: c.name,
        items: c.itemOffers.length,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[ifood-import]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}