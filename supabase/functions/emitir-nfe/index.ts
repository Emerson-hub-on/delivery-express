// supabase/functions/emitir-nfe/index.ts
// @ts-nocheck
import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Tipos ────────────────────────────────────────────────────────────────────
interface NfSaidaRow {
  id: string
  company_id: string
  numero: string
  serie: string
  tipo_nota: string
  natureza_operacao: string
  finalidade: number
  dest_tipo: string
  dest_nome: string
  dest_cpf_cnpj: string
  dest_ie: string | null
  dest_email: string | null
  dest_telefone: string | null
  dest_logradouro: string | null
  dest_numero: string | null
  dest_complemento: string | null
  dest_bairro: string | null
  dest_municipio: string | null
  dest_codigo_mun: string | null
  dest_uf: string | null
  dest_cep: string | null
  itens: any[]
  valor_produtos: number
  valor_desconto: number
  valor_frete: number
  valor_total: number
  chave_ref: string | null
  informacoes_adicionais: string | null
}

interface FiscalConfig {
  razao_social: string
  cnpj: string
  ie: string
  crt: number
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  municipio: string
  uf: string
  cep: string
  codigo_ibge: string
  telefone: string | null
  ambiente: 1 | 2
  cert_pfx_base64: string | null
  cert_senha: string | null
  nfce_serie: string
}

// ── Resposta esperada da integradora ─────────────────────────────────────────
interface SefazResponse {
  xmlAutorizado: string   // XML assinado e com protocolo embutido
  chaveAcesso:   string   // 44 dígitos
  protocolo:     string   // número do protocolo de autorização
  numero:        string   // número da NF-e gerado
}

// ── Handler principal ─────────────────────────────────────────────────────────
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { nf_saida_id } = await req.json()
    if (!nf_saida_id) throw new Error('nf_saida_id é obrigatório')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── 1. Buscar nota ──────────────────────────────────────────────────────
    const { data: nota, error: notaErr } = await supabase
      .from('nf_saida')
      .select('*')
      .eq('id', nf_saida_id)
      .single<NfSaidaRow>()

    if (notaErr || !nota) throw new Error('Nota não encontrada: ' + notaErr?.message)

    // ── 2. Buscar config fiscal da empresa ──────────────────────────────────
    const { data: fiscal, error: fiscalErr } = await supabase
      .from('fiscal_config')
      .select('*')
      .eq('company_id', nota.company_id)
      .single<FiscalConfig>()

    if (fiscalErr || !fiscal) throw new Error('Configuração fiscal não encontrada')

    // ── 3. Marcar como pendente (caso ainda seja rascunho) ──────────────────
    await supabase
      .from('nf_saida')
      .update({ status: 'pendente' })
      .eq('id', nf_saida_id)
      .eq('status', 'rascunho')

    // ── 4. Chamar integradora SEFAZ ─────────────────────────────────────────
    //   Substitua callSefaz() pela sua integração real:
    //   Focus NFe  → https://focusnfe.com.br/doc/
    //   NFe.io     → https://nfe.io/docs/
    //   Nuvem NF   → https://www.nuvemnf.com.br/
    const sefaz = await callSefaz(nota, fiscal)

    // ── 5. Salvar XML no Supabase Storage ───────────────────────────────────
    const now     = new Date()
    const ano     = now.getFullYear()
    const mes     = String(now.getMonth() + 1).padStart(2, '0')
    const xmlPath = `${nota.company_id}/${ano}/${mes}/${sefaz.chaveAcesso}.xml`

    const { error: storageErr } = await supabase.storage
      .from('nfe-xmls')
      .upload(xmlPath, new TextEncoder().encode(sefaz.xmlAutorizado), {
        contentType: 'application/xml; charset=utf-8',
        upsert: true,
      })

    if (storageErr) throw new Error('Erro ao salvar XML no Storage: ' + storageErr.message)

    // ── 6. Atualizar nota com dados da autorização ──────────────────────────
    const { error: updateErr } = await supabase
      .from('nf_saida')
      .update({
        status:        'autorizada',
        numero:        sefaz.numero,
        chave_acesso:  sefaz.chaveAcesso,
        xml_url:       xmlPath,
        xml_protocolo: sefaz.protocolo,
        autorizada_em: now.toISOString(),
      })
      .eq('id', nf_saida_id)

    if (updateErr) throw updateErr

    // ── 7. Retornar dados para o frontend ───────────────────────────────────
    return new Response(
      JSON.stringify({
        ok:           true,
        chave_acesso: sefaz.chaveAcesso,
        protocolo:    sefaz.protocolo,
        numero:       sefaz.numero,
        xml_url:      xmlPath,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err: any) {
    console.error('[emitir-nfe]', err)
    return new Response(
      JSON.stringify({ error: err.message ?? 'Erro interno' }),
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } },
    )
  }
})

// ── Stub de integração com SEFAZ ─────────────────────────────────────────────
// Substitua este bloco pela sua integradora real.
// Exemplo com Focus NFe:
//
//   const res = await fetch(`https://api.focusnfe.com.br/v2/nfe?ref=${nf_saida_id}`, {
//     method: 'POST',
//     headers: {
//       'Authorization': 'Basic ' + btoa(Deno.env.get('FOCUSNFE_TOKEN')! + ':'),
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify(buildFocusPayload(nota, fiscal)),
//   })
//   const json = await res.json()
//   if (!res.ok) throw new Error(json.mensagem_sefaz ?? 'Erro Focus NFe')
//   return { xmlAutorizado: json.xml, chaveAcesso: json.chave_nfe, protocolo: json.numero_protocolo, numero: json.numero }
//
async function callSefaz(nota: NfSaidaRow, fiscal: FiscalConfig): Promise<SefazResponse> {
  // Para homologação/testes, retorne uma resposta simulada:
  if (fiscal.ambiente === 2) {
    const fakeChave = '35' + new Date().getFullYear() +
      fiscal.cnpj.replace(/\D/g, '').padStart(14, '0') +
      '55' + nota.serie.padStart(3, '0') +
      String(Math.floor(Math.random() * 999999999)).padStart(9, '0') +
      '1' +
      String(Math.floor(Math.random() * 99999999)).padStart(8, '0') +
      '0'

    const fakeXml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <!-- XML de homologação simulado -->
  <!-- Chave: ${fakeChave} -->
  <!-- Nota: ${nota.id} -->
  <!-- Emitente: ${fiscal.razao_social} -->
  <!-- Destinatário: ${nota.dest_nome} -->
  <!-- Valor: ${nota.valor_total} -->
</nfeProc>`

    return {
      xmlAutorizado: fakeXml,
      chaveAcesso:   fakeChave.substring(0, 44),
      protocolo:     String(Math.floor(Math.random() * 999999999999)).padStart(15, '1'),
      numero:        String(Math.floor(Math.random() * 999999)).padStart(9, '0'),
    }
  }

  // Produção: implemente a chamada real aqui
  throw new Error(
    'Integração com SEFAZ em produção não implementada. ' +
    'Configure sua integradora (Focus NFe, NFe.io, etc.) e substitua esta função.'
  )
}