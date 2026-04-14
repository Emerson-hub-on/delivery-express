import { CategoryItem } from '@/types/product'
import { supabase } from '@/lib/supabase'

async function getCompanyId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data: company, error } = await supabase
    .from('companies')
    .select('id, email')
    .eq('email', user.email)
    .maybeSingle()
  if (error || !company) throw new Error('Empresa não encontrada')
  return company.id
}

export const getAllCategories = async (): Promise<CategoryItem[]> => {
  const company_id = await getCompanyId()
  if (!company_id) return []
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', company_id)
    .order('sort_order', { ascending: true })  // ← era .order('label')
  if (error) throw new Error(error.message)
  return data as CategoryItem[]
}

export const createCategory = async (
  category: Omit<CategoryItem, 'id'>
): Promise<CategoryItem> => {
  const company_id = await getCompanyId()
  const { data, error } = await supabase
    .from('categories')
    .insert({ ...category, company_id })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CategoryItem
}

export const updateCategory = async (
  id: number,
  category: Partial<Omit<CategoryItem, 'id'>>
): Promise<CategoryItem> => {
  const { data, error } = await supabase
    .from('categories')
    .update(category)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CategoryItem
}
export const updateCategoriesOrder = async (orderedIds: number[]): Promise<void> => {
  const updates = orderedIds.map((id, index) =>
    supabase.from('categories').update({ sort_order: index }).eq('id', id)
  )
  await Promise.all(updates)
}

export const deleteCategory = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export const archiveCategory = async (id: number): Promise<CategoryItem> => {
  const { data, error } = await supabase
    .from('categories')
    .update({ active: false })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CategoryItem
}

export const getCategoriesByCompany = async (companyId: string) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })  // ← adicionar
  if (error) throw new Error(error.message)
  return data as CategoryItem[]
}
