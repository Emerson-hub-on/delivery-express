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

// INSERT para clientes novos (ID gerado pelo banco)
export async function createCustomer(
  customer: Omit<Customer, 'id' | 'created_at'>
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert(customer)
    .select()
    .single()
  if (error) throw error
  return data as Customer
}

// UPDATE para clientes existentes
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
  if (error) throw error
  return data as Customer
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
  if (error) throw error
}