export interface NfEntrada {
  id?: string
  chave: string
  numero: string
  serie: string
  emitente_razao: string
  emitente_cnpj: string
  valor_total: number
  data_emissao: string
  status: 'pendente' | 'confirmada' | 'cancelada' | 'recusada'
  xml_url?: string | null
  created_at?: string
  requer_revisao?: boolean
  finalidade?: string | null
  itens_convertidos?: unknown | null
}

// ItemNota removida — use ItemEntrada de NfEntradaDetalhe.tsx
// Mova para cá se mais de um componente precisar importar:
export interface ItemEntrada {
  id:              string
  nf_entrada_id:   string
  codigo:          string
  descricao:       string
  ean:             string | null
  ncm:             string
  cfop:            string
  cst:             string
  unidade:         string
  quantidade:      number
  valor_unitario:  number
  valor_total:     number
  produto_id:      number | null
  produto_nome:    string | null
  fator_conversao: number
}

export interface ProdutoBusca {
  id: number
  name: string
  ean?: string | null
  code: number
  price: number
  cost_price?: number | null
  stock?: number | null
  fator_conversao?: number | null
  unidade_estoque?: string | null
}

export interface ItemVinculado {
  produto: ProdutoBusca
  atualizarPrecoVenda: boolean | null
  novoPrecoVenda: string
  fatorConversao: number
  fatorAlterado: boolean
}

export type Evento = 'ciencia' | 'confirmacao' | 'recusa' | 'cancelamento' | 'reabrir'

export const STATUS_LABEL: Record<NfEntrada['status'], string> = {
  pendente:   'Pendente',
  confirmada: 'Confirmada',
  cancelada:  'Cancelada',
  recusada:   'Recusada',
}

export const STATUS_COLOR: Record<NfEntrada['status'], string> = {
  pendente:   'bg-yellow-100 text-yellow-700',
  confirmada: 'bg-green-100 text-green-700',
  cancelada:  'bg-red-100 text-red-700',
  recusada:   'bg-gray-100 text-gray-500',
}

export const CONFIRM_MESSAGES: Partial<Record<Evento, string>> = {
  recusa:       'Tem certeza que deseja recusar esta nota?',
  cancelamento: 'Tem certeza que deseja cancelar esta nota?',
}

const UNIDADES_EMBALAGEM = new Set(['CX', 'FD', 'PCT', 'KIT', 'CJ', 'FARDO', 'CAIXA'])

export function precisaConversao(
  unidadeNota: string,
  unidadeEstoque: string | null | undefined
): boolean {
  const un = unidadeNota.toUpperCase().trim()
  const ue = (unidadeEstoque ?? 'UN').toUpperCase().trim()
  return un !== ue || UNIDADES_EMBALAGEM.has(un)
}