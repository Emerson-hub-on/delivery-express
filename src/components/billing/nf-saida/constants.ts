import type { TipoNota } from './types'

export const TIPOS_NOTA_PADRAO: TipoNota[] = [
  {
    value: 'venda_interna',
    label: 'Venda interna — CFOP 5xxx',
    cfop: '5102',
    natureza_operacao: 'Venda de mercadoria',
    finalidade: 1,
  },
  {
    value: 'venda_externa',
    label: 'Venda externa — CFOP 6xxx',
    cfop: '6102',
    natureza_operacao: 'Venda de mercadoria',
    finalidade: 1,
  },
  {
    value: 'devolucao',
    label: 'Devolução ao fornecedor',
    cfop: '5201',
    natureza_operacao: 'Devolução de compra para industrialização',
    finalidade: 4,
  },
  {
    value: 'transferencia',
    label: 'Transferência de mercadoria',
    cfop: '5152',
    natureza_operacao: 'Transferência de mercadoria adquirida ou recebida de terceiros',
    finalidade: 1,
  },
  {
    value: 'outras_saidas',
    label: 'Outras saídas',
    cfop: '5949',
    natureza_operacao: 'Outra saída de mercadoria ou prestação de serviço não especificado',
    finalidade: 1,
  },
  {
    value: 'nota_anulatoria',
    label: 'Nota anulatória',
    cfop: '5949',
    natureza_operacao: 'Anulação de valor relativo à prestação de serviço',
    finalidade: 2,
  },
]

export const GRUPOS_TIPO_NOTA = [
  { label: 'Vendas',         valores: ['venda_interna', 'venda_externa'] },
  { label: 'Devoluções',     valores: ['devolucao'] },
  { label: 'Transferências', valores: ['transferencia'] },
  { label: 'Outros',         valores: ['outras_saidas', 'nota_anulatoria'] },
]

export const FORMAS_PAGAMENTO = [
  { value: 'boleto',          label: 'Boleto bancário' },
  { value: 'dinheiro',        label: 'Dinheiro' },
  { value: 'cartao_credito',  label: 'Cartão de crédito' },
  { value: 'cartao_debito',   label: 'Cartão de débito' },
  { value: 'pix',             label: 'PIX' },
  { value: 'sem_pagamento',   label: 'Sem pagamento' },
]

export const FINALIDADES = [
  { value: 1, label: '1 – NF-e normal' },
  { value: 2, label: '2 – NF-e complementar' },
  { value: 3, label: '3 – NF-e de ajuste' },
  { value: 4, label: '4 – Devolução / Retorno' },
]

export const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

export const TIPOS_NOTA_REQUEREM_CHAVE_REF = ['devolucao', 'nota_anulatoria']

/** Retorna o CFOP default para o tipo, considerando estado do emitente vs destinatário */
export function cfopParaTipo(tipoValue: string, mesmoEstado: boolean): string {
  const map: Record<string, [string, string]> = {
    venda_interna:  ['5102', '6102'],
    venda_externa:  ['5102', '6102'],
    devolucao:      ['5201', '6201'],
    transferencia:  ['5152', '6152'],
    outras_saidas:  ['5949', '6949'],
    nota_anulatoria:['5949', '6949'],
  }
  const pair = map[tipoValue]
  if (!pair) return '5949'
  return mesmoEstado ? pair[0] : pair[1]
}
