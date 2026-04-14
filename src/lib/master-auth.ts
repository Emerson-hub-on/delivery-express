// lib/master-auth.ts
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { SignJWT, jwtVerify } from 'jose'

// Client com service_role — só usar no servidor!
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SECRET = new TextEncoder().encode(
  process.env.MASTER_JWT_SECRET ?? 'master-secret-change-me'
)
const COOKIE = 'master_session'

export async function verifyMasterCredentials(email: string, password: string) {
  const { data, error } = await supabaseAdmin
    .rpc('check_master_password', { p_email: email, p_password: password })

  if (error || !data) return null
  return data as { id: string; email: string; name: string }
}

export async function createMasterSession(master: { id: string; email: string }) {
  const token = await new SignJWT({ sub: master.id, email: master.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/master',
  })
}

export async function getMasterSession() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, SECRET)
    return payload as { sub: string; email: string }
  } catch {
    return null
  }
}

export async function destroyMasterSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE)
}