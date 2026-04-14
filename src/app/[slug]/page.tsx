// app/[slug]/page.tsx
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CardapioPage from './CardapioPage'

export const revalidate = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type CompanyProfile = {
  banner_url: string | null
  logo_url: string | null
  min_order: number | null
  is_open: boolean | null
  description: string | null
}

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: company } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      slug,
      company_profiles (
        banner_url,
        logo_url,
        min_order,
        is_open,
        description
      )
    `)
    .eq('slug', slug)
    .maybeSingle()

  if (!company) notFound()

  const rawProfile = company.company_profiles as unknown as CompanyProfile[] | CompanyProfile | null
  const profile = Array.isArray(rawProfile) ? rawProfile[0] ?? null : rawProfile

  return (
    <CardapioPage
      companyId={company.id}
      slug={slug}
      companyName={company.name}
      bannerUrl={profile?.banner_url ?? null}
      logoUrl={profile?.logo_url ?? null}
      minOrder={profile?.min_order ?? 0}
      isOpen={profile?.is_open ?? true}
    />
  )
}