// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createServerClient } from '@supabase/ssr'

const MASTER_SECRET = new TextEncoder().encode(
  process.env.MASTER_JWT_SECRET ?? 'master-secret-change-me'
)

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── Proteção /master ───────────────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') // arquivos estáticos (.js, .css, .ico etc)
  ) {
    return NextResponse.next()
  }
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

    const res = NextResponse.next()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL(`/${slug}/admin/login`, req.url))
    }

    // Verifica se é admin desta company específica pelo slug
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', user.id)
      .eq('slug', slug)
      .maybeSingle()

    if (!company) {
      const redirectRes = NextResponse.redirect(new URL(`/${slug}/admin/login`, req.url))
      req.cookies.getAll().forEach(cookie => {
        if (cookie.name.includes('sb-')) redirectRes.cookies.delete(cookie.name)
      })
      return redirectRes
    }

    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/master/:path*', '/:slug/admin/:path*'],
}
