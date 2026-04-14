import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCompanyMpKeys } from '@/lib/get-company-mp-keys'

export async function POST(req: NextRequest) {
  try {
    const { orderId, orderCode, total, customerName, customerEmail, customerTaxId, items } = await req.json()

    const { secretKey } = await getCompanyMpKeys(orderId)
    const idempotencyKey = orderCode ?? `order-${orderId}-${randomUUID()}`

    const body = {
      transaction_amount: total,
      description: `Pedido ${orderCode ?? orderId}`,
      payment_method_id: 'pix',
      payer: {
        email: customerEmail || 'cliente@loja.com',
        first_name: customerName,
        identification: {
          type: 'CPF',
          number: customerTaxId,
        },
      },
      metadata: { order_id: orderId, order_code: orderCode, items },
    }

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'Authorization':     `Bearer ${secretKey}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      const message = data.message ?? data.cause?.[0]?.description ?? 'Erro ao gerar Pix'
      return NextResponse.json({ error: message }, { status: response.status })
    }

    const txData = data.point_of_interaction?.transaction_data
    if (!txData?.qr_code) {
      return NextResponse.json({ error: 'QR Code não gerado' }, { status: 500 })
    }

    return NextResponse.json({
      pixCode:       txData.qr_code,
      qrCodeImage:   txData.qr_code_base64 ? `data:image/png;base64,${txData.qr_code_base64}` : null,
      mercadoPagoId: String(data.id),
      expiresAt:     data.date_of_expiration,
    })
  } catch (err: any) {
    console.error('Pix route error:', err)
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 })
  }
}