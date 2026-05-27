/**
 * services/nfce-transmissao.ts
 *
 * Serviço client-side para transmitir NFC-e via Edge Function.
 * Substitui o handleEmitirNfce atual no PDVTab para não enviar o XML cru
 * para a SEFAZ (isso nunca deve acontecer no browser — precisa de cert).
 *
 * Fluxo:
 *   1. buildNfceXml()        → XML rascunho (sem DV, sem assinatura)
 *   2. saveNfceXml()         → salva rascunho no Storage
 *   3. transmitirNfce()      → chama a Edge Function que:
 *                               a. calcula DV
 *                               b. assina com PFX
 *                               c. transmite à SEFAZ
 *                               d. persiste resultado no banco
 */

import { supabase } from "@/lib/supabase";
import { buildNfceXml, NfceItem } from "@/services/nfce-builder";
import { getFiscalConfig } from "@/services/fiscal";

// ─── tipos ────────────────────────────────────────────────────────────────────

export type TransmissaoResult = {
  ok: boolean;
  /** true quando salvo em contingência sem transmissão SEFAZ */
  contingencia?: boolean;
  chaveAcesso?: string;
  nProt?: string;
  cStat?: number;
  xMotivo?: string;
  status?: "emitido" | "rejeitado" | "pendente";
  error?: string;
};

export type EmitirNfceParams = {
  companyId: string;
  orderId: number;
  nfceNumero: number;
  serie: string;
  items: NfceItem[];
  paymentMethod: "dinheiro" | "pix" | "cartao";
  total: number;
  troco: number;
  consumer: { name: string; cpf: string } | null;
  contingencia: boolean;
};

// ─── função principal ─────────────────────────────────────────────────────────

export async function emitirNfce(params: EmitirNfceParams): Promise<TransmissaoResult> {
  const {
    companyId, orderId, nfceNumero, serie,
    items, paymentMethod, total, troco, consumer, contingencia,
  } = params;

  // 1. Busca configuração fiscal (contém dados do emissor para montar o XML)
  const config = await getFiscalConfig();
  if (!config) {
    return { ok: false, error: "Configuração fiscal não encontrada. Configure em Fiscal > Configurações." };
  }

  // 2. Monta o XML rascunho no client (sem DV real, sem assinatura)
  let xml: string;
  try {
    xml = buildNfceXml({
      config,
      nfceNumero,
      serie,
      items,
      paymentMethod,
      total,
      troco,
      consumer,
      contingencia,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Erro ao montar XML: ${msg}` };
  }

  // 3. Converte para Base64 para enviar à Edge Function
  const xmlBase64 = btoa(unescape(encodeURIComponent(xml)));

  // 4. Chama a Edge Function (assina + transmite server-side)
  try {
    const { data, error } = await supabase.functions.invoke("transmitir-nfce", {
      body: { orderId, xmlBase64, contingencia, companyId },
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return data as TransmissaoResult;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Falha na comunicação com o servidor: ${msg}` };
  }
}

// ─── cancelamento de NFC-e ────────────────────────────────────────────────────

export type CancelarNfceParams = {
  companyId: string;
  orderId: number;
  chaveAcesso: string;
  nProt: string;
  motivo: string; // mínimo 15 caracteres
};

export type CancelamentoResult = {
  ok: boolean;
  cStat?: number;
  xMotivo?: string;
  nProt?: string;
  error?: string;
};

/**
 * Solicita cancelamento de NFC-e já autorizada.
 * O cancelamento deve ocorrer em até 30 minutos da autorização (regra SEFAZ).
 */
export async function cancelarNfce(params: CancelarNfceParams): Promise<CancelamentoResult> {
  const { data, error } = await supabase.functions.invoke("cancelar-nfce", {
    body: params,
  });

  if (error) return { ok: false, error: error.message };
  return data as CancelamentoResult;
}