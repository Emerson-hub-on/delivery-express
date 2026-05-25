export type NfSaidaStatus =
  | 'rascunho' | 'pendente' | 'autorizada' | 'cancelada' | 'rejeitada'

export type FormaPagamento =
  | 'boleto' | 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'sem_pagamento'

export interface TipoNotaCustom {
  key: string
  nome: string
  natureza_operacao: string
  cfop_padrao: string
  finalidade: 1 | 2 | 3 | 4
  direcao: 'saida' | 'entrada'
}

export interface TipoNota {
  value: string
  label: string
  cfop: string
  natureza_operacao: string
  finalidade: 1 | 2 | 3 | 4
  isCustom?: boolean
}

export interface ItemNota {
  id: string
  produto_desc: string
  ncm: string
  cfop: string
  cst_csosn: string
  quantidade: number
  valor_unit: number
  valor_total: number
}

export interface DestinatarioForm {
  // ── origem do destinatário ──────────────────────────────────
  /** UUID do registro em customers ou suppliers */
  dest_id?: string
  /** De onde veio o destinatário (para rastreio na nf_saida) */
  dest_origem?: 'cliente' | 'fornecedor'

  // ── dados cadastrais ────────────────────────────────────────
  tipo: 'fisica' | 'juridica'
  nome: string
  cpf: string
  cnpj: string
  ie: string
  /** contribuinte: '1' = contribuinte, '2' = isento, '9' = não contribuinte */
  contribuinte: string
  /** indIEDest gerado automaticamente: 1 | 2 | 9 */
  ind_ie_dest: 1 | 2 | 9
  email: string
  telefone: string

  // ── endereço ────────────────────────────────────────────────
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  codigo_municipio: string
  uf: string
}

export interface NfSaidaForm {
  tipo_nota: string
  natureza_operacao: string
  cfop_padrao: string
  finalidade: 1 | 2 | 3 | 4
  serie: string
  destinatario: DestinatarioForm
  itens: ItemNota[]
  valor_desconto: number
  valor_frete: number
  forma_pagamento: FormaPagamento
  informacoes_adicionais: string
  /** Chave NF-e referenciada (devolução / nota anulatória) */
  chave_ref: string
  /** ID da NF de entrada referenciada (devolução) */
  nf_entrada_id?: string
}

export interface NfSaida {
  id: string
  company_id: string
  chave: string | null
  numero: string
  serie: string
  tipo_nota: string
  finalidade: number
  natureza_operacao: string
  data_emissao: string
  data_saida: string | null
  dest_tipo: string
  dest_origem: 'cliente' | 'fornecedor' | null
  dest_id: string | null
  dest_nome: string
  dest_cpf_cnpj: string | null
  dest_ie: string | null
  dest_ind_ie: number | null
  dest_email: string | null
  dest_telefone: string | null
  dest_logradouro: string | null
  dest_numero: string | null
  dest_complemento: string | null
  dest_bairro: string | null
  dest_municipio: string | null
  dest_codigo_mun: string | null
  dest_uf: string | null
  dest_cep: string | null
  chave_ref: string | null
  nf_entrada_id: string | null
  itens: ItemNota[]
  valor_produtos: number
  valor_desconto: number
  valor_frete: number
  valor_total: number
  informacoes_adicionais: string | null
  forma_pagamento: string | null
  status: NfSaidaStatus
  sefaz_motivo: string | null
  xml_raw: string | null
  danfe_url: string | null
  order_id: number | null
  created_at: string
  updated_at: string
}