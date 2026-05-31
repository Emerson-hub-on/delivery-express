import { createClient } from '@supabase/supabase-js'

export type Finalidade =
  | 'revenda'
  | 'uso_consumo'
  | 'ativo'
  | 'industrializacao'
  | 'devolucao'
  | 'bonificacao'
  | 'outros'

export type ItemParaConverter = {
  cfop: string
  cst: string
}

export type ItemConvertido = {
  cfop_origem: string
  cst_origem: string
  finalidade: Finalidade
  cfop_entrada: string
  cst_entrada: string
  convertido: boolean
}

type RegraConversao = {
  cfop_origem: string
  cst_origem: string
  crt: number
  cfop_entrada: string
  cst_entrada: string
  finalidade: string
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Busca o CRT da empresa para selecionar as regras corretas.
 * CRT 1 = Simples Nacional, CRT 3 = Regime Normal (Lucro Real/Presumido).
 */
async function getCrtEmpresa(companyId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('companies')
    .select('crt')
    .eq('id', companyId)
    .single<{ crt: number }>()

  return data?.crt ?? 3
}

/**
 * Busca todas as regras de conversão para o CRT e finalidade informados.
 * Carrega uma vez e aplica para todos os itens da nota.
 */
async function buscarRegras(
  crt: number,
  finalidade: Finalidade
): Promise<RegraConversao[]> {
  const { data, error } = await supabaseAdmin
    .from('cfop_cst_conversao')
    .select('cfop_origem, cst_origem, crt, cfop_entrada, cst_entrada, finalidade')
    .eq('crt', crt)
    .eq('finalidade', finalidade)

  if (error) throw new Error(`Erro ao buscar regras de conversão: ${error.message}`)
  return (data ?? []) as RegraConversao[]
}

/**
 * Converte uma lista de pares CFOP/CST de saída para os equivalentes de entrada,
 * conforme as regras cadastradas na tabela cfop_cst_conversao.
 *
 * Lógica de match (prioridade decrescente):
 *   1. cfop_origem + cst_origem exatos
 *   2. cfop_origem + cst_origem vazio/curinga ('*' ou '')
 *
 * Se nenhuma regra for encontrada, retorna os valores originais e marca convertido=false.
 */
export async function converterCfopCst(params: {
  companyId: string
  itens: ItemParaConverter[]
  finalidade: Finalidade
}): Promise<ItemConvertido[]> {
  const { companyId, itens, finalidade } = params

  if (itens.length === 0) return []

  const crt = await getCrtEmpresa(companyId)
  const regras = await buscarRegras(crt, finalidade)

  // Indexa para lookup O(1): "cfop_origem|cst_origem" -> regra
  const mapaExato = new Map<string, RegraConversao>()
  const mapaCuringa = new Map<string, RegraConversao>() // só cfop, cst vazio/*

  for (const r of regras) {
    if (r.cst_origem && r.cst_origem !== '*') {
      mapaExato.set(`${r.cfop_origem}|${r.cst_origem}`, r)
    } else {
      mapaCuringa.set(r.cfop_origem, r)
    }
  }

  return itens.map((item): ItemConvertido => {
    const regra =
      mapaExato.get(`${item.cfop}|${item.cst}`) ??
      mapaCuringa.get(item.cfop) ??
      null

    if (!regra) {
      return {
        cfop_origem: item.cfop,
        cst_origem:  item.cst,
        finalidade,
        cfop_entrada: item.cfop,
        cst_entrada:  item.cst,
        convertido:   false,
      }
    }

    return {
      cfop_origem:  item.cfop,
      cst_origem:   item.cst,
      finalidade,
      cfop_entrada: regra.cfop_entrada,
      cst_entrada:  regra.cst_entrada,
      convertido:   true,
    }
  })
}