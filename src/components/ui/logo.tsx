// logo.tsx corrigido
'use client'
import { useCompanyStore } from '@/stores/company-store'
import { ImageIcon } from 'lucide-react'

export const Logo = () => {
  const company = useCompanyStore(s => s.company)

  if (company?.logoUrl) {
    return (
      <img
        src={company.logoUrl}
        alt="Logo da loja"
        className="w-full h-full object-cover"
      />
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-zinc-400">
      <ImageIcon size={18} />
    </div>
  )
}