// lib/fiscal/conversao-cfop-cst.ts

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type Finalidade =
  'revenda' | 'uso_consumo' | 'ativo_imobilizado' | 'bonificacao' | 'outros'

export interface ConversaoItem {
  cfop_origem:  string
  cst_origem:   string
  cfop_entrada: string
  cst_entrada:  string
  finalidade:   Finalidade
  convertido:   boolean  // false = usou fallback automático
}

/** Converte CFOP automaticamente pelo dígito (5→1, 6→2, 7→3) */
function converteCfopFallback(cfop: string): string {
  const map: Record<string, string> = { '5': '1', '6': '2', '7': '3' }
  return (map[cfop[0]] ?? cfop[0]) + cfop.slice(1)
}

export async function converterCfopCst({
  companyId,
  itens,
  finalidade = 'revenda',
}: {
  companyId: string
  itens: Array<{ cfop: string; cst: string }>
  finalidade?: Finalidade
}): Promise<ConversaoItem[]> {

  // Busca o CRT da empresa
  const { data: cfg } = await supabaseAdmin
    .from('fiscal_config')
    .select('crt')
    .eq('company_id', companyId)
    .single()

  const crt = cfg?.crt ?? 1

  // Busca todas as conversões disponíveis para esse CRT
  const { data: conversoes } = await supabaseAdmin
    .from('cfop_cst_conversao')
    .select('*')
    .eq('crt', crt)
    .eq('finalidade', finalidade)

  return itens.map(item => {
    const regra = conversoes?.find(
      c => c.cfop_origem === item.cfop && c.cst_origem === item.cst
    )

    if (regra) {
      return {
        cfop_origem:  item.cfop,
        cst_origem:   item.cst,
        cfop_entrada: regra.cfop_entrada,
        cst_entrada:  regra.cst_entrada,
        finalidade,
        convertido:   true,
      }
    }

    // Fallback: converte só o CFOP automaticamente, mantém CST
    return {
      cfop_origem:  item.cfop,
      cst_origem:   item.cst,
      cfop_entrada: converteCfopFallback(item.cfop),
      cst_entrada:  item.cst,
      finalidade,
      convertido:   false,  // sinaliza que precisa de revisão manual
    }
  })
}