/**
 * services/ifood-mapper.ts
 */

import { Order, OrderAddress } from '@/types/product'

interface IfoodItemOption {
  name:      string
  quantity:  number
  unitPrice?: { value?: number }
}

export interface IfoodItem {
  name:      string
  quantity:  number
  unitPrice?: { value?: number }
  options?:  IfoodItemOption[]
}

export interface IfoodAddress {
  streetName:   string
  streetNumber: string
  complement?:  string
  neighborhood: string
  city:         string
  state:        string
}

export interface IfoodOrder {
  id:         string
  createdAt:  string
  type:       'DELIVERY' | 'TAKEOUT' | 'INDOOR'

  customer: {
    name:   string
    phone:  { number: string } | null
    taxPayerIdentificationNumber?: string
  }

  items:    IfoodItem[]

  /** iFood pode retornar variações diferentes do campo de total */
  total?:    { orderAmount?: number; subTotal?: number; benefits?: number }
  totalPrice?: number
  subTotal?:   number

  payments: {
    name?:    string
    methods?: Array<{ type: string; value: number; changeFor?: number }>
  }

  delivery?: {
    deliveryAddress: IfoodAddress
  }
}

// ── helpers ────────────────────────────────────────────────────────────────────

/** Garante um número seguro; retorna 0 se o valor for null/undefined/NaN */
function safeNumber(value: unknown): number {
  const n = Number(value)
  return isNaN(n) ? 0 : n
}

/**
 * Resolve o total do pedido iFood, que pode vir em estruturas diferentes
 * dependendo do tipo do pedido (delivery, takeout, indoor) e da versão da API.
 */
function resolveTotal(o: IfoodOrder): number {
  // Prioridade: total.orderAmount → total.subTotal → totalPrice → subTotal → soma dos itens
  const fromOrderAmount = o.total?.orderAmount
  const fromSubTotal    = o.total?.subTotal
  const fromTotalPrice  = o.totalPrice
  const fromRootSub     = o.subTotal

  for (const candidate of [fromOrderAmount, fromSubTotal, fromTotalPrice, fromRootSub]) {
    if (candidate != null && !isNaN(Number(candidate)) && Number(candidate) > 0) {
      return Number(candidate)
    }
  }

  // Fallback: soma dos itens
  const itemsTotal = (o.items ?? []).reduce(
    (acc, i) => acc + safeNumber(i.unitPrice?.value) * safeNumber(i.quantity),
    0,
  )

  console.warn('[ifood-mapper] total não encontrado nos campos padrão — usando soma dos itens:', itemsTotal)
  return itemsTotal
}

// ── mapper principal ───────────────────────────────────────────────────────────

export function mapIfoodToOrder(
  o: IfoodOrder,
  companyId: string,
  customerUuid: string | null = null,
): Omit<Order, 'id' | 'code'> & { company_id: string; ifood_id: string; printed: boolean } {

  const items = (o.items ?? []).map(i => ({
    product_id:   0,
    product_name: i.name ?? 'Produto sem nome',
    quantity:     safeNumber(i.quantity) || 1,
    unit_price:   safeNumber(i.unitPrice?.value),
  }))

  const addr = o.delivery?.deliveryAddress
  const address: OrderAddress | null = addr ? {
    street:     addr.streetName,
    number:     addr.streetNumber,
    complement: addr.complement,
    district:   addr.neighborhood,
    city:       addr.city,
    state:      addr.state,
  } : null

  const paymentMethod =
    o.payments?.methods?.[0]?.type ?? o.payments?.name ?? null

  const change =
    o.payments?.methods?.find(m => m.changeFor != null)?.changeFor ?? null

  const rawPhone = o.customer?.phone?.number ?? null
  const customer_phone = rawPhone
    ? rawPhone.replace(/^\+?55/, '').replace(/\D/g, '').slice(0, 11)
    : null

  const rawDoc = o.customer?.taxPayerIdentificationNumber ?? null
  const cpf_cnpj = rawDoc ? rawDoc.replace(/\D/g, '').slice(0, 14) || null : null
  const cpf_cnpj_consumidor =
    cpf_cnpj && (cpf_cnpj.length === 11 || cpf_cnpj.length === 14) ? cpf_cnpj : null

  return {
    company_id:     companyId,
    ifood_id:       o.id,
    created_at:     o.createdAt,
    status:         'pending',
    total:          resolveTotal(o),
    customer:       o.customer?.name ?? 'Cliente iFood',
    customer_phone,
    customer_id:    customerUuid,
    items,
    address,
    delivery_type:  o.type === 'TAKEOUT' ? 'pickup' : 'delivery',
    payment_method: paymentMethod,
    raw:            o as unknown as Record<string, unknown>,
    change,
    cpf_cnpj_consumidor,
    dispatched_at:      null,
    completed_at:       null,
    payment_gateway_id: null,
    delivery_pin:       null,
    motoboy_id:         null,
    nfce_status:        null,
    nfce_numero:        null,
    nfce_serie:         null,
    nfce_chave:         null,
    nfce_danfe_url:     null,
    nfce_motivo:        null,
    nfce_emitido_at:    null,
    nfce_cancelado_at:  null,
    nfce_xml:           null,
    printed:            false,
  }
}