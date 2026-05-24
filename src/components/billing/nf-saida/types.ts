export type NfSaidaStatus =
  | 'rascunho'
  | 'pendente'
  | 'autorizada'
  | 'cancelada'
  | 'rejeitada'

export type TipoNotaPadrao =
  | 'venda_interna'
  | 'venda_externa'
  | 'devolucao'
  | 'transferencia'
  | 'outras_saidas'
  | 'nota_anulatoria'

export type FormaPagamento =
  | 'boleto'
  | 'dinheiro'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'pix'
  | 'sem_pagamento'

export interface TipoNotaCustom {
  /** chave única local — ex: "custom_1717000000000" */
  key: string
  nome: string
  natureza_operacao: string
  cfop_padrao: string
  finalidade: 1 | 2 | 3 | 4
  direcao: 'saida' | 'entrada'
}

export interface TipoNota {
  value: string          // TipoNotaPadrao | TipoNotaCustom.key
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
  tipo: 'fisica' | 'juridica'
  nome: string
  cpf: string
  cnpj: string
  ie: string
  email: string
  telefone: string
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
  chave_ref: string        // usado em devolução / nota anulatória
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
  status: NfSaidaStatus
  sefaz_motivo: string | null
  xml_raw: string | null
  danfe_url: string | null
  order_id: number | null
  created_at: string
  updated_at: string
}
