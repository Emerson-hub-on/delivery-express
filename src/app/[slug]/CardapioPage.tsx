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
}, [companyId]) // dependências completas

  return (
    <div className="w-full min-h-screen flex flex-col px-4 pb-4"> {/* removido max-w-2xl daqui */}
      <Header slug={slug} companyId={companyId} />
      <div className="flex-1 w-full max-w-2xl mx-auto"> {/* max-w só no conteúdo */}
        <Suspense fallback={<TabsSkeleton />}>
          <ProductSelect companyId={companyId} />
        </Suspense>
      </div>
    </div>
  )
}

export default CardapioPage