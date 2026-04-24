// types/product.ts
import type { CartAddon } from './addon'
export type Category = string

// ── Tipos fiscais ─────────────────────────────────────────────

export type UnitCom =
  | 'UN' | 'KG' | 'G' | 'L' | 'ML'
  | 'CX' | 'PCT' | 'M' | 'M2' | 'M3'
  | string

export type OrigemMercadoria = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type ICMS_CSOSN =
  | '102'  // Tributada SN sem permissão de crédito
  | '103'  // Isenção para faixa de receita bruta
  | '300'  // Imune
  | '400'  // Não tributada pelo SN ← padrão delivery/alimentação
  | '500'  // ICMS cobrado anteriormente por ST
  | '900'  // Outros — com alíquota normal

export type PIS_COFINS_CST =
  | '01'   // Tributável alíquota básica
  | '02'   // Tributável alíquota diferenciada
  | '07'   // Isenta ← Simples Nacional
  | '08'   // Sem incidência
  | '49'   // Outras saídas

// ── Produto ───────────────────────────────────────────────────

export type Product = {
  id: number
  category: Category
  name: string
  image: string
  price: number
  description?: string
  active?: boolean

  // ── Campos fiscais (NFC-e / NF-e) ─────────────────────────

  /** NCM: 8 dígitos — ex: '21069090' */
  ncm?: string

  /** CEST: 7 dígitos — somente com Substituição Tributária */
  cest?: string

  /**
   * CFOP: 4 dígitos
   * 5101 = produção própria dentro do estado
   * 5102 = mercadoria de terceiros dentro do estado  ← padrão
   * 6101/6102 = equivalentes fora do estado
   */
  cfop?: string

  /** Unidade comercial: 'UN', 'KG', 'L' … */
  unit_com?: UnitCom

  /** Unidade tributável (somente quando diferente da comercial) */
  unit_trib?: UnitCom

  /** Origem: 0 = Nacional, 1 = Importação direta, 2 = Merc. interno estrangeiro */
  origem?: OrigemMercadoria

  /** CSOSN do Simples Nacional — '400' é o padrão para alimentação */
  icms_csosn?: ICMS_CSOSN

  /** Alíquota ICMS (%) — preencher somente quando icms_csosn = '900' */
  icms_aliq?: number

  /** CST PIS — '07' para Simples Nacional */
  pis_cst?: PIS_COFINS_CST

  /** Alíquota PIS (%) — 0 para Simples Nacional */
  pis_aliq?: number

  /** CST COFINS — '07' para Simples Nacional */
  cofins_cst?: PIS_COFINS_CST

  /** Alíquota COFINS (%) — 0 para Simples Nacional */
  cofins_aliq?: number
}

// ── Categoria ─────────────────────────────────────────────────

export type CategoryItem = {
  id: number
  name: string
  label: string
  active?: boolean   // ← adicionar
  sort_order?: number
}

// ── Pedido ────────────────────────────────────────────────────

export type OrderItem = {
  product_id: number
  product_name: string
  quantity: number
  unit_price: number
  addons?: CartAddon[]
  observation?: string | null
}

export type OrderAddress = {
  street: string
  number: string
  complement?: string
  district: string
  city: string
  state: string
}

export type Order = {
  id: number
  code: string
  created_at: string
  total: number
  status: string
  customer: string
  customer_phone?: string | null
  customer_id?: string | null
  ifood_id?: string
  raw?: Record<string, unknown> | null
  items: OrderItem[]
  address?: OrderAddress | null
  delivery_type?: 'delivery' | 'pickup' | null
  payment_method?: string | null
  motoboy_id?: string | null
  dispatched_at?: string | null
  completed_at?: string | null
  payment_gateway_id?: string | null
  pix_expires_at?: string | null
  delivery_pin?: string | null
  change?: number | null
  printed?: boolean

  // ── Campos fiscais (NFC-e) ─────────────────────────────────
  nfce_status?: import('./fiscal').NfceStatus | null
  nfce_numero?: number | null
  nfce_serie?: string | null
  nfce_chave?: string | null
  nfce_danfe_url?: string | null
  nfce_motivo?: string | null
  nfce_emitido_at?: string | null
  nfce_cancelado_at?: string | null
  nfce_xml?: string | null
  cpf_cnpj_consumidor?: string | null
}

// ── Cupom Fiscal ──────────────────────────────────────────────

export type CupomFiscalStatus =
  | 'pendente'
  | 'emitido'
  | 'cancelado'
  | 'rejeitado'

export type CupomFiscal = {
  id: number
  order_id: number
  numero: number
  serie: string
  /** Chave de acesso de 44 dígitos retornada pela SEFAZ */
  chave_acesso?: string
  /** URL do DANFE / QR-Code */
  danfe_url?: string
  status: CupomFiscalStatus
  /** Mensagem xMotivo da SEFAZ */
  sefaz_motivo?: string
  emitido_at?: string
  cancelado_at?: string
  created_at: string
}