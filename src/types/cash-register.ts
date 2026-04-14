// types/cash-register.ts

export type CashRegisterStatus = 'open' | 'closed' | 'draft'

export type Operator = {
  id: string
  company_id: string
  name: string
  pin?: string
  active: boolean
  created_at: string
}

export type CashRegister = {
  id: string
  company_id: string
  status: CashRegisterStatus
  operator_id?: string
  operator_name: string
  opening_amount: number
  opening_notes?: string
  opening_at: string
  closing_operator_id?: string
  closing_operator_name?: string
  closing_amount?: number
  closing_notes?: string
  closing_at?: string
  total_sales?: number
  total_cancelled?: number
  checklist?: string[]
  created_at: string
}
