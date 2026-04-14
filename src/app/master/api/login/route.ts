// app/master/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyMasterCredentials, createMasterSession } from '@/lib/master-auth'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  const master = await verifyMasterCredentials(email, password)
  if (!master) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }

  await createMasterSession(master)
  return NextResponse.json({ ok: true })
}