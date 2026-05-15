export interface CustomerAddress {
  cep:          string
  street:       string
  number:       string
  complement?:  string
  district:     string
  city:         string
  state:        string
}

export type PessoaTipo = 'fisica' | 'juridica'

export interface Customer {
  id:           string
  name:         string
  email:        string
  phone:        string | null
  cpf:          string | null
  cnpj:         string | null
  razao_social: string | null
  ie:           string | null
  pessoa_tipo:  PessoaTipo
  address:      CustomerAddress | null
  company_id:   string | null
  is_guest:     boolean
  created_at:   string
}

// ── Regra fiscal por faixa de valor ──────────────────────────────────────────
// < R$500       → sem obrigação
// R$500–R$9999  → apenas CPF ou CNPJ
// ≥ R$10.000    → todos os campos (nome, doc, endereço completo)
export type FiscalRequirement = 'none' | 'cpf_cnpj_only' | 'full'

export function getFiscalRequirement(total: number): FiscalRequirement {
  if (total < 500)    return 'none'
  if (total < 10_000) return 'cpf_cnpj_only'
  return 'full'
}