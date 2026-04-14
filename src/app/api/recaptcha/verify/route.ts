import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { token } = await req.json()

  if (!token) {
    return NextResponse.json({ success: false, error: 'Token ausente' }, { status: 400 })
  }

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
  })

  const data = await res.json()

  if (!data.success) {
    return NextResponse.json({ success: false, error: 'reCAPTCHA inválido' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}