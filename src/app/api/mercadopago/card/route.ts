import { NextRequest, NextResponse } from 'next/server'
import { getCompanyMpKeys } from '@/lib/get-company-mp-keys'

export async function POST(req: NextRequest) {
  try {
    const {
      orderId, orderCode, total,
      customerName, customerEmail, customerTaxId,
      token, paymentMethodId, installments, issuerId,
      items,
    } = await req.json()

    const { secretKey } = await getCompanyMpKeys(orderId)

    const body = {
      transaction_amount: total,
      description: `Pedido ${orderCode}`,
      payment_method_id: paymentMethodId,
      installments: installments ?? 1,
      external_reference: String(orderCode ?? orderId),
      ...(issuerId ? { issuer_id: issuerId } : {}),
      token,
      payer: {
        email: customerEmail || 'cliente@loja.com',
        first_name: customerName || 'Cliente',
        ...(customerTaxId
          ? { identification: { type: 'CPF', number: customerTaxId.replace(/\D/g, '') } }
          : {}),
      },
      metadata: { order_id: orderId, order_code: orderCode, items },
    }

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'Authorization':     `Bearer ${secretKey}`,
        'X-Idempotency-Key': `${orderCode}-card`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      const message = data.message ?? data.cause?.[0]?.description ?? 'Erro ao processar cartão'
      return NextResponse.json({ error: message }, { status: response.status })
    }

    return NextResponse.json({
      mercadoPagoId: data.id,
      status:        data.status,
      statusDetail:  data.status_detail,
    })
  } catch (err) {
  const message = err instanceof Error ? err.message : 'Erro interno'
  console.error('Card route error:', err)
  return NextResponse.json({ error: message }, { status: 500 })
} 
}