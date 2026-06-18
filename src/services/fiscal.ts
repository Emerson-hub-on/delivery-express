// services/fiscal.ts
import { supabase } from '@/lib/supabase'
import { Order } from '@/types/product'
import { FiscalConfig, FiscalConfigPayload, NfceStatus } from '@/types/fiscal'

// ── Utilitário interno ────────────────────────────────────────

async function getCompanyId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user.id
}

// ── Configuração do emitente ──────────────────────────────────

export const getFiscalConfig = async (): Promise<FiscalConfig | null> => {
  const company_id = await getCompanyId()

  const { data, error } = await supabase
    .from('fiscal_configs')
    .select('*')
    .eq('company_id', company_id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

// Dados públicos do emitente, usados em impressões (cupom/pedido).
// Só os campos não sensíveis — evita trafegar certificado/senha pro
// client à toa quando o que se quer é só imprimir um cupom.
export type FiscalCompanyInfo = {
  razao_social: string
  nome_fantasia: string | null
  cnpj: string
  telefone: string | null
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  municipio: string
  uf: string
  cep: string
}

export const getFiscalCompanyInfo = async (): Promise<FiscalCompanyInfo | null> => {
  const company_id = await getCompanyId()

  const { data, error } = await supabase
    .from('fiscal_configs')
    .select('razao_social, nome_fantasia, cnpj, telefone, logradouro, numero, complemento, bairro, municipio, uf, cep')
    .eq('company_id', company_id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as FiscalCompanyInfo | null
}

export const saveFiscalConfig = async (
  payload: FiscalConfigPayload
): Promise<FiscalConfig> => {
  const company_id = await getCompanyId()

  // Remove campos de certificado que são apenas marcadores visuais do frontend
  // ou undefined — nunca devem sobrescrever o valor real no banco
  const CERT_FIELDS = ['cert_pfx_base64', 'cert_cpf_pfx_base64'] as const
  const clean = Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (value === undefined) return false
      if (CERT_FIELDS.includes(key as any) && (value === '__saved__' || value === '')) return false
      return true
    })
  ) as Partial<FiscalConfigPayload>

  const { data: existing } = await supabase
    .from('fiscal_configs')
    .select('id')
    .eq('company_id', company_id)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await supabase
      .from('fiscal_configs')
      .update(clean)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as FiscalConfig
  }

  const { data, error } = await supabase
    .from('fiscal_configs')
    .insert([{ ...clean, company_id }])
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as FiscalConfig
}

// ── Pedidos sem NFC-e emitida ─────────────────────────────────

export const getOrdersSemNfce = async (
  dateFrom?: string,
  dateTo?: string
): Promise<Order[]> => {
  let query = supabase
    .from('orders')
    .select('*')
    .is('nfce_status', null)
    .in('status', ['completed', 'concluido', 'entregue'])
    .gt('total', 0)
    .order('created_at', { ascending: false })

  if (dateFrom) {
    query = query.gte('created_at', `${dateFrom}T00:00:00`)
  }
  if (dateTo) {
    query = query.lte('created_at', `${dateTo}T23:59:59`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}

export const getOrdersComNfce = async (
  dateFrom?: string,
  dateTo?: string
): Promise<Order[]> => {
  let query = supabase
    .from('orders')
    .select('*')
    .not('nfce_status', 'is', null)
    .order('nfce_emitido_at', { ascending: false })

  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
  if (dateTo)   query = query.lte('created_at', `${dateTo}T23:59:59`)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}

// ── Atualizar status NFC-e de um pedido ──────────────────────

export type NfceUpdatePayload = {
  nfce_numero?: number
  nfce_serie?: string
  nfce_status: NfceStatus
  nfce_chave?: string
  nfce_danfe_url?: string
  nfce_motivo?: string
  nfce_emitido_at?: string
  nfce_cancelado_at?: string
  nfce_xml?: string
  cpf_cnpj_consumidor?: string
}

export const updateOrderNfce = async (
  orderId: number,
  payload: NfceUpdatePayload
): Promise<Order> => {
  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', orderId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Order
}

// ── Próximo número da NFC-e ───────────────────────────────────

export const nextNfceNumero = async (
  companyId: string,
  serie: string
): Promise<number> => {
  const { data, error } = await supabase.rpc('next_nfce_numero', {
    p_company_id: companyId,
    p_serie: serie,
  })
  if (error) throw new Error(error.message)
  return data as number
}

// ── Marcar como "pendente" (fila de emissão) ──────────────────

export const marcarPendente = async (orderId: number): Promise<Order> =>
  updateOrderNfce(orderId, { nfce_status: 'pendente' })

// ── Cancelar NFC-e emitida ────────────────────────────────────

export const cancelarNfce = async (orderId: number, motivo: string): Promise<Order> => {
  const updated = await updateOrderNfce(orderId, {
    nfce_status: 'cancelado',
    nfce_motivo: motivo,
    nfce_cancelado_at: new Date().toISOString(),
  })

  // Para vendas PDV, estorna estoque e marca pedido como cancelado
  const { data: ord } = await supabase.from('orders').select('order_type').eq('id', orderId).maybeSingle()
  if (ord?.order_type === 'pdv') {
    await supabase.rpc('estornar_estoque_venda', { p_order_id: orderId })
    await supabase.from('orders').update({ status: 'cancelled', cupom_cancelado: true }).eq('id', orderId)
  }

  return updated
}