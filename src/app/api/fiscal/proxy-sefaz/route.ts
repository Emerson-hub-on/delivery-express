// app/api/fiscal/proxy-sefaz/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Valida o secret para evitar uso indevido
  const secret = req.headers.get('x-proxy-secret')
  if (secret !== process.env.PROXY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetUrl = req.headers.get('x-target-url')
  if (!targetUrl) {
    return NextResponse.json({ error: 'x-target-url obrigatório' }, { status: 400 })
  }

  const body        = await req.text()
  const contentType = req.headers.get('content-type') ?? 'application/soap+xml'
  const soapAction  = req.headers.get('soapaction') ?? ''

  try {
    const sefazResp = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'SOAPAction':   soapAction,
      },
      body,
    })

    const respText = await sefazResp.text()
    return new NextResponse(respText, {
      status: sefazResp.status,
      headers: { 'Content-Type': 'application/xml' },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}