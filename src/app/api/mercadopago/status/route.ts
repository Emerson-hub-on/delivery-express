import { NextRequest, NextResponse } from 'next/server'
import { getCompanyMpKeys } from '@/lib/get-company-mp-keys'

export async function GET(req: NextRequest) {
  const paymentId = req.nextUrl.searchParams.get('paymentId')
  const orderIdParam = req.nextUrl.searchParams.get('orderId')

  if (!paymentId) return NextResponse.json({ error: 'paymentId obrigatório' }, { status: 400 })
  if (!orderIdParam) return NextResponse.json({ error: 'orderId obrigatório' }, { status: 400 })

  const { secretKey } = await getCompanyMpKeys(Number(orderIdParam))

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })

  const data = await response.json()
  return NextResponse.json({ status: data.status })
}