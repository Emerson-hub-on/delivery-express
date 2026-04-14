import { supabase } from '@/lib/supabase'
import { Motoboy } from '@/types/motoboy'

async function getCompanyId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user.id
}

export const getAllMotoboys = async (): Promise<Motoboy[]> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('motoboys')
    .select('*')
    .eq('company_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Motoboy[]
}

export const createMotoboy = async (
  motoboy: Omit<Motoboy, 'id' | 'created_at'> & { password: string }
): Promise<Motoboy> => {
  const company_id = await getCompanyId()

  const { data, error } = await supabase
    .from('motoboys')
    .insert([{ ...motoboy, company_id }])
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Motoboy
}

export const updateMotoboy = async (
  id: string,
  fields: Partial<Omit<Motoboy, 'id' | 'created_at'>>
): Promise<Motoboy> => {
  const { data, error } = await supabase
    .from('motoboys')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Motoboy
}

export const deleteMotoboy = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('motoboys')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}
