import { NextRequest, NextResponse } from 'next/server'

const PAGBANK_BASE = process.env.PAGBANK_ENV === 'production'
  ? 'https://api.pagseguro.com'
  : 'https://sandbox.api.pagseguro.com'

export async function POST(req: NextRequest) {
  try {
    const { orderId, orderCode, total, customerName, customerEmail, customerTaxId, items } = await req.json()

    const amountInCents = Math.round(total * 100)

    const expiration = new Date(Date.now() + 30 * 60 * 1000)
    const expirationISO = expiration.toISOString().replace('Z', '-03:00')

    const body = {
      reference_id: orderCode,
      customer: {
        name: customerName,
        email: customerEmail || 'cliente@loja.com',
        tax_id: customerTaxId || '00000000000',
      },
      items: items.map((item: any) => ({
        name: item.product_name,
        quantity: item.quantity,
        unit_amount: Math.round(item.unit_price * 100),
      })),
      qr_codes: [
        {
          amount: { value: amountInCents },
          expiration_date: expirationISO,
        },
      ],
    }

    // ── Logs para homologação ─────────────────────────────────────────────
    console.log('=== PagBank Request ===')
    console.log('URL:', `${PAGBANK_BASE}/orders`)
    console.log('Body:', JSON.stringify(body, null, 2))
    // ─────────────────────────────────────────────────────────────────────

    const response = await fetch(`${PAGBANK_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PAGBANK_TOKEN}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    // ── Logs para homologação ─────────────────────────────────────────────
    console.log('=== PagBank Response ===')
    console.log('Status:', response.status)
    console.log('Body:', JSON.stringify(data, null, 2))
    // ─────────────────────────────────────────────────────────────────────

    if (!response.ok) {
      console.error('PagBank error:', data)
      return NextResponse.json(
        { error: data.error_messages?.[0]?.description ?? 'Erro ao gerar Pix' },
        { status: response.status }
      )
    }

    const qr = data.qr_codes?.[0]
    if (!qr) {
      return NextResponse.json({ error: 'QR Code não gerado' }, { status: 500 })
    }

    const imageLink = qr.links?.find((l: any) => l.media === 'image/png')?.href ?? null

    return NextResponse.json({
      pixCode: qr.text,
      qrCodeImage: imageLink,
      pagbankOrderId: data.id,
      expiresAt: expirationISO,
    })
  } catch (err: any) {
    console.error('Pix route error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}