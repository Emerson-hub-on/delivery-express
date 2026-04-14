// services/cash-register.ts
import { supabase } from '@/lib/supabase'
import { CashRegister, Operator } from '@/types/cash-register'

async function getCompanyId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user.id
}

// ── Operadores ────────────────────────────────────────────────

export const getOperators = async (): Promise<Operator[]> => {
  const company_id = await getCompanyId()
  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .eq('company_id', company_id)
    .eq('active', true)
    .order('name')
  if (error) throw new Error(error.message)
  return data as Operator[]
}

export const createOperator = async (name: string, pin?: string): Promise<Operator> => {
  const company_id = await getCompanyId()
  const { data, error } = await supabase
    .from('operators')
    .insert({ company_id, name, pin: pin || null, active: true })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Operator
}

export const updateOperator = async (id: string, updates: Partial<Pick<Operator, 'name' | 'pin' | 'active'>>): Promise<Operator> => {
  const { data, error } = await supabase
    .from('operators')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Operator
}

export const deleteOperator = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('operators')
    .update({ active: false })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Caixa ─────────────────────────────────────────────────────

export const getOpenCashRegister = async (): Promise<CashRegister | null> => {
  const company_id = await getCompanyId()
  const { data, error } = await supabase
    .from('cash_registers')
    .select('*')
    .eq('company_id', company_id)
    .eq('status', 'open')
    .order('opening_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as CashRegister | null
}

export const getLastClosedCashRegister = async (): Promise<CashRegister | null> => {
  const company_id = await getCompanyId()
  const { data, error } = await supabase
    .from('cash_registers')
    .select('*')
    .eq('company_id', company_id)
    .eq('status', 'closed')
    .order('closing_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as CashRegister | null
}

export const openCashRegister = async (params: {
  operator_id?: string
  operator_name: string
  opening_amount: number
  opening_notes?: string
  checklist?: string[]
}): Promise<CashRegister> => {
  const company_id = await getCompanyId()
  const { data, error } = await supabase
    .from('cash_registers')
    .insert({
      company_id,
      status: 'open',
      operator_id: params.operator_id ?? null,
      operator_name: params.operator_name,
      opening_amount: params.opening_amount,
      opening_notes: params.opening_notes ?? null,
      checklist: params.checklist ?? [],
      opening_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CashRegister
}

export const closeCashRegister = async (
  id: string,
  params: {
    closing_operator_id?: string
    closing_operator_name: string
    closing_amount: number
    closing_notes?: string
    total_sales: number
    total_cancelled: number
  }
): Promise<CashRegister> => {
  const { data, error } = await supabase
    .from('cash_registers')
    .update({
      status: 'closed',
      closing_operator_id: params.closing_operator_id ?? null,
      closing_operator_name: params.closing_operator_name,
      closing_amount: params.closing_amount,
      closing_notes: params.closing_notes ?? null,
      total_sales: params.total_sales,
      total_cancelled: params.total_cancelled,
      closing_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CashRegister
}

export const saveDraftCashRegister = async (
  id: string,
  params: {
    closing_operator_name?: string
    closing_amount?: number
    closing_notes?: string
  }
): Promise<void> => {
  const { error } = await supabase
    .from('cash_registers')
    .update({ status: 'draft', ...params })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Configurações da empresa ──────────────────────────────────

export const getCompanyOpeningTime = async (): Promise<string> => {
  const company_id = await getCompanyId()
  const { data } = await supabase
    .from('company_profiles')
    .select('opening_time')
    .eq('company_id', company_id)
    .maybeSingle()
  return (data as any)?.opening_time ?? '08:00'
}

export const saveCompanyOpeningTime = async (opening_time: string): Promise<void> => {
  const company_id = await getCompanyId()
  const { error } = await supabase
    .from('company_profiles')
    .upsert({ company_id, opening_time })
  if (error) throw new Error(error.message)
}
