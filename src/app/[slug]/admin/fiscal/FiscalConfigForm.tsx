'use client'
import { useState } from 'react'
import { FiscalConfig, FiscalConfigPayload, CRT, AmbienteSEFAZ } from '@/types/fiscal'
import { saveFiscalConfig } from '@/services/fiscal'

interface FiscalConfigFormProps {
  config: FiscalConfig | null
  onSaved: (config: FiscalConfig) => void
  onError: (msg: string | null) => void
}

const EMPTY: FiscalConfigPayload = {
  razao_social: '', nome_fantasia: '', cnpj: '', ie: '', crt: 1,
  logradouro: '', numero: '', complemento: '', bairro: '',
  municipio: '', uf: 'PB', cep: '', codigo_ibge: '', telefone: '',
  ambiente: 2,
  cert_pfx_base64: null, cert_senha: null, cert_validade: null,
  csc_id: null, csc_token: null, nfce_serie: '001',
}

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="sm:col-span-2 lg:col-span-3 mt-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{children}</p>
      <div className="border-t border-gray-100 mt-2" />
    </div>
  )
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export function FiscalConfigForm({ config, onSaved, onError }: FiscalConfigFormProps) {
  const [form, setForm] = useState<FiscalConfigPayload>(
    config ? (({ id, created_at, updated_at, nfce_ambiente, ...rest }) => rest)(config as any) : EMPTY
  )
  const [saving, setSaving] = useState(false)
  const [certFile, setCertFile] = useState<string | null>(null)

  const set = (field: keyof FiscalConfigPayload, value: any) =>
    setForm(f => ({ ...f, [field]: value }))

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black'

  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1]
      set('cert_pfx_base64', b64)
      setCertFile(file.name)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!form.razao_social || !form.cnpj || !form.logradouro || !form.municipio || !form.cep)
      return onError('Preencha Razão Social, CNPJ, logradouro, município e CEP.')

    if (!/^\d{14}$/.test(form.cnpj))
      return onError('CNPJ deve ter 14 dígitos numéricos sem formatação.')

    if (!/^\d{8}$/.test(form.cep))
      return onError('CEP deve ter 8 dígitos numéricos sem formatação.')

    if (!form.codigo_ibge || !/^\d{7}$/.test(form.codigo_ibge))
      return onError('Código IBGE deve ter 7 dígitos.')

    if (form.ambiente === 1 && (!form.csc_id || !form.csc_token))
      return onError('Em ambiente de Produção, o CSC ID e o CSC Token são obrigatórios.')

    try {
      setSaving(true)
      onError(null)
      const saved = await saveFiscalConfig(form)
      onSaved(saved)
    } catch (e: any) {
      onError('Erro ao salvar configuração: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-base font-medium text-gray-900">Configuração do Emitente</h2>
          <p className="text-xs text-gray-400 mt-1">Dados da empresa para geração da NFC-e</p>
        </div>
        {config && (
          <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-3 py-1 rounded-full font-medium">
            Configurado
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* ── Identificação ────────────────────────────── */}
        <SectionTitle>Identificação da empresa</SectionTitle>

        <div className="sm:col-span-2">
          <Field label="Razão Social" required>
            <input type="text" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Nome Fantasia">
          <input type="text" value={form.nome_fantasia ?? ''} onChange={e => set('nome_fantasia', e.target.value)} className={inputCls} />
        </Field>

        <Field label="CNPJ" required hint="14 dígitos sem formatação — ex: 12345678000190">
          <input
            type="text" maxLength={14}
            value={form.cnpj}
            onChange={e => set('cnpj', e.target.value.replace(/\D/g, '').slice(0, 14))}
            className={inputCls}
          />
        </Field>

        <Field label="Inscrição Estadual">
          <input type="text" value={form.ie ?? ''} onChange={e => set('ie', e.target.value)} className={inputCls} />
        </Field>

        <Field label="CRT — Regime Tributário" required>
          <select value={form.crt} onChange={e => set('crt', Number(e.target.value) as CRT)} className={inputCls}>
            <option value={1}>1 — Simples Nacional</option>
            <option value={2}>2 — Simples Nacional (Excesso)</option>
            <option value={3}>3 — Regime Normal (Lucro Real/Presumido)</option>
          </select>
        </Field>

        {/* ── Endereço ──────────────────────────────────── */}
        <SectionTitle>Endereço do estabelecimento</SectionTitle>

        <div className="sm:col-span-2">
          <Field label="Logradouro" required>
            <input type="text" value={form.logradouro} onChange={e => set('logradouro', e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="Número" required>
          <input type="text" value={form.numero} onChange={e => set('numero', e.target.value)} className={inputCls} />
        </Field>

        <Field label="Complemento">
          <input type="text" value={form.complemento ?? ''} onChange={e => set('complemento', e.target.value)} className={inputCls} />
        </Field>

        <Field label="Bairro" required>
          <input type="text" value={form.bairro} onChange={e => set('bairro', e.target.value)} className={inputCls} />
        </Field>

        <Field label="Município" required>
          <input type="text" value={form.municipio} onChange={e => set('municipio', e.target.value)} className={inputCls} />
        </Field>

        <Field label="UF" required>
          <select value={form.uf} onChange={e => set('uf', e.target.value)} className={inputCls}>
            {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </Field>

        <Field label="CEP" required hint="8 dígitos sem formatação">
          <input
            type="text" maxLength={8}
            value={form.cep}
            onChange={e => set('cep', e.target.value.replace(/\D/g, '').slice(0, 8))}
            className={inputCls}
          />
        </Field>

        <Field label="Código IBGE do município" required hint="7 dígitos — consulte ibge.gov.br">
          <input
            type="text" maxLength={7}
            value={form.codigo_ibge}
            onChange={e => set('codigo_ibge', e.target.value.replace(/\D/g, '').slice(0, 7))}
            className={inputCls}
          />
        </Field>

        <Field label="Telefone">
          <input type="text" value={form.telefone ?? ''} onChange={e => set('telefone', e.target.value)} className={inputCls} />
        </Field>

        {/* ── SEFAZ ─────────────────────────────────────── */}
        <SectionTitle>Configuração SEFAZ</SectionTitle>

        <Field label="Ambiente" required>
          <select
            value={form.ambiente}
            onChange={e => set('ambiente', Number(e.target.value) as AmbienteSEFAZ)}
            className={inputCls}
          >
            <option value={2}>2 — Homologação (Testes) — recomendado para iniciar</option>
            <option value={1}>1 — Produção — notas com validade fiscal real</option>
          </select>
        </Field>

        <Field label="Série NFC-e" required>
          <input
            type="text" maxLength={3}
            value={form.nfce_serie}
            onChange={e => set('nfce_serie', e.target.value)}
            className={inputCls}
          />
        </Field>

        {/* CSC */}
        <Field
          label="CSC ID"
          required={form.ambiente === 1}
          hint="Identificador do CSC cadastrado na SEFAZ do seu estado"
        >
          <input
            type="text"
            value={form.csc_id ?? ''}
            onChange={e => set('csc_id', e.target.value || null)}
            className={inputCls}
          />
        </Field>

        <Field
          label="CSC Token"
          required={form.ambiente === 1}
          hint="Obrigatório para gerar o QR-Code da NFC-e"
        >
          <input
            type="password"
            value={form.csc_token ?? ''}
            onChange={e => set('csc_token', e.target.value || null)}
            className={inputCls}
          />
        </Field>

        {/* ── Certificado digital ───────────────────────── */}
        <SectionTitle>Certificado Digital A1</SectionTitle>

        <div className="sm:col-span-2 lg:col-span-3">
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-700">
            <strong>Atenção:</strong> armazene a senha do certificado de forma segura.
            Em produção, considere criptografar os campos com <code>pgcrypto</code> no Supabase
            ou usar um serviço externo de cofre de senhas.
          </div>
        </div>

        <div className="sm:col-span-2">
          <Field label="Arquivo .pfx (Certificado A1)" hint={certFile ? `Arquivo: ${certFile}` : 'Selecione o arquivo .pfx do certificado digital'}>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="flex-1 border border-dashed border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-400 hover:border-gray-400 transition-colors text-center">
                {form.cert_pfx_base64
                  ? certFile ?? '✓ Certificado carregado'
                  : 'Clique para selecionar o arquivo .pfx'}
              </div>
              <input
                type="file"
                accept=".pfx,.p12"
                className="hidden"
                onChange={handleCertUpload}
              />
            </label>
          </Field>
        </div>

        <Field label="Senha do certificado">
          <input
            type="password"
            placeholder="Senha do arquivo .pfx"
            value={form.cert_senha ?? ''}
            onChange={e => set('cert_senha', e.target.value || null)}
            className={inputCls}
          />
        </Field>

        <Field label="Validade do certificado" hint="Data de vencimento para alertas">
          <input
            type="date"
            value={form.cert_validade ?? ''}
            onChange={e => set('cert_validade', e.target.value || null)}
            className={inputCls}
          />
        </Field>

      </div>

      {/* ── Ações ─────────────────────────────────────────── */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-black text-white text-sm px-5 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvando...' : config ? 'Salvar alterações' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  )
}
