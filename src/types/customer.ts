export interface CustomerAddress {
  cep:         string
  street:      string   // → logradouro
  number:      string   // → numero
  complement?: string   // → complemento
  district:    string   // → bairro
  city:        string   // → municipio
  state:       string
}

export type PessoaTipo = 'fisica' | 'juridica'

export interface Customer {
  id:              string
  code:            number        // ← adicionar
  name:            string
  email:           string
  phone:           string | null
  cpf:             string | null
  cnpj:            string | null
  razao_social:    string | null
  ie:              string | null
  pessoa_tipo:     PessoaTipo
  company_id:      string | null
  is_guest:        boolean
  created_at:      string

  // Endereço direto (espelhando o banco)
  logradouro:      string | null
  numero:          string | null
  complemento:     string | null
  bairro:          string | null
  municipio:       string | null
  uf:              string | null
  cep:             string | null
  codigo_municipio: string | null  // obrigatório na NFC-e quando endereço presente

  // Campos fiscais
  ind_ie_dest:     0 | 1 | 2 | 9 | null  // era smallint genérico no type
  contribuinte:    string | null
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