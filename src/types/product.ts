// types/product.ts
import type { CartAddon } from './addon'
import type { NfceStatus } from './fiscal'

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

export type ProductSize = {
  value: string        // "P", "M", "42" …
  stock: number | null // null = não controla estoque
}

export type Product = {
  id: number
  code: number
  category: Category
  name: string
  image: string
  price: number
  description?: string
  active?: boolean
  stock?: number | null
  cost_price?: number | null
  ean?: string | null
  sizes?: ProductSize[] | null
  variants?: ProductVariant[] | null
  unidade_estoque?: string
  fator_conversao?: number
  ncm?: string
  cest?: string
  cfop?: string
  unit_com?: UnitCom
  unit_trib?: UnitCom
  origem?: OrigemMercadoria
  icms_csosn?: ICMS_CSOSN
  icms_aliq?: number
  pis_cst?: PIS_COFINS_CST
  pis_aliq?: number
  cofins_cst?: PIS_COFINS_CST
  cofins_aliq?: number
  ind_escala?: 'S' | 'N'
  cnpj_fabricante?: string
}

// ── Variantes (cor × produto) ─────────────────────────────────

export type ProductColor = {
  id: number
  company_id: string
  name: string        // "AMARELO", "VINHO"
  hex_code?: string | null
}

export type ProductVariant = {
  id: number
  product_id: number
  color_id: number
  color?: ProductColor          // preenchido via join
  image?: string | null         // override da imagem principal
  sizes?: ProductSize[] | null  // mesma estrutura de products.sizes
  stock?: number | null
  active?: boolean
  created_at?: string
}

export type CategoryType = 'clothing' | 'footwear' | 'other'
export type SizeGroup   = 'adult' | 'kids'

export type CategoryItem = {
  id: number
  name: string
  label: string
  active?: boolean
  sort_order?: number
  category_type?: CategoryType
  size_group?: SizeGroup
  sizes?: string[]
}

// ── Item de Pedido ────────────────────────────────────────────
// Espelha a tabela order_items (relacional)

export type OrderItem = {
  id?: number | undefined          // PK — presente no SELECT, ausente no INSERT
  order_id?: number | undefined    // FK — presente no SELECT, ausente no INSERT
  product_id: number | null
  product_name: string
  quantity: number
  unit_price: number
  discount?: number | null         // default 0
  addons?: CartAddon[] | null
  observation?: string | null
  // campos fiscais (preenchidos na emissão NFC-e)
  unit?: string | null             // default 'UN'
  ean?: string | null
  cfop?: string | null
  ncm?: string | null
  cest?: string | null
  cst?: string | null
  csosn?: string | null
  aliq_icms?: number | null
  base_icms?: number | null
  valor_icms?: number | null
  aliq_pis?: number | null
  valor_pis?: number | null
  aliq_cofins?: number | null
  valor_cofins?: number | null
  ibpt_total?: number | null
  item_order?: number | null
  cancelado?: boolean
}

export type OrderAddress = {
  street: string
  number: string
  complement?: string
  district: string
  city: string
  state: string
}

// ── Pedido ────────────────────────────────────────────────────

export type Order = {
  id: number
  code: string
  created_at: string
  total: number
  status: string
  customer: string | null
  customer_phone?: string | null
  customer_id?: string | null
  ifood_id?: string
  /** @deprecated itens agora vêm de order_items via JOIN */
  raw?: Record<string, unknown> | null
  items: OrderItem[]
  address?: OrderAddress | null
  delivery_type?: 'delivery' | 'pickup' | null
  payment_method?: string | null
  payment_status?: string | null
  motoboy_id?: string | null
  dispatched_at?: string | null
  completed_at?: string | null
  payment_gateway_id?: string | null
  pix_expires_at?: string | null
  delivery_pin?: string | null
  change?: number | null
  printed?: boolean
  order_type?: 'delivery' | 'pdv'
  notes?: string | null

  // ── Campos fiscais (NFC-e) ─────────────────────────────────
  nfce_status?: NfceStatus | null
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

export type CupomFiscalStatus = NfceStatus  // alias — mesmos valores

export type CupomFiscal = {
  id: number
  order_id: number
  numero: number
  serie: string
  chave_acesso?: string
  danfe_url?: string
  status: CupomFiscalStatus
  sefaz_motivo?: string
  emitido_at?: string
  cancelado_at?: string
  created_at: string
}