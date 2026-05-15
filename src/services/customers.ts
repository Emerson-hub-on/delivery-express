import { supabase } from '@/lib/supabase'
import { Customer } from '@/types/customer'

export async function getAllCustomers(companyId?: string): Promise<Customer[]> {
  let q = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  if (companyId) q = q.eq('company_id', companyId)

  const { data, error } = await q
  if (error) throw error
  return data as Customer[]
}

async function parseSupabaseError(error: any, cpf?: string | null, cnpj?: string | null): Promise<string> {
  if (error?.code === '23505') {
    if (error.message?.includes('cpf') && cpf) {
      const { data } = await supabase
        .from('customers')
        .select('name')
        .eq('cpf', cpf)
        .single()
      const nome = data?.name ? ` (${data.name})` : ''
      return `CPF já cadastrado${nome}.`
    }
    if (error.message?.includes('cnpj') && cnpj) {
      const { data } = await supabase
        .from('customers')
        .select('name, razao_social')
        .eq('cnpj', cnpj)
        .single()
      const nome = data?.razao_social ?? data?.name
      return `CNPJ já cadastrado${nome ? ` (${nome})` : ''}.`
    }
    return 'Registro duplicado.'
  }
  return error.message ?? 'Erro desconhecido.'
}

export async function createCustomer(
  customer: Omit<Customer, 'id' | 'created_at'>
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert(customer)
    .select()
    .single()
  if (error) throw new Error(await parseSupabaseError(error, customer.cpf, customer.cnpj))
  return data as Customer
}

export async function updateCustomer(
  id: string,
  customer: Partial<Omit<Customer, 'id' | 'created_at'>>
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(customer)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(await parseSupabaseError(error, customer.cpf, customer.cnpj))
  return data as Customer
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
  if (error) throw error
}