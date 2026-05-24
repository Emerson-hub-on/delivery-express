import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface SupplierData {
  cnpj:                string
  razao_social:        string
  nome_fantasia?:      string | null
  regime_tributario?:  string | null
  inscricao_estadual?: string | null
  contribuinte?:       'contribuinte' | 'isento' | 'nao_contribuinte' | null
  codigo_municipio?:   string | null
  endereco?: {
    logradouro?: string
    numero?:     string
    bairro?:     string
    municipio?:  string
    uf?:         string
    cep?:        string
  } | null
  telefone?: string | null
  email?:    string | null
}

export function resolverContribuinte(
  ie: unknown
): 'contribuinte' | 'isento' | 'nao_contribuinte' {
  if (!ie) return 'nao_contribuinte'
  const val = String(ie).trim().toUpperCase()
  if (val === 'ISENTO' || val === 'IS') return 'isento'
  if (val === '' || val === '0')        return 'nao_contribuinte'
  return 'contribuinte'
}

export async function upsertSupplier(
  companyId: string,
  data: SupplierData
): Promise<void> {
  const cnpj = data.cnpj.replace(/\D/g, '')

  const { data: existing, error } = await supabaseAdmin
    .from('suppliers')
    .select(`
      id,
      razao_social,
      nome_fantasia,
      regime_tributario,
      inscricao_estadual,
      contribuinte,
      codigo_municipio,
      endereco,
      telefone,
      email
    `)
    .eq('company_id', companyId)
    .eq('cnpj', cnpj)
    .maybeSingle()

  if (error) {
    console.error('[upsertSupplier] erro ao buscar:', error.message)
    return
  }

  if (!existing) {
    const { error: insertErr } = await supabaseAdmin
      .from('suppliers')
      .insert({
        company_id:         companyId,
        cnpj,
        razao_social:       data.razao_social,
        nome_fantasia:      data.nome_fantasia      ?? null,
        regime_tributario:  data.regime_tributario  ?? null,
        inscricao_estadual: data.inscricao_estadual ?? null,
        contribuinte:       data.contribuinte       ?? null,
        codigo_municipio:   data.codigo_municipio   ?? null,
        endereco:           data.endereco           ?? null,
        telefone:           data.telefone           ?? null,
        email:              data.email              ?? null,
      })

    if (insertErr)
      console.error('[upsertSupplier] erro ao inserir:', insertErr.message)

    return
  }

  // Diff — atualiza apenas campos que mudaram
  const updates: Record<string, unknown> = {}

  if (data.razao_social && data.razao_social !== existing.razao_social)
    updates.razao_social = data.razao_social

  if (data.nome_fantasia && data.nome_fantasia !== existing.nome_fantasia)
    updates.nome_fantasia = data.nome_fantasia

  if (data.regime_tributario && data.regime_tributario !== existing.regime_tributario)
    updates.regime_tributario = data.regime_tributario

  if (data.inscricao_estadual && data.inscricao_estadual !== existing.inscricao_estadual)
    updates.inscricao_estadual = data.inscricao_estadual

  if (data.contribuinte && data.contribuinte !== existing.contribuinte)
    updates.contribuinte = data.contribuinte

  if (data.codigo_municipio && data.codigo_municipio !== existing.codigo_municipio)
    updates.codigo_municipio = data.codigo_municipio

  if (data.telefone && data.telefone !== existing.telefone)
    updates.telefone = data.telefone

  if (data.email && data.email !== existing.email)
    updates.email = data.email

  if (
    data.endereco &&
    JSON.stringify(data.endereco) !== JSON.stringify(existing.endereco ?? {})
  )
    updates.endereco = data.endereco

  if (Object.keys(updates).length === 0) return

  updates.updated_at = new Date().toISOString()

  const { error: updateErr } = await supabaseAdmin
    .from('suppliers')
    .update(updates)
    .eq('company_id', companyId)
    .eq('cnpj', cnpj)

  if (updateErr)
    console.error('[upsertSupplier] erro ao atualizar:', updateErr.message)
}