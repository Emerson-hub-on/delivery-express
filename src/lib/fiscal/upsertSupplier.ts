import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // service role — só no servidor
)

export interface SupplierData {
  cnpj:             string
  razao_social:     string
  nome_fantasia?:   string | null
  regime_tributario?: string | null   // extraído do XML, campo <CRT>
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

/**
 * Verifica se o fornecedor já existe pelo CNPJ.
 * - Se existir: compara campos e atualiza apenas os que mudaram.
 * - Se não existir: insere o registro completo.
 */
export async function upsertSupplier(
  companyId: string,
  data: SupplierData
): Promise<void> {
  const cnpj = data.cnpj.replace(/\D/g, '')   // só dígitos

  const { data: existing, error } = await supabaseAdmin
    .from('suppliers')
    .select('id, razao_social, nome_fantasia, regime_tributario, endereco, telefone, email')
    .eq('company_id', companyId)
    .eq('cnpj', cnpj)
    .maybeSingle()

  if (error) {
    console.error('[upsertSupplier] erro ao buscar:', error.message)
    return
  }

  if (!existing) {
    // ── Novo fornecedor ────────────────────────────────────────────────
    const { error: insertErr } = await supabaseAdmin
      .from('suppliers')
      .insert({
        company_id:        companyId,
        cnpj,
        razao_social:      data.razao_social,
        nome_fantasia:     data.nome_fantasia  ?? null,
        regime_tributario: data.regime_tributario ?? null,
        endereco:          data.endereco       ?? null,
        telefone:          data.telefone       ?? null,
        email:             data.email          ?? null,
      })

    if (insertErr) {
      console.error('[upsertSupplier] erro ao inserir:', insertErr.message)
    }
    return
  }

  // ── Fornecedor existente — monta diff ──────────────────────────────
  const updates: Record<string, unknown> = {}

  if (data.razao_social && data.razao_social !== existing.razao_social)
    updates.razao_social = data.razao_social

  if (data.nome_fantasia && data.nome_fantasia !== existing.nome_fantasia)
    updates.nome_fantasia = data.nome_fantasia

  if (
    data.regime_tributario &&
    data.regime_tributario !== existing.regime_tributario
  )
    updates.regime_tributario = data.regime_tributario

  // Compara endereço serializando — atualiza se qualquer campo mudou
  const enderecoAtual  = JSON.stringify(existing.endereco  ?? {})
  const enderecoNovo   = JSON.stringify(data.endereco      ?? {})
  if (data.endereco && enderecoNovo !== enderecoAtual)
    updates.endereco = data.endereco

  if (data.telefone && data.telefone !== existing.telefone)
    updates.telefone = data.telefone

  if (data.email && data.email !== existing.email)
    updates.email = data.email

  if (Object.keys(updates).length === 0) return   // nada mudou

  updates.updated_at = new Date().toISOString()

  const { error: updateErr } = await supabaseAdmin
    .from('suppliers')
    .update(updates)
    .eq('company_id', companyId)
    .eq('cnpj', cnpj)

  if (updateErr) {
    console.error('[upsertSupplier] erro ao atualizar:', updateErr.message)
  }
}