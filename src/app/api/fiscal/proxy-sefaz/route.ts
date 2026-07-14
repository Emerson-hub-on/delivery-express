// app/api/fiscal/proxy-sefaz/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-proxy-secret')
  
  console.log('[proxy] secret recebido:', JSON.stringify(secret))
  console.log('[proxy] secret esperado:', JSON.stringify(process.env.PROXY_SECRET))
  
  if (secret !== process.env.PROXY_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetUrl = req.headers.get('x-target-url')
  
  // Log temporário
  console.log('[proxy-sefaz] targetUrl:', targetUrl)
  console.log('[proxy-sefaz] secret ok:', !!secret)

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