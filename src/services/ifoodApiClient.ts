const IFOOD_BASE_URL = 'https://merchant-api.ifood.com.br'
const IFOOD_AUTH_URL = `${IFOOD_BASE_URL}/authentication/v1.0/oauth/token`

// ─── Tipos ─────────────────────────────────────────

export interface IFoodItem {
  id: string
  externalCode?: string
  name: string
  description?: string
  price: number
  status: 'AVAILABLE' | 'UNAVAILABLE'
  logoUrl?: string
  imagePath?: string
  categoryId?: string
}

export interface IFoodCategory {
  id: string
  name: string
  sequence: number
  status: 'AVAILABLE' | 'UNAVAILABLE'
  items: IFoodItem[]
}

// ─── Auth ─────────────────────────────────────────

interface TokenResponse {
  access_token: string
  expires_in: number
}

let tokenCache: { token: string; expiresAt: number } | null = null

async function fetchAccessToken(): Promise<string> {
  const clientId = process.env.IFOOD_CLIENT_ID
  const clientSecret = process.env.IFOOD_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET obrigatórios')
  }

  const body = `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`

  console.log('[IFOOD AUTH BODY]', body)

  const res = await fetch(IFOOD_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const text = await res.text()

  console.log('[IFOOD AUTH RESPONSE]', text)

  if (!res.ok) {
    throw new Error(`Auth error ${res.status}: ${text}`)
  }

  const data: TokenResponse = JSON.parse(text)

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }

  return data.access_token
}

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token
  }
  return fetchAccessToken()
}

// ─── HTTP com retry automático ─────────────────────

async function apiFetch<T>(path: string, retry = true): Promise<T> {
  const token = await getToken()

  const res = await fetch(`${IFOOD_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  // 🔥 Se token inválido → tenta renovar UMA vez
  if (res.status === 401 && retry) {
    console.warn('[iFood] Token expirado, renovando...')
    tokenCache = null
    return apiFetch<T>(path, false)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`iFood API ${res.status} em ${path}: ${text}`)
  }

  return res.json()
}

// ─── Merchant ─────────────────────────────────────

async function getMerchants() {
  return apiFetch<{ id: string; name: string }[]>(
    '/merchant/v1.0/merchants'
  )
}

async function resolveMerchantId(merchantId?: string): Promise<string> {
  let mid = merchantId ?? process.env.IFOOD_MERCHANT_ID

  if (!mid) {
    const merchants = await getMerchants()
    if (!merchants.length) throw new Error('Nenhum merchant encontrado')
    mid = merchants[0].id
  }

  return mid
}

// ─── Endpoints corretos ───────────────────────────

async function getCategories(merchantId?: string): Promise<IFoodCategory[]> {
  const mid = await resolveMerchantId(merchantId)

  return apiFetch(
    `/catalog/v1.0/merchants/${mid}/categories`
  )
}

async function getItems(merchantId?: string): Promise<IFoodItem[]> {
  const mid = await resolveMerchantId(merchantId)

  return apiFetch(
    `/catalog/v1.0/merchants/${mid}/items`
  )
}

// ─── Montagem do cardápio ─────────────────────────

async function getFullMenu(merchantId?: string): Promise<IFoodCategory[]> {
  const [categories, items] = await Promise.all([
    getCategories(merchantId),
    getItems(merchantId),
  ])

  const map = new Map<string, IFoodCategory>()

  for (const cat of categories) {
    map.set(cat.id, { ...cat, items: [] })
  }

  for (const item of items) {
    if (item.categoryId && map.has(item.categoryId)) {
      map.get(item.categoryId)!.items.push(item)
    }
  }

  return Array.from(map.values())
}

// ─── Export ───────────────────────────────────────

export const ifoodApi = {
  getMerchants,
  getCategories,
  getItems,
  getFullMenu,
}