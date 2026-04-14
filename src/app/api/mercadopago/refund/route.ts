import { NextRequest, NextResponse } from 'next/server'
import { getCompanyMpKeys } from '@/lib/get-company-mp-keys'

async function attemptRefund(paymentId: string, secretKey: string, attempt = 1): Promise<Response> {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${secretKey}`,
    },
    body: JSON.stringify({}),
  })

  // Se communication_error e ainda temos tentativas, aguarda e tenta de novo
  if (!response.ok && attempt < 3) {
    const data = await response.json()
    const isCommunicationError =
      data.message?.includes('communication_error') ||
      data.cause?.[0]?.code === '5037' ||
      response.status === 408 ||
      response.status === 503

    if (isCommunicationError) {
      await new Promise(resolve => setTimeout(resolve, attempt * 2000)) // 2s, 4s
      return attemptRefund(paymentId, secretKey, attempt + 1)
    }
  }

  return response
}

export async function POST(req: NextRequest) {
  try {
    const { paymentId, orderId } = await req.json()

    if (!paymentId) return NextResponse.json({ error: 'paymentId obrigatório' }, { status: 400 })
    if (!orderId)   return NextResponse.json({ error: 'orderId obrigatório' }, { status: 400 })

    const { secretKey } = await getCompanyMpKeys(orderId)

    const response = await attemptRefund(paymentId, secretKey)
    const data = await response.json()

    if (!response.ok) {
      console.error('Refund error after retries:', data)
      const message = data.message ?? 'Erro ao processar estorno'
      return NextResponse.json({ error: message }, { status: response.status })
    }

    return NextResponse.json({ success: true, refundId: data.id })
  } catch (err: any) {
    console.error('Refund route error:', err)
    return NextResponse.json({ error: err.message ?? 'Erro interno' }, { status: 500 })
  }
}