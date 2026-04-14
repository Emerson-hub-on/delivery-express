import { supabaseAdmin } from '@/lib/master-auth'

export async function getCompanyMpKeys(orderId: number): Promise<{
  secretKey: string
  publicKey: string
}> {
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('company_id')
    .eq('id', orderId)
    .single()

  if (orderError || !order) throw new Error('Pedido não encontrado')

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('mp_secret_key, mp_public_key')
    .eq('id', order.company_id)
    .single()

  if (companyError || !company) throw new Error('Empresa não encontrada')
  if (!company.mp_secret_key) throw new Error('Empresa sem chave do Mercado Pago configurada')

  return {
    secretKey: company.mp_secret_key,
    publicKey: company.mp_public_key ?? '',
  }
}