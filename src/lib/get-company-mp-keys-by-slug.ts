import { getSupabaseAdmin } from '@/lib/master-auth'

export async function getCompanyMpKeysBySlug(slug: string): Promise<{
  secretKey: string
  publicKey: string
}> {
  const supabase = getSupabaseAdmin()

  const { data: company, error } = await supabase
    .from('companies')
    .select('mp_secret_key, mp_public_key')
    .eq('slug', slug)
    .single()

  if (error || !company) throw new Error('Empresa não encontrada')
  if (!company.mp_secret_key) throw new Error('Empresa sem chave do Mercado Pago configurada')

  return {
    secretKey: company.mp_secret_key,
    publicKey: company.mp_public_key ?? '',
  }
}