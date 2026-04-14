import { supabase } from '@/lib/supabase'

export async function signUp(
  email: string,
  password: string,
  name: string,
  companyId: string
) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error

  const user = data.user
  if (!user) throw new Error('Usuário não criado.')

  const { error: profileError } = await supabase
    .from('customers')
    .insert({ id: user.id, name, email, company_id: companyId })

  if (profileError) throw profileError

  return user
}

export async function signIn(email: string, password: string, companyId: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  const user = data.user
  if (!user) throw new Error('Usuário não encontrado.')

  // Valida se o cliente pertence à empresa
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, company_id')
    .eq('id', user.id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (customerError) throw customerError

  // Cliente não tem perfil nesta empresa — cria automaticamente
  if (!customer) {
    const { error: insertError } = await supabase
      .from('customers')
      .insert({ id: user.id, email: user.email ?? email, company_id: companyId })

    if (insertError) throw insertError
  }

  return user
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getCustomerProfile(userId: string, companyId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', userId)
    .eq('company_id', companyId)
    .single()
  if (error) throw error
  return data
}

export async function updateCustomerProfile(
  userId: string,
  companyId: string,
  updates: { name?: string; address?: object }
) {
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('id', userId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', userId)
      .eq('company_id', companyId)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('customers')
      .insert({
        id: userId,
        company_id: companyId,
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

export async function ensureCustomerProfile(userId: string, companyId: string, email: string, name?: string) {
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('id', userId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!existing) {
    const { error } = await supabase
      .from('customers')
      .insert({
        id: userId,
        email,
        company_id: companyId,
        ...(name ? { name } : {}),
      })

    if (error) throw error
  }
}