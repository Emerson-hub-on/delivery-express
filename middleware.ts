import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createServerClient } from '@supabase/ssr'

const MASTER_SECRET = new TextEncoder().encode(
  process.env.MASTER_JWT_SECRET ?? 'master-secret-change-me'
)

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // ── Proteção /master ───────────────────────────────────
  if (pathname.startsWith('/master')) {
    const isPublic =
      pathname === '/master/login' ||
      pathname === '/master/api/login' ||
      pathname === '/master/api/logout'

    if (isPublic) return NextResponse.next()

    const token = req.cookies.get('master_session')?.value
    if (!token) return NextResponse.redirect(new URL('/master/login', req.url))

    try {
      await jwtVerify(token, MASTER_SECRET)
      return NextResponse.next()
    } catch {
      return NextResponse.redirect(new URL('/master/login', req.url))
    }
  }

  // ── Proteção /[slug]/admin ─────────────────────────────
  const slugAdminMatch = pathname.match(/^\/([^/]+)\/admin/)
  if (slugAdminMatch) {
    const slug = slugAdminMatch[1]
    const isPublic = pathname === `/${slug}/admin/login`
    if (isPublic) return NextResponse.next()

    // ← cria o response ANTES e usa ele em tudo (inclusive no redirect)
    let res = NextResponse.next()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookiesToSet) => {
            // ← aplica cookies tanto no request quanto no response
            cookiesToSet.forEach(({ name, value, options }) => {
              req.cookies.set(name, value)
              res.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL(`/${slug}/admin/login`, req.url))
    }

    // ← query corrigida: company.user_id deve bater com user.id
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)   // ← era .eq('id', user.id) — errado
      .eq('slug', slug)
      .maybeSingle()

    if (!company) {
      res = NextResponse.redirect(new URL(`/${slug}/admin/login`, req.url))
      req.cookies.getAll().forEach(cookie => {
        if (cookie.name.includes('sb-')) res.cookies.delete(cookie.name)
      })
      return res
    }

    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/master/:path*', '/:slug/admin/:path*'],
}