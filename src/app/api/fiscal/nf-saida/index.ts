import { supabase } from '@/lib/supabase'
import type { NfSaida, NfSaidaForm, ItemNota } from '@/components/billing/nf-saida/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripNonDigits(s?: string | null) {
  return s ? s.replace(/\D/g, '') : null
}

// ─── Listagem ─────────────────────────────────────────────────────────────────

export async function getNfsSaida(companyId: string): Promise<NfSaida[]> {
  const { data, error } = await supabase
    .from('nf_saida')
    .select('*')
    .eq('company_id', companyId)
    .order('data_emissao', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as NfSaida[]
}

export async function getNfSaidaById(id: string): Promise<NfSaida | null> {
  const { data, error } = await supabase
    .from('nf_saida')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as NfSaida
}

// ─── Criação (rascunho ou pendente) ──────────────────────────────────────────

export async function createNfSaida(
  companyId: string,
  form: NfSaidaForm,
  valorProdutos: number,
  valorTotal: number,
  status: 'rascunho' | 'pendente' = 'rascunho'
): Promise<NfSaida> {
  const d = form.destinatario
  const payload = {
    company_id:       companyId,
    numero:           '',                          // gerado por trigger / edge function
    serie:            form.serie,
    tipo_nota:        form.tipo_nota,
    finalidade:       form.finalidade,
    natureza_operacao: form.natureza_operacao,
    dest_tipo:        d.tipo,
    dest_nome:        d.nome,
    dest_cpf_cnpj:    d.tipo === 'juridica'
                        ? stripNonDigits(d.cnpj)
                        : stripNonDigits(d.cpf),
    dest_ie:          d.ie   || null,
    dest_ind_ie:      resolveIndIe(d.ie, d.contribuinte),
    dest_email:       d.email    || null,
    dest_telefone:    d.telefone || null,
    dest_logradouro:  d.logradouro || null,
    dest_numero:      d.numero     || null,
    dest_complemento: d.complemento || null,
    dest_bairro:      d.bairro      || null,
    dest_municipio:   d.municipio   || null,
    dest_codigo_mun:  d.codigo_municipio || null,
    dest_uf:          d.uf  || null,
    dest_cep:         stripNonDigits(d.cep),
    dest_id:          d.dest_id || null,
    chave_ref:        form.chave_ref  || null,
    nf_entrada_id:    form.nf_entrada_id || null,
    itens:            form.itens,
    valor_produtos:   valorProdutos,
    valor_desconto:   form.valor_desconto,
    valor_frete:      form.valor_frete,
    valor_total:      valorTotal,
    status,
  }

  const { data, error } = await supabase
    .from('nf_saida')
    .insert(payload)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as NfSaida
}

// ─── Atualização (rascunho) ───────────────────────────────────────────────────

export async function updateNfSaida(
  id: string,
  companyId: string,
  form: NfSaidaForm,
  valorProdutos: number,
  valorTotal: number
): Promise<NfSaida> {
  const d = form.destinatario
  const payload = {
    tipo_nota:         form.tipo_nota,
    finalidade:        form.finalidade,
    natureza_operacao: form.natureza_operacao,
    dest_tipo:        d.tipo,
    dest_nome:        d.nome,
    dest_cpf_cnpj:    d.tipo === 'juridica'
                        ? stripNonDigits(d.cnpj)
                        : stripNonDigits(d.cpf),
    dest_ie:          d.ie   || null,
    dest_ind_ie:      resolveIndIe(d.ie, d.contribuinte),
    dest_email:       d.email    || null,
    dest_telefone:    d.telefone || null,
    dest_logradouro:  d.logradouro || null,
    dest_numero:      d.numero     || null,
    dest_complemento: d.complemento || null,
    dest_bairro:      d.bairro      || null,
    dest_municipio:   d.municipio   || null,
    dest_codigo_mun:  d.codigo_municipio || null,
    dest_uf:          d.uf  || null,
    dest_cep:         stripNonDigits(d.cep),
    dest_id:          d.dest_id || null,
    chave_ref:        form.chave_ref  || null,
    nf_entrada_id:    form.nf_entrada_id || null,
    itens:            form.itens,
    valor_produtos:   valorProdutos,
    valor_desconto:   form.valor_desconto,
    valor_frete:      form.valor_frete,
    valor_total:      valorTotal,
    updated_at:       new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('nf_saida')
    .update(payload)
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('status', 'rascunho')   // só permite editar rascunho
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as NfSaida
}

// ─── Emissão (delega à edge function) ────────────────────────────────────────

export async function emitirNfSaida(nfSaidaId: string): Promise<{ chave: string; danfe_url: string }> {
  const { data, error } = await supabase.functions.invoke('emitir-nfe', {
    body: { nf_saida_id: nfSaidaId },
  })
  if (error) throw new Error(error.message)
  return data as { chave: string; danfe_url: string }
}

// ─── Cancelamento ─────────────────────────────────────────────────────────────

export async function cancelarNfSaida(
  id: string,
  companyId: string,
  justificativa: string   // mínimo 15 caracteres exigido pela SEFAZ
): Promise<NfSaida> {
  if (justificativa.trim().length < 15) {
    throw new Error('Justificativa deve ter pelo menos 15 caracteres.')
  }
  const { data, error } = await supabase.functions.invoke('cancelar-nfe', {
    body: { nf_saida_id: id, company_id: companyId, justificativa },
  })
  if (error) throw new Error(error.message)
  return data as NfSaida
}

// ─── Remoção (somente rascunho) ───────────────────────────────────────────────

export async function deleteNfSaidaRascunho(id: string, companyId: string): Promise<void> {
  const { error } = await supabase
    .from('nf_saida')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('status', 'rascunho')

  if (error) throw new Error(error.message)
}

// ─── Busca de destinatário (cliente ou fornecedor) ────────────────────────────

/**
 * Busca por nome, CPF ou CNPJ em customers E suppliers.
 * Retorna lista unificada para o autocomplete da tela de faturamento.
 */
export async function searchDestinatario(
  companyId: string,
  query: string
): Promise<DestinatarioSearchResult[]> {
  const q = query.trim()
  if (!q) return []

  const isDoc = /^\d+$/.test(q)

  // ── Clientes ────────────────────────────────────────────────
  let clienteQuery = supabase
    .from('customers')
    .select('id, name, razao_social, cpf, cnpj, ie, ind_ie_dest, contribuinte, pessoa_tipo, email, phone, codigo_municipio, address')
    .eq('company_id', companyId)
    .limit(8)

  clienteQuery = isDoc
    ? clienteQuery.or(`cpf.ilike.%${q}%,cnpj.ilike.%${q}%`)
    : clienteQuery.or(`name.ilike.%${q}%,razao_social.ilike.%${q}%`)

  // ── Fornecedores ─────────────────────────────────────────────
  let fornecedorQuery = supabase
    .from('suppliers')
    .select('id, razao_social, nome_fantasia, cnpj, inscricao_estadual, contribuinte, email, telefone, codigo_municipio, endereco')
    .eq('company_id', companyId)
    .limit(8)

  fornecedorQuery = isDoc
    ? fornecedorQuery.ilike('cnpj', `%${q}%`)
    : fornecedorQuery.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%`)

  const [{ data: clientes }, { data: fornecedores }] = await Promise.all([
    clienteQuery, fornecedorQuery,
  ])

  const results: DestinatarioSearchResult[] = [
    ...(clientes ?? []).map(c => clienteToDestinatario(c)),
    ...(fornecedores ?? []).map(f => fornecedorToDestinatario(f)),
  ]

  return results
}

// ─── Converters ───────────────────────────────────────────────────────────────

function clienteToDestinatario(c: any): DestinatarioSearchResult {
  const addr = c.address ?? {}
  return {
    dest_id:           c.id,
    origem:            'cliente',
    tipo:              c.pessoa_tipo ?? 'fisica',
    nome:              c.razao_social ?? c.name,
    cpf:               c.cpf  ?? '',
    cnpj:              c.cnpj ?? '',
    ie:                c.ie   ?? '',
    contribuinte:      c.contribuinte ?? '',
    ind_ie_dest:       c.ind_ie_dest ?? 9,
    email:             c.email ?? '',
    telefone:          c.phone ?? '',
    logradouro:        addr.logradouro ?? addr.street ?? '',
    numero:            addr.numero     ?? addr.number ?? '',
    complemento:       addr.complemento ?? '',
    bairro:            addr.bairro     ?? addr.district ?? '',
    municipio:         addr.municipio  ?? addr.city ?? '',
    codigo_municipio:  c.codigo_municipio ?? addr.codigo_municipio ?? '',
    uf:                addr.uf ?? addr.state ?? 'PB',
    cep:               addr.cep ?? addr.zipcode ?? '',
  }
}

function fornecedorToDestinatario(f: any): DestinatarioSearchResult {
  const addr = f.endereco ?? {}
  return {
    dest_id:           f.id,
    origem:            'fornecedor',
    tipo:              'juridica',
    nome:              f.razao_social,
    cpf:               '',
    cnpj:              f.cnpj ?? '',
    ie:                f.inscricao_estadual ?? '',
    contribuinte:      f.contribuinte ?? '',
    ind_ie_dest:       resolveIndIe(f.inscricao_estadual, f.contribuinte),
    email:             f.email    ?? '',
    telefone:          f.telefone ?? '',
    logradouro:        addr.logradouro ?? '',
    numero:            addr.numero     ?? '',
    complemento:       addr.complemento ?? '',
    bairro:            addr.bairro      ?? '',
    municipio:         addr.municipio   ?? '',
    codigo_municipio:  f.codigo_municipio ?? addr.codigo_municipio ?? '',
    uf:                addr.uf  ?? 'PB',
    cep:               addr.cep ?? '',
  }
}

// ─── indIeDest (indicador IE destinatário) ────────────────────────────────────
// 1 = Contribuinte ICMS | 2 = Isento | 9 = Não contribuinte
function resolveIndIe(ie?: string | null, contribuinte?: string | null): 1 | 2 | 9 {
  if (contribuinte === '2') return 2  // isento
  if (ie && ie.trim() !== '' && ie.toUpperCase() !== 'ISENTO') return 1
  return 9
}

// ─── Tipos locais ─────────────────────────────────────────────────────────────

export interface DestinatarioSearchResult {
  dest_id:          string
  origem:           'cliente' | 'fornecedor'
  tipo:             'fisica' | 'juridica'
  nome:             string
  cpf:              string
  cnpj:             string
  ie:               string
  contribuinte:     string
  ind_ie_dest:      1 | 2 | 9
  email:            string
  telefone:         string
  logradouro:       string
  numero:           string
  complemento:      string
  bairro:           string
  municipio:        string
  codigo_municipio: string
  uf:               string
  cep:              string
}
