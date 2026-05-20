// services/pdv.ts
import { supabase } from '@/lib/supabase'

export type PdvSalePayload = {
  companyId:       string
  cashRegisterId:  string
  serie:           string        // vem do cash_register
  operatorId?:     string
  operatorName?:   string
  items: {
    product_id:   number
    product_name: string
    quantity:     number
    unit_price:   number
    discount:     number         // percentual
  }[]
  paymentMethod:  'dinheiro' | 'pix' | 'cartao'
  amountReceived?: number        // só dinheiro
  changeAmount?:   number
  consumerName?:   string
  consumerCpf?:    string        // somente dígitos
}

export type PdvSaleResult = {
  orderId:    number
  orderCode:  string
  nfceNumero: number
  serie:      string
}

export async function createPdvSale(payload: PdvSalePayload): Promise<PdvSaleResult> {
  // ── 1. Próximo número NFC-e da série ──────────────────────
  const { data: seqData, error: seqError } = await supabase
    .rpc('next_nfce_numero', {
      p_company_id: payload.companyId,
      p_serie:      payload.serie,
    })

  if (seqError) throw new Error(`Sequência NFC-e: ${seqError.message}`)
  const nfceNumero = seqData as number

  // ── 2. Monta itens (jsonb + normalizado) ──────────────────
  const itemsJson = payload.items.map(i => ({
    product_id:   i.product_id,
    product_name: i.product_name,
    quantity:     i.quantity,
    unit_price:   i.unit_price,
  }))

  const total = payload.items.reduce(
    (s, i) => s + i.unit_price * (1 - i.discount / 100) * i.quantity, 0
  )

  // ── 3. Cria o pedido em orders ────────────────────────────
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{
      company_id:           payload.companyId,
      order_type:           'pdv',
      status:               'completed',
      total,
      items:                itemsJson,          // jsonb legado
      payment_method:       payload.paymentMethod,
      payment_status:       'paid',
      customer:             payload.consumerName ?? null,
      cpf_cnpj_consumidor:  payload.consumerCpf  ?? null,
      change:               payload.changeAmount  ?? null,
      nfce_serie:           payload.serie,
      nfce_numero:          nfceNumero,
      nfce_status:          'pendente',          // emissão assíncrona
    }])
    .select('id, code')
    .single()

  if (orderError) throw new Error(`Criar pedido: ${orderError.message}`)

  // ── 4. Insere itens normalizados em order_items ───────────
  const orderItemsRows = payload.items.map(i => ({
    order_id:     order.id,
    product_id:   i.product_id,
    product_name: i.product_name,
    quantity:     i.quantity,
    unit_price:   i.unit_price,
    discount:     i.discount,
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsRows)

  if (itemsError) throw new Error(`Itens: ${itemsError.message}`)

  // ── 5. Satélite PDV ───────────────────────────────────────
  const { error: pdvError } = await supabase
    .from('order_pdv')
    .insert([{
      order_id:         order.id,
      cash_register_id: payload.cashRegisterId,
      operator_id:      payload.operatorId   ?? null,
      operator_name:    payload.operatorName ?? null,
      payment_methods:  [{ method: payload.paymentMethod, amount: total }],
      amount_received:  payload.amountReceived ?? null,
      change_amount:    payload.changeAmount   ?? null,
      consumer_name:    payload.consumerName   ?? null,
      consumer_cpf:     payload.consumerCpf?.replace(/\D/g, '') ?? null,
    }])

  if (pdvError) throw new Error(`Satélite PDV: ${pdvError.message}`)

  return {
    orderId:    order.id,
    orderCode:  order.code,
    nfceNumero,
    serie:      payload.serie,
  }
}