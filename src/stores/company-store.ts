// stores/company-store.ts
import { create } from 'zustand'

interface Company {
  id: string
  name: string
  slug: string
  bannerUrl?: string | null
  logoUrl?: string | null
  minOrder?: number
  isOpen?: boolean
}

// stores/company-store.ts
interface CompanyStore {
  companyId: string
  company: Company | null
  searchQuery: string
  setCompanyId: (id: string) => void
  setCompany: (company: Company) => void
  setSearchQuery: (q: string) => void
}

export const useCompanyStore = create<CompanyStore>((set) => ({
  companyId: '',
  company: null,
  searchQuery: '',
  setCompanyId: (id) => set({ companyId: id }),
  setCompany: (company) => set({ company, companyId: company.id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
}))