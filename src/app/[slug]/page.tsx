import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import CardapioPage from './CardapioPage'

export const revalidate = 0

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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (!company) notFound()

  const { data: profile } = await supabase
    .from('company_profiles')
    .select('banner_url, logo_url, min_order, is_open, description')
    .eq('company_id', company.id)
    .maybeSingle()

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