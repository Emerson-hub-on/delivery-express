import { supabase } from '@/lib/supabase'

export type PdvSalePayload = {
  companyId:       string
  cashRegisterId:  string
  serie:           string
  operatorId?:     string
  operatorName?:   string
  items: {
    product_id:   number
    product_name: string
    quantity:     number
    unit_price:   number
    discount:     number
    variant_id?:  number | null
    size_value?:  string | null
  }[]
  paymentMethod:   'dinheiro' | 'pix' | 'cartao'
  amountReceived?: number
  changeAmount?:   number
  consumerName?:   string
  consumerCpf?:    string
}

export type PdvSaleResult = {
  orderId:    number
  orderCode:  string
  nfceNumero: number
  serie:      string
}

export type NfceEmissaoTipo = 'normal' | 'contingencia'

export async function createPdvSale(payload: PdvSalePayload): Promise<PdvSaleResult> {
  const { data: seqData, error: seqError } = await supabase.rpc('next_nfce_numero', {
    p_company_id: payload.companyId,
    p_serie:      payload.serie,
  })
  if (seqError) throw new Error(`Sequência NFC-e: ${seqError.message}`)
  const nfceNumero = seqData as number

  const total = payload.items.reduce(
    (s, i) => s + i.unit_price * (1 - i.discount / 100) * i.quantity, 0
  )

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{
      company_id:          payload.companyId,
      order_type:          'pdv',
      status:              'completed',
      total,
      items:               payload.items.map(i => ({ product_id: i.product_id, product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, discount: i.discount })),
      payment_method:      payload.paymentMethod,
      payment_methods:     [{ method: payload.paymentMethod, amount: total }],
      customer:            payload.consumerName   ?? null,
      consumer_name:       payload.consumerName   ?? null,
      cpf_cnpj_consumidor: payload.consumerCpf    ?? null,
      change:              payload.changeAmount    ?? null,
      amount_received:     payload.amountReceived  ?? null,
      cash_register_id:    payload.cashRegisterId,
      operator_id:         payload.operatorId      ?? null,
      operator_name:       payload.operatorName    ?? null,
      nfce_serie:          payload.serie,
      nfce_numero:         nfceNumero,
      nfce_status:         null,
    }])
    .select('id, code')
    .single()
  if (orderError) throw new Error(`Criar pedido: ${orderError.message}`)

  // Itens com variant_id e size_value para rastreamento do estorno
  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(payload.items.map(i => ({
      order_id:     order.id,
      product_id:   i.product_id,
      product_name: i.product_name,
      quantity:     i.quantity,
      unit_price:   i.unit_price,
      discount:     i.discount,
      variant_id:   i.variant_id  ?? null,
      size_value:   i.size_value  ?? null,
    })))
  if (itemsError) throw new Error(`Itens: ${itemsError.message}`)

  // Baixa de estoque com validação — o RAISE EXCEPTION vira mensagem amigável
  const { error: stockError } = await supabase.rpc('baixar_estoque_pdv', {
    p_items: payload.items.map(i => ({
      product_id: i.product_id,
      variant_id: i.variant_id ?? null,
      size_value: i.size_value ?? null,
      quantity:   i.quantity,
    })),
  })
  if (stockError) throw new Error(stockError.message)

  return { orderId: order.id, orderCode: order.code, nfceNumero, serie: payload.serie }
}

// Cancela venda PDV: estorna estoque + marca pedido como cancelado
export async function cancelarVendaPdv(orderId: number): Promise<void> {
  const { error: stockError } = await supabase.rpc('estornar_estoque_venda', { p_order_id: orderId })
  if (stockError) throw new Error(`Estorno de estoque: ${stockError.message}`)

  const { error: orderError } = await supabase
    .from('orders')
    .update({ status: 'cancelled', cupom_cancelado: true })
    .eq('id', orderId)
  if (orderError) throw new Error(`Cancelar pedido: ${orderError.message}`)
}

export async function saveNfceXml(companyId: string, serie: string, numero: number, xml: string): Promise<string> {
  const path = `${companyId}/${serie}-${String(numero).padStart(9, '0')}.xml`
  const blob = new Blob([xml], { type: 'application/xml' })
  const { error } = await supabase.storage.from('nfce-xml').upload(path, blob, { upsert: true, contentType: 'application/xml' })
  if (error) throw new Error(`Storage XML: ${error.message}`)
  const { data } = supabase.storage.from('nfce-xml').getPublicUrl(path)
  return data.publicUrl
}

export async function finalizarNfce(orderId: number, tipo: NfceEmissaoTipo, xmlUrl: string) {
  const { error } = await supabase
    .from('orders')
    .update({
      nfce_status:     tipo === 'normal' ? 'emitido' : 'pendente',
      nfce_xml:        xmlUrl,
      nfce_emitido_at: new Date().toISOString(),
      nfce_ambiente:   tipo === 'contingencia' ? 2 : 1,
    })
    .eq('id', orderId)
  if (error) throw new Error(`Finalizar NFC-e: ${error.message}`)
}