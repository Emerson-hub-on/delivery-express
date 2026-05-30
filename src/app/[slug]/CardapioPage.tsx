'use client'
import { useEffect } from 'react'
import { useCompanyStore } from '@/stores/company-store'
import { ProductSelect } from '@/components/products/select'
import { TabsSkeleton } from '@/components/products/skeleton'
import { Header } from '@/components/ui/header'
import { Suspense } from 'react'
import { Footer } from '@/components/ui/footer'

type Props = {
  companyId: string
  slug: string
  companyName: string
  bannerUrl?: string | null
  logoUrl?: string | null
  minOrder?: number
  isOpen?: boolean
}

const CardapioPage = ({ companyId, slug, companyName, bannerUrl, logoUrl, minOrder, isOpen }: Props) => {
  const setCompany = useCompanyStore(s => s.setCompany)

  useEffect(() => {
    setCompany({ id: companyId, name: companyName, slug, bannerUrl, logoUrl, minOrder, isOpen })
  }, [companyId])

  return (
    <div className="w-full min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <Header slug={slug} companyId={companyId} />

      {/* ── Desktop: two-column layout ── */}
      <div className="hidden md:flex flex-1 w-full max-w-7xl mx-auto px-6 gap-8 py-8">
        {/* Left sidebar — sticky category nav rendered inside ProductSelect */}
        <Suspense fallback={<TabsSkeleton />}>
          <ProductSelect companyId={companyId} layout="desktop" />
        </Suspense>
      </div>

      {/* ── Mobile: single column ── */}
      <div className="md:hidden flex-1 w-full px-4 pb-24">
        <Suspense fallback={<TabsSkeleton />}>
          <ProductSelect companyId={companyId} layout="mobile" />
        </Suspense>
      </div>

      <Footer slug={slug} />
    </div>
  )
}

export default CardapioPage