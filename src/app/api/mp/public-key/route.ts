import { NextRequest, NextResponse } from 'next/server'
import { getCompanyMpKeysBySlug } from '@/lib/get-company-mp-keys-by-slug'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug obrigatório' }, { status: 400 })

  try {
    const { publicKey } = await getCompanyMpKeysBySlug(slug)
    return NextResponse.json({ publicKey })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}