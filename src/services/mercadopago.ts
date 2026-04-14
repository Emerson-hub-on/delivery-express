export interface PixPaymentResult {
  pixCode:       string
  qrCodeImage:   string | null
  mercadoPagoId: string
  expiresAt:     string
}

export async function createPixPayment(params: {
  orderId:        number
  orderCode:      string
  total:          number
  customerName:   string
  customerEmail?: string
  customerTaxId?: string
  items: { product_name: string; quantity: number; unit_price: number }[]
}): Promise<PixPaymentResult> {
  const res = await fetch('/api/mercadopago/pix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar Pix')
  return data
}

export interface CardPaymentResult {
  mercadoPagoId: string
  status: 'approved' | 'in_process' | 'rejected'
  statusDetail: string
}

export async function createCardPayment(params: {
  orderId: number
  orderCode: string
  total: number
  customerName: string
  customerEmail?: string
  customerTaxId: string
  token: string
  paymentMethodId: string
  installments: number
  issuerId?: string
  items: { product_name: string; quantity: number; unit_price: number }[]
}): Promise<CardPaymentResult> {
  const res = await fetch('/api/mercadopago/card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erro ao processar cartão')
  return data
}