// types/fiscal.ts

export type NfceStatus = 'pendente' | 'emitido' | 'cancelado' | 'rejeitado'

export type AmbienteSEFAZ = 1 | 2  // 1 = Produção | 2 = Homologação

export type CRT = 1 | 2 | 3
// 1 = Simples Nacional
// 2 = Simples Nacional — Excesso de sublimite
// 3 = Regime Normal

export type FiscalConfig = {
  id: number
  razao_social: string
  nome_fantasia?: string | null
  /** 14 dígitos sem formatação */
  cnpj: string
  ie?: string | null
  crt: CRT
  logradouro: string
  numero: string
  complemento?: string | null
  bairro: string
  municipio: string
  uf: string
  /** 8 dígitos sem formatação */
  cep: string
  /** Código IBGE do município — 7 dígitos */
  codigo_ibge: string
  telefone?: string | null
  ambiente: AmbienteSEFAZ
  cert_pfx_base64?: string | null
  cert_senha?: string | null
  cert_validade?: string | null
  csc_id?: string | null
  csc_token?: string | null
  nfce_serie: string
  created_at: string
  updated_at: string
}

export type FiscalConfigPayload = Omit<FiscalConfig, 'id' | 'created_at' | 'updated_at'>
