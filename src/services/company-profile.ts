import { supabase } from "@/lib/supabase"

export async function uploadBanner(companyId: string, file: File) {
  const ext = file.name.split('.').pop()
  const path = `${companyId}/banner.${ext}`

  const { error } = await supabase.storage
    .from('company-banners')
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data } = supabase.storage
    .from('company-banners')
    .getPublicUrl(path)

  return data.publicUrl
}

export async function uploadLogo(companyId: string, file: File) {
  const ext = file.name.split('.').pop()
  const path = `${companyId}/logo.${ext}`

  const { error } = await supabase.storage
    .from('company-logos')
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data } = supabase.storage
    .from('company-logos')
    .getPublicUrl(path)

  return data.publicUrl
}

export async function saveCompanyProfile(companyId: string, updates: {
  banner_url?: string
  logo_url?: string
  min_order?: number
  is_open?: boolean
  phone?: string
  description?: string
}) {
  const { error } = await supabase
    .from('company_profiles')
    .upsert({ company_id: companyId, ...updates })

  if (error) throw error
}