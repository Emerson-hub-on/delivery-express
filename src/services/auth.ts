import { supabase } from '@/lib/supabase'

export async function signUp(
  email: string, 
  password: string, 
  name: string,
  companyId: string  // ← novo parâmetro
) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error

  const user = data.user
  if (!user) throw new Error('Usuário não criado.')

  const { error: profileError } = await supabase
    .from('customers')
    .insert({ id: user.id, name, email, company_id: companyId })  // ← salva company_id

  if (profileError) throw profileError

  return user
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getCustomerProfile(userId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export async function updateCustomerProfile(
  userId: string,
  updates: { name?: string; address?: object }
) {
  
  const { data: existing, error: checkError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (existing) {
    // Perfil existe → atualiza
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    // Perfil não existe → cria com os dados disponíveis
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('customers')
      .insert({
        id: userId,
        name: updates.name ?? user?.email ?? 'Cliente',
        email: user?.email ?? '',
        ...updates,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function ensureCustomerProfile(userId: string, companyId: string, email: string) {
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('id', userId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!existing) {
    // Cliente existe em outra empresa — cria perfil para esta também
    await supabase.from('customers').insert({ id: userId, email, company_id: companyId })
  }
}