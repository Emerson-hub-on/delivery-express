// services/fiscal.ts
import { supabase } from '@/lib/supabase'
import { Order } from '@/types/product'
import { FiscalConfig, FiscalConfigPayload, NfceStatus } from '@/types/fiscal'

// ── Configuração do emitente ──────────────────────────────────

export const getFiscalConfig = async (): Promise<FiscalConfig | null> => {
  const { data, error } = await supabase
    .from('fiscal_config')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

async function getCompanyId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user.id
}



// Substitua o saveFiscalConfig
export const saveFiscalConfig = async (
  payload: FiscalConfigPayload
): Promise<FiscalConfig> => {
  const company_id = await getCompanyId()  // ← novo

  const { data: existing } = await supabase
    .from('fiscal_config')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await supabase
      .from('fiscal_config')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as FiscalConfig
  }

  const { data, error } = await supabase
    .from('fiscal_config')
    .insert([{ ...payload, company_id }])  // ← company_id só no insert
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

export const nextNfceNumero = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('next_nfce_numero')
  if (error) throw new Error(error.message)
  return data as number
}

// ── Marcar como "pendente" (fila de emissão) ──────────────────

export const marcarPendente = async (orderId: number): Promise<Order> =>
  updateOrderNfce(orderId, { nfce_status: 'pendente' })

// ── Cancelar NFC-e emitida ────────────────────────────────────

export const cancelarNfce = async (orderId: number, motivo: string): Promise<Order> =>
  updateOrderNfce(orderId, {
    nfce_status: 'cancelado',
    nfce_motivo: motivo,
    nfce_cancelado_at: new Date().toISOString(),
  })
