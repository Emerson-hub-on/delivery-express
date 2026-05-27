/**
 * Edge Function: cancelar-nfce
 *
 * Cancela uma NFC-e já autorizada pela SEFAZ.
 * Prazo máximo: 30 minutos após a autorização (NT 2021.001).
 *
 * Etapas:
 *   1. Monta o XML de Evento de Cancelamento (tpEvento 110111)
 *   2. Assina o evento com o certificado PFX da empresa
 *   3. Transmite ao webservice NfeRecepcaoEvento4
 *   4. Persiste resultado no banco
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as forge from "npm:node-forge@1.3.1";

// ─── URLs do webservice de eventos por UF ─────────────────────────────────────
// Nota: NFC-e usa o mesmo endpoint de eventos da NF-e

const WS_EVENTOS: Record<string, { prod: string; hom: string }> = {
  SP: { prod: "https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx",              hom: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx" },
  MG: { prod: "https://nfe.fazenda.mg.gov.br/nfe/services/NfeRecepcaoEvento4",          hom: "https://hnfe.fazenda.mg.gov.br/nfe/services/NfeRecepcaoEvento4" },
  RJ: { prod: "https://nfe.fazenda.rj.gov.br/nfe/services/NfeRecepcaoEvento4",          hom: "https://nfeh.fazenda.rj.gov.br/nfe/services/NfeRecepcaoEvento4" },
  RS: { prod: "https://nfe.sefaz.rs.gov.br/ws/NfceRecepcaoEvento/NfceRecepcaoEvento4.asmx", hom: "https://nfe-homologacao.sefaz.rs.gov.br/ws/NfceRecepcaoEvento/NfceRecepcaoEvento4.asmx" },
  PR: { prod: "https://nfe.fazenda.pr.gov.br/nfe/services/NfeRecepcaoEvento4",          hom: "https://homologacao.nfe.fazenda.pr.gov.br/nfe/services/NfeRecepcaoEvento4" },
  PE: { prod: "https://nfe.sefaz.pe.gov.br/nfe-server/services/NfeRecepcaoEvento4",    hom: "https://nfeh.sefaz.pe.gov.br/nfe-server/services/NfeRecepcaoEvento4" },
  BA: { prod: "https://nfe.sefaz.ba.gov.br/ws/NfeRecepcaoEvento/NfeRecepcaoEvento4.asmx", hom: "https://hnfe.sefaz.ba.gov.br/ws/NfeRecepcaoEvento/NfeRecepcaoEvento4.asmx" },
  CE: { prod: "https://nfe.sefaz.ce.gov.br/nfe/services/NfeRecepcaoEvento4",            hom: "https://nfeh.sefaz.ce.gov.br/nfe/services/NfeRecepcaoEvento4" },
  PB: { prod: "https://nfe.sefaz.pb.gov.br/nfe/services/NfeRecepcaoEvento4",            hom: "https://nfeh.sefaz.pb.gov.br/nfe/services/NfeRecepcaoEvento4" },
  // Demais UFs: use o SVRS (Rio Grande do Sul) como autorizador
  DEFAULT: { prod: "https://nfe.sefaz.rs.gov.br/ws/NfceRecepcaoEvento/NfceRecepcaoEvento4.asmx", hom: "https://nfe-homologacao.sefazvirtual.fazenda.gov.br/NfeRecepcaoEvento4.asmx" },
};

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
    const { companyId, orderId, chaveAcesso, nProt, motivo } = await req.json();

    if (!companyId || !orderId || !chaveAcesso || !nProt || !motivo) {
      throw new Error("Parâmetros obrigatórios: companyId, orderId, chaveAcesso, nProt, motivo");
    }
    if (motivo.trim().length < 15) {
      throw new Error("O motivo do cancelamento deve ter pelo menos 15 caracteres");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Busca configuração fiscal
    const { data: fiscal, error: fiscalErr } = await supabase
      .from("fiscal_configs")
      .select("*")
      .eq("company_id", companyId)
      .single();

    if (fiscalErr || !fiscal) throw new Error("Configuração fiscal não encontrada");
    if (!fiscal.cert_pfx_base64 || !fiscal.cert_senha) throw new Error("Certificado digital não configurado");

    // Busca o pedido para verificar prazo (30 min)
    const { data: order } = await supabase
      .from("orders")
      .select("nfce_emitido_at, nfce_status")
      .eq("id", orderId)
      .single();

    if (order?.nfce_status !== "emitido") {
      throw new Error("Apenas NFC-e com status 'emitido' pode ser cancelada");
    }

    const emitidoAt = order?.nfce_emitido_at ? new Date(order.nfce_emitido_at) : null;
    if (emitidoAt) {
      const diffMin = (Date.now() - emitidoAt.getTime()) / 60000;
      if (diffMin > 30) {
        throw new Error(`Prazo de cancelamento expirado. A NFC-e foi emitida há ${Math.round(diffMin)} minutos (máx: 30)`);
      }
    }

    // Monta o XML do evento de cancelamento
    const xmlEvento = buildEventoCancelamento({
      cnpj:         fiscal.cnpj,
      chaveAcesso,
      nProt,
      motivo:       motivo.trim(),
      tpAmb:        fiscal.ambiente === 1 ? "1" : "2",
      cUF:          getCuf(fiscal.uf),
      dhEvento:     fmtDate(new Date()),
    });

    // Assina o evento
    const xmlAssinado = assinarEvento(xmlEvento, fiscal.cert_pfx_base64, fiscal.cert_senha);

    // Transmite
    const wsEntry = WS_EVENTOS[fiscal.uf] ?? WS_EVENTOS["DEFAULT"];
    const wsUrl = fiscal.ambiente === 1 ? wsEntry.prod : wsEntry.hom;
    const resultado = await transmitirEvento(xmlAssinado, wsUrl);

    // Persiste resultado
    const cancelado = resultado.cStat === 135;
    if (cancelado) {
      await supabase.from("orders").update({
        nfce_status:              "cancelado",
        cancellation_reason:      motivo,
        nfce_canc_cstat:          resultado.cStat,
        nfce_canc_xmotivo:        resultado.xMotivo,
        nfce_canc_protocolo:      resultado.nProt,
        nfce_canc_dhregevento:    resultado.dhRegEvento || new Date().toISOString(),
        nfce_cancelado_at:        new Date().toISOString(),
      }).eq("id", orderId);
    }

    return jsonResponse({
      ok:       cancelado,
      cStat:    resultado.cStat,
      xMotivo:  resultado.xMotivo,
      nProt:    resultado.nProt,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cancelar-nfce]", msg);
    return jsonResponse({ ok: false, error: msg }, 400);
  }
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}-03:00`;
}

function getCuf(uf: string): string {
  const map: Record<string, string> = {
    AC:"12",AL:"27",AM:"13",AP:"16",BA:"29",CE:"23",DF:"53",ES:"32",
    GO:"52",MA:"21",MG:"31",MS:"50",MT:"51",PA:"15",PB:"25",PE:"26",
    PI:"22",PR:"41",RJ:"33",RN:"24",RO:"11",RR:"14",RS:"43",SC:"42",
    SE:"28",SP:"35",TO:"17",
  };
  return map[uf] ?? "35";
}

function buildEventoCancelamento(p: {
  cnpj: string; chaveAcesso: string; nProt: string; motivo: string;
  tpAmb: string; cUF: string; dhEvento: string;
}): string {
  const nSeqEvento = "1";
  const tpEvento   = "110111";
  const descEvento = "Cancelamento";
  const idEvento   = `ID${tpEvento}${p.chaveAcesso}${nSeqEvento.padStart(2, "0")}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <idLote>1</idLote>
  <evento versao="1.00">
    <infEvento Id="${idEvento}">
      <cOrgao>${p.cUF}</cOrgao>
      <tpAmb>${p.tpAmb}</tpAmb>
      <CNPJ>${p.cnpj}</CNPJ>
      <chNFe>${p.chaveAcesso}</chNFe>
      <dhEvento>${p.dhEvento}</dhEvento>
      <tpEvento>${tpEvento}</tpEvento>
      <nSeqEvento>${nSeqEvento}</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>${descEvento}</descEvento>
        <nProt>${p.nProt}</nProt>
        <xJust>${p.motivo.substring(0, 255)}</xJust>
      </detEvento>
    </infEvento>
  </evento>
</envEvento>`;
}

function assinarEvento(xml: string, pfxBase64: string, pfxSenha: string): string {
  const pfxDer  = forge.util.decode64(pfxBase64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx     = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, pfxSenha);

  const bags    = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const cert    = bags[forge.pki.oids.certBag]?.[0]?.cert!;
  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const privKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key as forge.pki.rsa.PrivateKey;

  if (!cert || !privKey) throw new Error("Certificado ou chave privada inválidos no PFX");

  const certB64 = forge.pki.certificateToPem(cert)
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s+/g, "");

  const infMatch = xml.match(/<infEvento[\s\S]*?<\/infEvento>/);
  if (!infMatch) throw new Error("Tag <infEvento> não encontrada");
  const infXml = infMatch[0];

  const idMatch = infXml.match(/Id="([^"]+)"/);
  if (!idMatch) throw new Error("Id não encontrado em <infEvento>");
  const refId = idMatch[1];

  const c14n = infXml.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/<\?xml[^>]*\?>\s*/g, "")
    .replace(/<([A-Za-z0-9:_-]+)([^>]*?)\/>/g, "<$1$2></$1>")
    .trim();

  const md = forge.md.sha1.create();
  md.update(c14n, "utf8");
  const digestValue = forge.util.encode64(md.digest().bytes());

  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${refId}">` +
    `<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

  const c14nSI = signedInfo.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const mdSig  = forge.md.sha1.create();
  mdSig.update(c14nSI, "utf8");
  const sigValue = forge.util.encode64(privKey.sign(mdSig));

  const sigBlock = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfo +
    `<SignatureValue>${sigValue}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${certB64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;

  return xml.replace("</infEvento>", sigBlock + "</infEvento>");
}

async function transmitirEvento(xmlAssinado: string, wsUrl: string) {
  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NfeRecepcaoEvento4">
  <soapenv:Header/>
  <soapenv:Body>
    <nfe:nfeDadosMsg>${xmlAssinado.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</nfe:nfeDadosMsg>
  </soapenv:Body>
</soapenv:Envelope>`;

  const resp = await fetch(wsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/soap+xml; charset=utf-8",
      "SOAPAction": "\"http://www.portalfiscal.inf.br/nfe/wsdl/NfeRecepcaoEvento4/nfeRecepcaoEvento\"",
    },
    body: soap,
  });

  if (!resp.ok) throw new Error(`SEFAZ HTTP ${resp.status}`);
  const xml = await resp.text();
  const extract = (tag: string) => xml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`))?.[1] ?? "";

  return {
    cStat:       parseInt(extract("cStat") || "0"),
    xMotivo:     extract("xMotivo"),
    nProt:       extract("nProt"),
    dhRegEvento: extract("dhRegEvento"),
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}