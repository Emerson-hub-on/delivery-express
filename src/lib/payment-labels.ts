// lib/payment-labels.ts
// Mapa canônico de todos os valores que podem aparecer no banco → label legível

const PAYMENT_LABEL_MAP: Record<string, string> = {
  // Valores canônicos (novos pedidos)
  pix:      'Pix',
  credito:  'Cartão de Crédito',
  debito:   'Cartão de Débito',
  dinheiro: 'Dinheiro',

  // Legado — valores antigos que ainda podem existir em pedidos históricos
  'na-entrega':  'Dinheiro (na entrega)',
  'na-retirada': 'Dinheiro (na retirada)',
  online:        'Online',
  card:          'Cartão',
}

export function getPaymentLabel(method: string | null | undefined): string {
  if (!method) return '—'
  return PAYMENT_LABEL_MAP[method] ?? method
}

// Agrupa valores legado com seus equivalentes canônicos para o resumo de fechamento
// Ex: 'na-entrega' e 'dinheiro' aparecem juntos como "Dinheiro"
export function getPaymentGroup(method: string | null | undefined): string {
  if (!method) return 'outro'
  const map: Record<string, string> = {
    pix:           'pix',
    credito:       'credito',
    debito:        'debito',
    dinheiro:      'dinheiro',
    'na-entrega':  'dinheiro',
    'na-retirada': 'dinheiro',
    online:        'pix',
    card:          'credito',
  }
  return map[method] ?? 'outro'
}

// Retorna true se o pagamento ainda não foi efetuado (pagar na entrega/retirada)
export function isPaymentPending(method: string | null | undefined): boolean {
  return method === 'na-entrega' || method === 'na-retirada'
}