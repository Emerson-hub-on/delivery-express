'use client'
import { useEffect } from 'react'
import { useCompanyStore } from '@/stores/company-store'
import { ProductSelect } from '@/components/products/select'
import { TabsSkeleton } from '@/components/products/skeleton'
import { Header } from '@/components/ui/header'
import { Suspense } from 'react'

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
    // ✅ Removido px-4 daqui — o banner no Header agora vai de ponta a ponta
    <div className="w-full min-h-screen flex flex-col">
      <Header slug={slug} companyId={companyId} />
      {/* ✅ px-4 e max-w apenas no conteúdo, não no banner */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 pb-4">
        <Suspense fallback={<TabsSkeleton />}>
          <ProductSelect companyId={companyId} />
        </Suspense>
      </div>
    </div>
  )
}

export default CardapioPage