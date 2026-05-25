import { supabase } from '@/lib/supabase'

export type DestinatarioResult = {
  id: string
  origem: 'cliente' | 'fornecedor'
  nome: string
  cpf_cnpj: string | null
  ie: string | null
  email: string | null
  telefone: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  municipio: string | null
  codigo_municipio: string | null
  uf: string | null
  cep: string | null
  tipo: 'fisica' | 'juridica'
}

type CustomerRow = {
  id: string
  name: string
  razao_social: string | null
  pessoa_tipo: string
  cpf: string | null
  cnpj: string | null
  ie: string | null
  email: string
  phone: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  municipio: string | null
  codigo_municipio: string | null
  uf: string | null
  cep: string | null
}

type SupplierRow = {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string
  inscricao_estadual: string | null
  email: string | null
  telefone: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  municipio: string | null
  codigo_municipio: string | null
  uf: string | null
  cep: string | null
}

function onlyDigits(v: string) {
  return v.replace(/\D/g, '')
}

export async function searchDestinatarios(
  query: string,
  companyId: string,
  limit = 8
): Promise<DestinatarioResult[]> {
  const trimmed = query.trim()
  if (!trimmed || trimmed.length < 2) return []

  const isDoc = /^[\d.\-/]+$/.test(trimmed)
  const docClean = onlyDigits(trimmed)

  // ── Clientes ──────────────────────────────────────────────────────────────
  let customerQuery = supabase
    .from('customers')
    .select(
      'id, name, razao_social, pessoa_tipo, cpf, cnpj, ie, email, phone, ' +
      'logradouro, numero, complemento, bairro, municipio, codigo_municipio, uf, cep'
    )
    .eq('company_id', companyId)
    .limit(limit)

  if (isDoc) {
    customerQuery = customerQuery.or(
      `cpf.ilike.%${docClean}%,cpf.ilike.%${trimmed}%,cnpj.ilike.%${docClean}%,cnpj.ilike.%${trimmed}%`
    )
  } else {
    customerQuery = customerQuery.or(
      `name.ilike.%${trimmed}%,razao_social.ilike.%${trimmed}%`
    )
  }

  // ── Fornecedores ──────────────────────────────────────────────────────────
  let supplierQuery = supabase
    .from('suppliers')
    .select(
      'id, razao_social, nome_fantasia, cnpj, inscricao_estadual, email, telefone, ' +
      'logradouro, numero, complemento, bairro, municipio, codigo_municipio, uf, cep'
    )
    .eq('company_id', companyId)
    .limit(limit)

  if (isDoc) {
    supplierQuery = supplierQuery.or(
      `cnpj.ilike.%${docClean}%,cnpj.ilike.%${trimmed}%`
    )
  } else {
    supplierQuery = supplierQuery.or(
      `razao_social.ilike.%${trimmed}%,nome_fantasia.ilike.%${trimmed}%`
    )
  }

  const [customerRes, supplierRes] = await Promise.all([
    customerQuery,
    supplierQuery,
  ])

  const customers = (customerRes.error ? [] : customerRes.data) as unknown as CustomerRow[]
  const suppliers = (supplierRes.error ? [] : supplierRes.data) as unknown as SupplierRow[]

  const results: DestinatarioResult[] = []

  for (const c of customers) {
    results.push({
      id:               c.id,
      origem:           'cliente',
      nome:             c.razao_social ?? c.name,
      cpf_cnpj:         c.cnpj ?? c.cpf ?? null,
      ie:               c.ie ?? null,
      email:            c.email ?? null,
      telefone:         c.phone ?? null,
      tipo:             (c.pessoa_tipo as 'fisica' | 'juridica') ?? 'fisica',
      logradouro:       c.logradouro ?? null,
      numero:           c.numero ?? null,
      complemento:      c.complemento ?? null,
      bairro:           c.bairro ?? null,
      municipio:        c.municipio ?? null,
      codigo_municipio: c.codigo_municipio ?? null,
      uf:               c.uf ?? null,
      cep:              c.cep ?? null,
    })
  }

  for (const s of suppliers) {
    results.push({
      id:               s.id,
      origem:           'fornecedor',
      nome:             s.razao_social,
      cpf_cnpj:         s.cnpj ?? null,
      ie:               s.inscricao_estadual ?? null,
      email:            s.email ?? null,
      telefone:         s.telefone ?? null,
      logradouro:       s.logradouro ?? null,
      numero:           s.numero ?? null,
      complemento:      s.complemento ?? null,
      bairro:           s.bairro ?? null,
      municipio:        s.municipio ?? null,
      codigo_municipio: s.codigo_municipio ?? null,
      uf:               s.uf ?? null,
      cep:              s.cep ?? null,
      tipo:             'juridica',
    })
  }

  return results.slice(0, limit)
}