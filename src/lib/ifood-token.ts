/**
 * lib/ifood-token.ts
 *
 * Gerencia o token OAuth2 do iFood (Client Credentials).
 * Armazena o token em memória (cache de processo) e renova automaticamente
 * quando estiver a menos de 60 s do vencimento.
 *
 * Variáveis de ambiente necessárias (.env.local):
 *   IFOOD_CLIENT_ID=...
 *   IFOOD_CLIENT_SECRET=...
 *   IFOOD_MERCHANT_ID=...   ← ID do restaurante no painel iFood
 */

const IFOOD_AUTH_URL = 'https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token'

interface TokenCache {
  access_token: string
  expires_at: number   // timestamp em ms
}

// Cache simples em memória (sobrevive ao processo — não a deploys)
let cache: TokenCache | null = null

export async function getIfoodToken(): Promise<string> {
  const now = Date.now()

  // Retorna o token cacheado se ainda válido (margem de 60 s)
  if (cache && cache.expires_at - now > 60_000) {
    return cache.access_token
  }

  const clientId     = process.env.IFOOD_CLIENT_ID
  const clientSecret = process.env.IFOOD_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('IFOOD_CLIENT_ID ou IFOOD_CLIENT_SECRET não configurados')
  }

  const body = new URLSearchParams({
    grantType:    'client_credentials',
    clientId,
    clientSecret,
  })

  const res = await fetch(IFOOD_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`iFood auth falhou (${res.status}): ${text}`)
  }

  const json = await res.json() as { accessToken: string; expiresIn: number }

  cache = {
    access_token: json.accessToken,
    expires_at:   now + json.expiresIn * 1000,
  }

  console.log('[iFood] Token renovado. Expira em', json.expiresIn, 's')
  return cache.access_token
}