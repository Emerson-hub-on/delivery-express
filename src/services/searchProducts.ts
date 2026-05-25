import { supabase } from '@/lib/supabase'

export type ProdutoResult = {
  id: number
  nome: string
  code: number
  ean: string | null
  ncm: string | null
  cfop: string
  cst_csosn: string
  preco: number
  unidade: string
}

type ProductRow = {
  id: number
  name: string
  code: number
  ean: string | null
  ncm: string | null
  cfop: string
  icms_csosn: string
  price: number
  unit_com: string
}

export async function searchProdutos(
  query: string,
  companyId: string,
  limit = 8
): Promise<ProdutoResult[]> {
  const trimmed = query.trim()
  if (!trimmed || trimmed.length < 1) return []

  // Detecta se é código interno (só dígitos, sem pontos/traços de CPF/CNPJ)
  const isCode = /^\d+$/.test(trimmed)

  let q = supabase
    .from('products')
    .select('id, name, code, ean, ncm, cfop, icms_csosn, price, unit_com')
    .eq('company_id', companyId)
    .eq('active', true)
    .limit(limit)

  if (isCode) {
    // Tenta código interno ou EAN
    q = q.or(`code.eq.${trimmed},ean.ilike.%${trimmed}%`)
  } else {
    q = q.ilike('name', `%${trimmed}%`)
  }

  const { data, error } = await q

  if (error) return []

  return (data as unknown as ProductRow[]).map(p => ({
    id:        p.id,
    nome:      p.name,
    code:      p.code,
    ean:       p.ean ?? null,
    ncm:       p.ncm ?? null,
    cfop:      p.cfop,
    cst_csosn: p.icms_csosn,
    preco:     p.price,
    unidade:   p.unit_com,
  }))
}