// app/master/api/logout/route.ts
import { NextResponse } from 'next/server'
import { destroyMasterSession } from '@/lib/master-auth'

export async function POST() {
  await destroyMasterSession()
  return NextResponse.json({ ok: true })
}