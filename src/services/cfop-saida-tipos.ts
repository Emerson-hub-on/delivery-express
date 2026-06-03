import { supabase } from '@/lib/supabase'
import type { TipoNota, TipoNotaCustom } from '@/components/billing/nf-saida/types'

// ─── Tipo retornado pelo banco ────────────────────────────────────────────────

export interface CfopSaidaTipoRow {
  id:                number
  company_id:        string | null
  value:             string
  label:             string
  cfop_interno:      string
  cfop_externo:      string
  natureza_operacao: string
  finalidade:        1 | 2 | 3 | 4
  grupo:             string
  ordem:             number
  requer_chave_ref:  boolean
  ativo:             boolean
  is_sistema:        boolean
}

// ─── Conversão row → TipoNota (usado pelos componentes) ──────────────────────

function rowToTipoNota(row: CfopSaidaTipoRow): TipoNota {
  return {
    value:             row.value,
    label:             row.label,
    cfop:              row.cfop_interno,   // cfop_externo resolvido em runtime por cfopParaTipo()
    cfop_externo:      row.cfop_externo,
    natureza_operacao: row.natureza_operacao,
    finalidade:        row.finalidade,
    requerChaveRef:    row.requer_chave_ref,
    isCustom:          !row.is_sistema,
    dbId:              row.id,
  }
}

// ─── Listagem ─────────────────────────────────────────────────────────────────
// Retorna tipos de sistema (company_id null) + tipos da empresa, ativos,
// ordenados por grupo e ordem.

export async function getTiposSaida(companyId: string): Promise<TipoNota[]> {
  const { data, error } = await supabase
    .from('cfop_saida_tipos')
    .select('*')
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .eq('ativo', true)
    .order('grupo')
    .order('ordem')

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTipoNota)
}

// ─── Grupos agrupados (para o <optgroup> do seletor) ─────────────────────────

export interface GrupoTipos {
  label:  string
  tipos:  TipoNota[]
}

export async function getTiposSaidaAgrupados(companyId: string): Promise<GrupoTipos[]> {
  const tipos = await getTiposSaida(companyId)

  const mapa = new Map<string, TipoNota[]>()
  for (const t of tipos) {
    const grupo = (t as any).grupo ?? 'Outros'
    if (!mapa.has(grupo)) mapa.set(grupo, [])
    mapa.get(grupo)!.push(t)
  }

  return Array.from(mapa.entries()).map(([label, tipos]) => ({ label, tipos }))
}

// ─── Criação de tipo customizado ──────────────────────────────────────────────

export async function createTipoSaida(
  companyId: string,
  custom: TipoNotaCustom
): Promise<TipoNota> {
  const payload = {
    company_id:        companyId,
    value:             `custom_${companyId.slice(0, 8)}_${Date.now()}`,
    label:             custom.nome,
    cfop_interno:      custom.cfop_padrao || '5949',
    // Para tipos customizados o usuário informa um CFOP; derivamos o externo
    // trocando o primeiro dígito: 5→6, 1→2. Fallback para o mesmo valor.
    cfop_externo:      derivarCfopExterno(custom.cfop_padrao || '5949'),
    natureza_operacao: custom.natureza_operacao,
    finalidade:        custom.finalidade,
    grupo:             'Personalizados',
    ordem:             99,
    requer_chave_ref:  false,
    is_sistema:        false,
  }

  const { data, error } = await supabase
    .from('cfop_saida_tipos')
    .insert(payload)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return rowToTipoNota(data as CfopSaidaTipoRow)
}

// ─── Desativação (tipos customizados — sistema nunca são desativados via UI) ──

export async function desativarTipoSaida(
  id: number,
  companyId: string
): Promise<void> {
  const { error } = await supabase
    .from('cfop_saida_tipos')
    .update({ ativo: false })
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('is_sistema', false)

  if (error) throw new Error(error.message)
}

// ─── Helper: deriva CFOP externo a partir do interno ─────────────────────────
// 5xxx → 6xxx | 1xxx → 2xxx | qualquer outro → mesmo valor

function derivarCfopExterno(cfopInterno: string): string {
  if (cfopInterno.startsWith('5')) return '6' + cfopInterno.slice(1)
  if (cfopInterno.startsWith('1')) return '2' + cfopInterno.slice(1)
  return cfopInterno
}