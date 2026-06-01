import type { TipoNota } from './types'

export const TIPOS_NOTA_PADRAO: TipoNota[] = [
  // ── Vendas ────────────────────────────────────────────────────────────────
  {
    value:              'venda_mercadoria_interna',
    label:              'Venda de mercadoria',
    cfop:               '5102',
    natureza_operacao:  'Venda de mercadoria adquirida ou recebida de terceiros',
    finalidade:         1,
  },
  {
    value:              'venda_producao_interna',
    label:              'Venda de produção própria',
    cfop:               '5101',
    natureza_operacao:  'Venda de produção do estabelecimento',
    finalidade:         1,
  },
  {
    value:              'venda_combustivel',
    label:              'Venda de combustível / lubrificante',
    cfop:               '5656',
    natureza_operacao:  'Venda de combustível ou lubrificante',
    finalidade:         1,
  },

  // ── Devoluções ────────────────────────────────────────────────────────────
  {
    value:              'devolucao_compra_industrializacao',
    label:              'Devolução de compra p/ industrialização',
    cfop:               '5201',
    natureza_operacao:  'Devolução de compra para industrialização',
    finalidade:         4,
  },
  {
    value:              'devolucao_compra_comercializacao',
    label:              'Devolução de compra p/ comercialização',
    cfop:               '5202',
    natureza_operacao:  'Devolução de compra para comercialização',
    finalidade:         4,
  },
  {
    value:              'devolucao_venda_mercadoria',
    label:              'Devolução de venda de mercadoria',
    cfop:               '1202',
    natureza_operacao:  'Devolução de venda de mercadoria adquirida ou recebida de terceiros',
    finalidade:         4,
  },
  {
    value:              'devolucao_venda_producao',
    label:              'Devolução de venda de produção própria',
    cfop:               '1201',
    natureza_operacao:  'Devolução de venda de produção do estabelecimento',
    finalidade:         4,
  },
  {
    value:              'devolucao_mercadorias_interna',
    label:              'Devolução de mercadorias (interna)',
    cfop:               '5201',
    natureza_operacao:  'Devolução de mercadorias',
    finalidade:         4,
  },

  // ── Transferências ────────────────────────────────────────────────────────
  {
    value:              'transferencia_mercadoria',
    label:              'Transferência de mercadoria',
    cfop:               '5152',
    natureza_operacao:  'Transferência de mercadoria adquirida ou recebida de terceiros',
    finalidade:         1,
  },
  {
    value:              'transferencia_producao',
    label:              'Transferência de produção própria',
    cfop:               '5151',
    natureza_operacao:  'Transferência de produção do estabelecimento',
    finalidade:         1,
  },
  {
    value:              'transferencia_material_uso',
    label:              'Transferência de material de uso e consumo',
    cfop:               '5557',
    natureza_operacao:  'Transferência de material de uso e consumo',
    finalidade:         1,
  },

  // ── Remessas ──────────────────────────────────────────────────────────────
  {
    value:              'remessa_deposito',
    label:              'Remessa p/ depósito / armazém geral',
    cfop:               '5905',
    natureza_operacao:  'Remessa para depósito fechado ou armazém geral',
    finalidade:         1,
  },
  {
    value:              'retorno_deposito',
    label:              'Retorno de mercadoria depositada',
    cfop:               '5906',
    natureza_operacao:  'Retorno de mercadoria depositada em depósito geral',
    finalidade:         1,
  },

  // ── NFC-e / Cupom ─────────────────────────────────────────────────────────
  {
    value:              'nfce_interna',
    label:              'NF de cupom NFC-e (interna)',
    cfop:               '5929',
    natureza_operacao:  'Lançamento efetuado em decorrência de emissão de documento fiscal relativo a operação ou prestação também registrada em equipamento emissor de cupom fiscal',
    finalidade:         1,
  },

  // ── Uso e consumo / Ativo ─────────────────────────────────────────────────
  {
    value:              'uso_consumo',
    label:              'Uso e consumo',
    cfop:               '5949',
    natureza_operacao:  'Saída de mercadoria para uso e consumo',
    finalidade:         1,
  },
  {
    value:              'devolucao_material_uso',
    label:              'Devolução de material de uso e consumo',
    cfop:               '5556',
    natureza_operacao:  'Devolução de compra de material de uso ou consumo',
    finalidade:         4,
  },

  // ── Saídas especiais ──────────────────────────────────────────────────────
  {
    value:              'saida_producao',
    label:              'Saída para produção',
    cfop:               '5926',
    natureza_operacao:  'Lançamento efetuado a título de baixa de estoque de produto em fabricação',
    finalidade:         1,
  },
  {
    value:              'baixa_estoque',
    label:              'Baixa de estoque',
    cfop:               '5927',
    natureza_operacao:  'Lançamento efetuado a título de baixa de estoque decorrente de perda, roubo ou deterioração',
    finalidade:         1,
  },
  {
    value:              'perca_avaria',
    label:              'Perda e avaria',
    cfop:               '5927',
    natureza_operacao:  'Perda e avaria de mercadoria',
    finalidade:         1,
  },

  // ── NF complementar / ajuste ──────────────────────────────────────────────
  {
    value:              'nf_complementar',
    label:              'NF complementar (mesmo estado)',
    cfop:               '5949',
    natureza_operacao:  'Nota fiscal complementar dentro do estado',
    finalidade:         2,
  },
  {
    value:              'nf_complementar_fora',
    label:              'NF complementar (outro estado)',
    cfop:               '6949',
    natureza_operacao:  'Nota fiscal complementar fora do estado',
    finalidade:         2,
  },
  {
    value:              'nota_anulatoria',
    label:              'Nota anulatória',
    cfop:               '5949',
    natureza_operacao:  'Anulação de valor relativo à prestação de serviço',
    finalidade:         2,
  },

  // ── Outras saídas ─────────────────────────────────────────────────────────
  {
    value:              'outras_saidas',
    label:              'Outras saídas',
    cfop:               '5949',
    natureza_operacao:  'Outra saída de mercadoria ou prestação de serviço não especificado',
    finalidade:         1,
  },
]

// ─── Grupos para exibição no seletor ─────────────────────────────────────────

export const GRUPOS_TIPO_NOTA = [
  {
    label:   'Vendas',
    valores: [
      'venda_mercadoria_interna',
      'venda_producao_interna',
      'venda_combustivel',
    ],
  },
  {
    label:   'Devoluções',
    valores: [
      'devolucao_compra_industrializacao',
      'devolucao_compra_comercializacao',
      'devolucao_venda_mercadoria',
      'devolucao_venda_producao',
      'devolucao_mercadorias_interna',
      'devolucao_material_uso',
    ],
  },
  {
    label:   'Transferências',
    valores: [
      'transferencia_mercadoria',
      'transferencia_producao',
      'transferencia_material_uso',
    ],
  },
  {
    label:   'Remessas',
    valores: [
      'remessa_deposito',
      'retorno_deposito',
    ],
  },
  {
    label:   'Saídas especiais',
    valores: [
      'saida_producao',
      'baixa_estoque',
      'perca_avaria',
      'uso_consumo',
      'nfce_interna',
    ],
  },
  {
    label:   'Complementar / Ajuste',
    valores: [
      'nf_complementar',
      'nf_complementar_fora',
      'nota_anulatoria',
    ],
  },
  {
    label:   'Outros',
    valores: ['outras_saidas'],
  },
]

// ─── Formas de pagamento ──────────────────────────────────────────────────────

export const FORMAS_PAGAMENTO = [
  { value: 'boleto',         label: 'Boleto bancário' },
  { value: 'dinheiro',       label: 'Dinheiro' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'cartao_debito',  label: 'Cartão de débito' },
  { value: 'pix',            label: 'PIX' },
  { value: 'sem_pagamento',  label: 'Sem pagamento' },
]

// ─── Finalidades ──────────────────────────────────────────────────────────────

export const FINALIDADES = [
  { value: 1, label: '1 – NF-e normal' },
  { value: 2, label: '2 – NF-e complementar' },
  { value: 3, label: '3 – NF-e de ajuste' },
  { value: 4, label: '4 – Devolução / Retorno' },
]

// ─── UFs ─────────────────────────────────────────────────────────────────────

export const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

// ─── Tipos que requerem chave de referência ───────────────────────────────────

export const TIPOS_NOTA_REQUEREM_CHAVE_REF = [
  'devolucao_compra_industrializacao',
  'devolucao_compra_comercializacao',
  'devolucao_venda_mercadoria',
  'devolucao_venda_producao',
  'devolucao_mercadorias_interna',
  'nota_anulatoria',
  'nf_complementar',
  'nf_complementar_fora',
]

// ─── Resolução de CFOP por estado ────────────────────────────────────────────
// Retorna o CFOP correto (5xxx = mesmo estado, 6xxx = outro estado)
// com base no valor do tipo de nota e no estado do emitente vs destinatário.

export function cfopParaTipo(tipoValue: string, mesmoEstado: boolean): string {
  // Par [interno, externo]
  const map: Record<string, [string, string]> = {
    venda_mercadoria_interna:          ['5102', '6102'],
    venda_producao_interna:            ['5101', '6101'],
    venda_combustivel:                 ['5656', '6656'],
    devolucao_compra_industrializacao: ['5201', '6201'],
    devolucao_compra_comercializacao:  ['5202', '6202'],
    devolucao_venda_mercadoria:        ['1202', '2202'],
    devolucao_venda_producao:          ['1201', '2201'],
    devolucao_mercadorias_interna:     ['5201', '6201'],
    devolucao_material_uso:            ['5556', '6556'],
    transferencia_mercadoria:          ['5152', '6152'],
    transferencia_producao:            ['5151', '6151'],
    transferencia_material_uso:        ['5557', '6557'],
    remessa_deposito:                  ['5905', '6905'],
    retorno_deposito:                  ['5906', '6906'],
    nfce_interna:                      ['5929', '6929'],
    uso_consumo:                       ['5949', '6949'],
    saida_producao:                    ['5926', '5926'],
    baixa_estoque:                     ['5927', '5927'],
    perca_avaria:                      ['5927', '5927'],
    nf_complementar:                   ['5949', '5949'],
    nf_complementar_fora:              ['6949', '6949'],
    nota_anulatoria:                   ['5949', '6949'],
    outras_saidas:                     ['5949', '6949'],
  }
  const pair = map[tipoValue]
  if (!pair) return '5949'
  return mesmoEstado ? pair[0] : pair[1]
}
