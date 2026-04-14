import { supabase } from '@/lib/supabase'
import { CategoryItem, Product } from '@/types/product'

async function getCompanyId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user.id
}

export const getAllProducts = async (): Promise<Product[]> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export const getProductById = async (id: number): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export const getProductsByCategory = async (category: string): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export const createProduct = async (
  product: Omit<Product, 'id'>
): Promise<Product> => {
  const company_id = await getCompanyId()

  const { data, error } = await supabase
    .from('products')
    .insert([{ ...product, company_id }])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Product
}

export const updateProduct = async (
  id: number,
  product: Partial<Omit<Product, 'id'>>
): Promise<Product> => {
  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Product
}

export const deleteProduct = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Verifica se o produto possui pedidos vinculados.
 * A busca é feita nos itens dos pedidos via operador @> do jsonb do Supabase.
 * Retorna o número de pedidos encontrados.
 */
export const checkProductHasOrders = async (productId: number): Promise<number> => {
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .contains('items', JSON.stringify([{ product_id: productId }]))

  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * Arquiva o produto: marca como inativo em vez de deletar.
 * O produto some do cardápio mas o histórico de pedidos fica intacto.
 */
export const archiveProduct = async (id: number): Promise<Product> => {
  const { data, error } = await supabase
    .from('products')
    .update({ active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Product
}

export const getProductsByCompany = async (companyId: string): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export const getCategoriesByCompany = async (companyId: string): Promise<CategoryItem[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', companyId)
    .order('label')

  if (error) throw new Error(error.message)
  return data as CategoryItem[]
}
