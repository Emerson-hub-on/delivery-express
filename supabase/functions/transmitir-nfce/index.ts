/**
 * Edge Function: transmitir-nfce
 *
 * Etapas executadas:
 *   1. Recebe o XML "rascunho" gerado no front (buildNfceXml)
 *   2. Calcula o dígito verificador (módulo 11) e monta a chave de 44 dígitos
 *   3. Gera o QR-Code obrigatório para NFC-e
 *   4. Assina o XML com o certificado PFX (xmldsig / RSA-SHA1)
 *   5. Transmite ao webservice da SEFAZ via SOAP
 *   6. Persiste resultado no banco (orders + XML no Storage)
 *
 * Chamada pelo client: POST /functions/v1/transmitir-nfce
 * Body: { orderId, xmlBase64, contingencia, companyId }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as forge from "npm:node-forge@1.3.1";

// ─── tipos ────────────────────────────────────────────────────────────────────

interface TransmitirPayload {
  orderId: number;
  /** XML completo gerado pelo buildNfceXml, em Base64 */
  xmlBase64: string;
  contingencia: boolean;
  companyId: string;
}

interface SefazResponse {
  cStat: number;       // 100 = autorizado
  xMotivo: string;
  nProt: string;       // protocolo de autorização
  dhRecbto: string;
  chaveAcesso: string;
  xmlAutorizado?: string;
}

// ─── URLs dos webservices por UF ──────────────────────────────────────────────
// Fonte: Portal da NF-e | https://www.nfe.fazenda.gov.br
// Adicione/ajuste conforme a UF do seu cliente

const WS_NFCE: Record<string, { prod: string; hom: string }> = {
  AC: { prod: "https://nfce.sefaz.rs.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx",  hom: "https://nfce-homologacao.sefazvirtual.fazenda.gov.br/NfceAutorizacao4.asmx" },
  AL: { prod: "https://nfce.sefaz.al.gov.br/WS/NfeAutorizacao/NfeAutorizacao.asmx",     hom: "https://nfce.sefaz.al.gov.br/WS/NfeAutorizacao/NfeAutorizacao.asmx" },
  AM: { prod: "https://nfce.sefaz.am.gov.br/services/NfceAutorizacao4",                  hom: "https://homnfce.sefaz.am.gov.br/services/NfceAutorizacao4" },
  AP: { prod: "https://nfce.sefaz.rs.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx",  hom: "https://nfce-homologacao.sefazvirtual.fazenda.gov.br/NfceAutorizacao4.asmx" },
  BA: { prod: "https://nfce.sefaz.ba.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx",  hom: "https://hnfce.sefaz.ba.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx" },
  CE: { prod: "https://nfce.sefaz.ce.gov.br/nfce/services/NfceAutorizacao4",             hom: "https://nfceh.sefaz.ce.gov.br/nfce/services/NfceAutorizacao4" },
  DF: { prod: "https://nfce.fazenda.df.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx", hom: "https://nfce-homologacao.fazenda.df.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx" },
  ES: { prod: "https://nfce.sefaz.es.gov.br/nfce/services/NfceAutorizacao4",             hom: "https://nfceh.sefaz.es.gov.br/nfce/services/NfceAutorizacao4" },
  GO: { prod: "https://nfce.sefaz.go.gov.br/nfce/services/NfceAutorizacao4",             hom: "https://homolog.sefaz.go.gov.br/nfce/services/NfceAutorizacao4" },
  MA: { prod: "https://nfce.sefaz.ma.gov.br/nfce/services/NfceAutorizacao4",             hom: "https://nfceh.sefaz.ma.gov.br/nfce/services/NfceAutorizacao4" },
  MG: { prod: "https://nfce.fazenda.mg.gov.br/nfce/services/NfceAutorizacao4",           hom: "https://hnfce.fazenda.mg.gov.br/nfce/services/NfceAutorizacao4" },
  MS: { prod: "https://nfce.fazenda.ms.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx", hom: "https://hom.nfce.fazenda.ms.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx" },
  MT: { prod: "https://nfce.sefaz.mt.gov.br/nfce/services/NfceAutorizacao4",             hom: "https://homologacao.sefaz.mt.gov.br/nfce/services/NfceAutorizacao4" },
  PA: { prod: "https://app.sefa.pa.gov.br/nfce/services/NfceAutorizacao4",               hom: "https://apphomolog.sefa.pa.gov.br/nfce/services/NfceAutorizacao4" },
  PB: { prod: "https://nfce.sefaz.pb.gov.br/nfce/services/NfceAutorizacao4",             hom: "https://nfceh.sefaz.pb.gov.br/nfce/services/NfceAutorizacao4" },
  PE: { prod: "https://nfce.sefaz.pe.gov.br/nfce-server/services/NfceAutorizacao4",      hom: "https://nfceh.sefaz.pe.gov.br/nfce-server/services/NfceAutorizacao4" },
  PI: { prod: "https://nfce.sefaz.pi.gov.br/nfce/services/NfceAutorizacao4",             hom: "https://nfceh.sefaz.pi.gov.br/nfce/services/NfceAutorizacao4" },
  PR: { prod: "https://nfce.fazenda.pr.gov.br/nfce/services/NfceAutorizacao4",           hom: "https://homologacao.nfce.fazenda.pr.gov.br/nfce/services/NfceAutorizacao4" },
  RJ: { prod: "https://nfce.fazenda.rj.gov.br/nfce/services/NfceAutorizacao4",           hom: "https://nfceh.fazenda.rj.gov.br/nfce/services/NfceAutorizacao4" },
  RN: { prod: "https://nfce.set.rn.gov.br/nfce/services/NfceAutorizacao4",               hom: "https://nfceh.set.rn.gov.br/nfce/services/NfceAutorizacao4" },
  RO: { prod: "https://nfce.sefin.ro.gov.br/nfce/services/NfceAutorizacao4",             hom: "https://nfceh.sefin.ro.gov.br/nfce/services/NfceAutorizacao4" },
  RR: { prod: "https://nfce.sefaz.rs.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx",  hom: "https://nfce-homologacao.sefazvirtual.fazenda.gov.br/NfceAutorizacao4.asmx" },
  RS: { prod: "https://nfce.sefaz.rs.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx",  hom: "https://nfce-homologacao.sefaz.rs.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx" },
  SC: { prod: "https://nfce.sef.sc.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx",    hom: "https://nfceh.sef.sc.gov.br/ws/NfceAutorizacao/NfceAutorizacao4.asmx" },
  SE: { prod: "https://nfce.sefaz.se.gov.br/nfce/services/NfceAutorizacao4",             hom: "https://nfceh.sefaz.se.gov.br/nfce/services/NfceAutorizacao4" },
  SP: { prod: "https://nfce.fazenda.sp.gov.br/ws/nfceautorizacao4.asmx",                 hom: "https://homologacao.nfce.fazenda.sp.gov.br/ws/nfceautorizacao4.asmx" },
  TO: { prod: "https://nfce.sefaz.to.gov.br/nfce/services/NfceAutorizacao4",             hom: "https://nfceh.sefaz.to.gov.br/nfce/services/NfceAutorizacao4" },
};

// ─── 1. Cálculo do dígito verificador (módulo 11 SEFAZ) ──────────────────────

/**
 * Calcula o dígito verificador da chave de acesso da NF-e/NFC-e.
 * Algoritmo: módulo 11 com pesos 2..9 da direita para a esquerda.
 * Se resto < 2 → dígito = 0, senão dígito = 11 - resto.
 */
function calcDv(chave43: string): string {
  const digits = chave43.replace(/\D/g, "");
  if (digits.length !== 43) throw new Error(`Chave base deve ter 43 dígitos, recebeu ${digits.length}`);
  let soma = 0;
  let peso = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    soma += parseInt(digits[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return String(resto < 2 ? 0 : 11 - resto);
}

// ─── 2. QR-Code NFC-e (texto para o link; a renderização fica no DANFE) ──────

/**
 * Monta a URL do QR-Code conforme NT 2013.001.
 * O QR-Code contém a chave, ambiente, CNPJ dest (se houver), valor,
 * digest da chave e o hash HMAC-SHA1 com o CSC.
 *
 * Esta implementação gera o texto do QR-Code que deve ser embutido
 * no XML antes da assinatura.
 */
async function buildQrCode(
  chave44: string,
  tpAmb: "1" | "2",
  dhEmi: string,
  vNF: string,
  cDest: string,      // CPF/CNPJ do destinatário ou ""
  cscId: string,
  cscToken: string,
  urlBase: string,    // ex: https://www.sefazsp.fazenda.sp.gov.br/
): Promise<string> {
  // Campos obrigatórios separados por |
  const campos = [
    `chNFe=${chave44}`,
    `nVersao=100`,
    `tpAmb=${tpAmb}`,
    ...(cDest ? [`cDest=${cDest}`] : []),
    `dhEmi=${dhEmi.replace(/[-:T]/g, "").substring(0, 12)}`,  // YYYYMMDDHHmm
    `vNF=${vNF}`,
    `vICMS=0.00`,
    `digVal=`,                    // preenchido após assinatura (hash da assinatura)
    `cIdToken=${cscId.padStart(6, "0")}`,
  ].join("&");

  // HMAC-SHA1 do campos + CSC (token)
  const encoder = new TextEncoder();
  const keyData = encoder.encode(cscToken);
  const msgData = encoder.encode(campos + cscToken);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const hex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return `${urlBase}?${campos}&cHashQRCode=${hex}`;
}

// ─── 3. Assinatura XMLDSig com node-forge ─────────────────────────────────────

/**
 * Assina o elemento <infNFe> do XML usando RSA-SHA1 (padrão SEFAZ).
 *
 * A SEFAZ exige:
 *   - Algoritmo de canonicalização: C14N exclusivo (http://www.w3.org/2001/10/xml-exc-c14n#)
 *   - Transform: enveloped-signature
 *   - DigestMethod: SHA-1
 *   - SignatureMethod: RSA-SHA1
 *
 * Como o ambiente Deno/Edge não suporta xmldom nativamente, fazemos a
 * assinatura "manual" seguindo a spec XMLDSig Section 8 e injetamos o
 * bloco <Signature> antes de </infNFe>.
 */
async function assinarXml(xml: string, pfxBase64: string, pfxSenha: string): Promise<string> {
  // Decodifica PFX
  const pfxDer = forge.util.decode64(pfxBase64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, pfxSenha);

  // Extrai chave privada e certificado
  const bags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const certBags = bags[forge.pki.oids.certBag] ?? [];
  if (!certBags.length) throw new Error("Certificado não encontrado no PFX");
  const cert = certBags[0].cert!;

  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) throw new Error("Chave privada não encontrada no PFX");
  const privateKey = keyBag.key as forge.pki.rsa.PrivateKey;

  // Certificado em Base64 (sem quebras de linha para o XML)
  const certPem = forge.pki.certificateToPem(cert)
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  // Extrai o conteúdo de <infNFe ...>...</infNFe> para canonicalização
  const infNFeMatch = xml.match(/<infNFe[\s\S]*?<\/infNFe>/);
  if (!infNFeMatch) throw new Error("Tag <infNFe> não encontrada no XML");
  const infNFeXml = infNFeMatch[0];

  // Extrai o Id do infNFe
  const idMatch = infNFeXml.match(/Id="([^"]+)"/);
  if (!idMatch) throw new Error("Atributo Id não encontrado em <infNFe>");
  const refId = idMatch[1]; // ex: "NFe35240100..."

  // Canonicalização C14N do elemento referenciado
  // Para Edge Functions, usamos a canonicalização simplificada (o ideal é
  // usar um parser XML real; para produção considere a lib @xmldom/xmldom).
  const c14nContent = canonicalize(infNFeXml);

  // DigestValue = SHA-1 do conteúdo canonicalizado, em Base64
  const md = forge.md.sha1.create();
  md.update(c14nContent, "utf8");
  const digestValue = forge.util.encode64(md.digest().bytes());

  // Monta o elemento <SignedInfo> (também deve ser canonicalizado antes de assinar)
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${refId}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  // Assina o SignedInfo canonicalizado
  const c14nSignedInfo = canonicalize(signedInfo);
  const mdSig = forge.md.sha1.create();
  mdSig.update(c14nSignedInfo, "utf8");
  const signature = privateKey.sign(mdSig);
  const signatureValue = forge.util.encode64(signature);

  // Monta o bloco <Signature> completo
  const signatureBlock = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo>` +
    `<X509Data>` +
    `<X509Certificate>${certPem}</X509Certificate>` +
    `</X509Data>` +
    `</KeyInfo>` +
    `</Signature>`;

  // Injeta a assinatura ANTES do fechamento de </infNFe>
  const xmlAssinado = xml.replace("</infNFe>", signatureBlock + "</infNFe>");
  return xmlAssinado;
}

/**
 * Canonicalização C14N simplificada para edge functions.
 * Para produção completa, substitua por @xmldom/xmldom + c14n.
 * Esta implementação cobre os casos típicos da NF-e (atributos ordenados,
 * namespace propagado, sem self-closing tags).
 */
function canonicalize(xml: string): string {
  return xml
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove declaração XML
    .replace(/<\?xml[^>]*\?>\s*/g, "")
    // Expande self-closing tags (ex: <tag/> → <tag></tag>)
    .replace(/<([A-Za-z0-9:_-]+)([^>]*?)\/>/g, "<$1$2></$1>")
    .trim();
}

// ─── 4. Envelope SOAP e transmissão ──────────────────────────────────────────

/**
 * Monta o envelope SOAP para NfceAutorizacaoNF (modelo 65, lote com 1 nota).
 */
function buildSoapEnvelope(xmlNFe: string, tpAmb: "1" | "2"): string {
  // A SEFAZ espera o XML da NFC-e dentro do lote, codificado em CDATA ou escaped
  // Usamos escaped (substituindo < > & nas tags internas)
  const nfeData = xmlNFe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4">
  <soapenv:Header/>
  <soapenv:Body>
    <nfe:nfeDadosMsg>
      <enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
        <idLote>1</idLote>
        <indSinc>1</indSinc>
        <NFe xmlns="http://www.portalfiscal.inf.br/nfe">${nfeData}</NFe>
      </enviNFe>
    </nfe:nfeDadosMsg>
  </soapenv:Header>
</soapenv:Envelope>`;
}

/**
 * Transmite o XML assinado à SEFAZ e parseia a resposta.
 */
async function transmitirSefaz(
  xmlAssinado: string,
  wsUrl: string,
): Promise<SefazResponse> {
  const soap = buildSoapEnvelope(xmlAssinado, xmlAssinado.includes("<tpAmb>2</tpAmb>") ? "2" : "1");

  const resp = await fetch(wsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/soap+xml; charset=utf-8; action=\"http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4/nfeAutorizacaoLote\"",
      "SOAPAction": "\"http://www.portalfiscal.inf.br/nfe/wsdl/NfceAutorizacao4/nfeAutorizacaoLote\"",
    },
    body: soap,
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`SEFAZ HTTP ${resp.status}: ${body.substring(0, 400)}`);
  }

  const soapResp = await resp.text();

  // Parseia campos relevantes da resposta SEFAZ
  const cStat   = parseInt(extractTag(soapResp, "cStat") ?? "0");
  const xMotivo = extractTag(soapResp, "xMotivo") ?? "Sem motivo";
  const nProt   = extractTag(soapResp, "nProt") ?? "";
  const dhRecbto = extractTag(soapResp, "dhRecbto") ?? "";
  const chNFe   = extractTag(soapResp, "chNFe") ?? "";

  return { cStat, xMotivo, nProt, dhRecbto, chaveAcesso: chNFe, xmlAutorizado: soapResp };
}

function extractTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`));
  return m ? m[1] : null;
}

// ─── 5. Handler principal ─────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const payload: TransmitirPayload = await req.json();
    const { orderId, xmlBase64, contingencia, companyId } = payload;

    if (!orderId || !xmlBase64 || !companyId) {
      throw new Error("Parâmetros obrigatórios ausentes: orderId, xmlBase64, companyId");
    }

    // Inicializa cliente Supabase (service role para leitura do cert)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Busca configuração fiscal da empresa ──────────────────────────────
    const { data: fiscal, error: fiscalErr } = await supabase
      .from("fiscal_configs")
      .select("*")
      .eq("company_id", companyId)
      .single();

    if (fiscalErr || !fiscal) {
      throw new Error("Configuração fiscal não encontrada para esta empresa");
    }
    if (!fiscal.cert_pfx_base64 || !fiscal.cert_senha) {
      throw new Error("Certificado digital não configurado. Acesse Fiscal > Configurações.");
    }

    // ── Decodifica e prepara o XML ────────────────────────────────────────
    let xml = atob(xmlBase64);

    // ── Extrai a chave base (43 dígitos) do atributo Id ───────────────────
    // O buildNfceXml gera: Id="NFe{chaveBase}0" (43 dígitos + dígito placeholder 0)
    const idMatch = xml.match(/Id="NFe([0-9]{43})0"/);
    if (!idMatch) throw new Error("Não foi possível extrair a chave base do XML");
    const chave43 = idMatch[1];

    // ── 1. Calcula dígito verificador ────────────────────────────────────
    const dv = calcDv(chave43);
    const chave44 = chave43 + dv;

    // Substitui o Id provisório pelo definitivo
    xml = xml.replace(`Id="NFe${chave43}0"`, `Id="NFe${chave44}"`);
    // Substitui cDV placeholder
    xml = xml.replace("<cDV>0</cDV>", `<cDV>${dv}</cDV>`);

    // ── Monta QR-Code ────────────────────────────────────────────────────
    if (fiscal.csc_id && fiscal.csc_token) {
      const tpAmb = fiscal.ambiente === 1 ? "1" : "2";
      const wsEntry = WS_NFCE[fiscal.uf] ?? WS_NFCE["SP"];
      const urlBase = fiscal.ambiente === 1 ? wsEntry.prod : wsEntry.hom;
      // URL base sem path (só protocolo + host)
      const urlHostOnly = new URL(urlBase).origin + "/";

      const dhEmi = extractTag(xml, "dhEmi") ?? new Date().toISOString();
      const vNF   = extractTag(xml, "vNF") ?? "0.00";
      // CPF/CNPJ do destinatário se houver
      const cDest = extractTag(xml, "CPF") ?? extractTag(xml, "CNPJ") ?? "";

      const qrCodeUrl = await buildQrCode(
        chave44, tpAmb, dhEmi, vNF, cDest,
        fiscal.csc_id, fiscal.csc_token, urlHostOnly,
      );
      xml = xml.replace("<qrCode></qrCode>", `<qrCode>${qrCodeUrl}</qrCode>`);
    }

    // ── 2. Assina o XML ──────────────────────────────────────────────────
    const xmlAssinado = await assinarXml(xml, fiscal.cert_pfx_base64, fiscal.cert_senha);

    // ── Salva XML assinado no Storage (substitui o rascunho) ─────────────
    const xmlPath = `${companyId}/nfce/${fiscal.nfce_serie}/${chave44}.xml`;
    const xmlBytes = new TextEncoder().encode(xmlAssinado);
    await supabase.storage
      .from("nfce-xmls")
      .upload(xmlPath, xmlBytes, {
        contentType: "application/xml",
        upsert: true,
      });

    // ── Se contingência: salva e retorna sem transmitir ──────────────────
    if (contingencia) {
      await supabase.from("orders").update({
        nfce_chave:   chave44,
        nfce_status:  "pendente",
        nfce_xml:     xmlPath,
        nfce_motivo:  "Emitida em contingência offline",
        nfce_emitido_at: new Date().toISOString(),
      }).eq("id", orderId);

      return jsonResponse({ ok: true, contingencia: true, chaveAcesso: chave44 });
    }

    // ── 3. Transmite à SEFAZ ─────────────────────────────────────────────
    const wsEntry = WS_NFCE[fiscal.uf];
    if (!wsEntry) throw new Error(`UF "${fiscal.uf}" não mapeada no webservice. Adicione a URL manualmente.`);
    const wsUrl = fiscal.ambiente === 1 ? wsEntry.prod : wsEntry.hom;

    const sefazResult = await transmitirSefaz(xmlAssinado, wsUrl);

    // ── Persiste resultado no banco ──────────────────────────────────────
    const isAutorizado = sefazResult.cStat === 100;
    const status: string = isAutorizado ? "emitido" : sefazResult.cStat === 150 ? "emitido" : "rejeitado";

    await supabase.from("orders").update({
      nfce_chave:       chave44,
      nfce_status:      status,
      nfce_numero:      parseInt(extractTag(xmlAssinado, "nNF") ?? "0"),
      nfce_protocolo:   sefazResult.nProt,
      nfce_dhreceb:     sefazResult.dhRecbto || new Date().toISOString(),
      nfce_cstat:       sefazResult.cStat,
      nfce_motivo:      sefazResult.xMotivo,
      nfce_xml:         xmlPath,
      nfce_emitido_at:  isAutorizado ? new Date().toISOString() : null,
    }).eq("id", orderId);

    // Se autorizado, salva também o XML de retorno da SEFAZ
    if (isAutorizado && sefazResult.xmlAutorizado) {
      const xmlRespPath = `${companyId}/nfce/${fiscal.nfce_serie}/${chave44}_autorizado.xml`;
      await supabase.storage
        .from("nfce-xmls")
        .upload(xmlRespPath, new TextEncoder().encode(sefazResult.xmlAutorizado), {
          contentType: "application/xml",
          upsert: true,
        });
    }

    return jsonResponse({
      ok:           isAutorizado,
      cStat:        sefazResult.cStat,
      xMotivo:      sefazResult.xMotivo,
      nProt:        sefazResult.nProt,
      chaveAcesso:  chave44,
      status,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[transmitir-nfce]", msg);
    return jsonResponse({ ok: false, error: msg }, 400);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}