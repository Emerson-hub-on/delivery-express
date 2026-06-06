import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getFiscalConfig, saveFiscalConfig } from '@/services/fiscal'
import { FiscalConfigPayload, CRT, AmbienteSEFAZ } from '@/types/fiscal'
import { Save, Upload, ShieldCheck, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { NfcePdvSection } from '@/components/billing/fiscal/NfcePdvSection'

interface FiscalTabProps {
  onError: (msg: string) => void
}

const CRT_OPTIONS: { value: CRT; label: string }[] = [
  { value: 1, label: '1 — Simples Nacional' },
  { value: 2, label: '2 — Simples Nacional (Excesso de sublimite)' },
  { value: 3, label: '3 — Regime Normal' },
]

const UF_OPTIONS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
]

const EMPTY: FiscalConfigPayload = {
  razao_social: '',
  nome_fantasia: '',
  cnpj: '',
  ie: '',
  crt: 1,
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  municipio: '',
  uf: 'SP',
  cep: '',
  codigo_ibge: '',
  telefone: '',
  ambiente: 2,
  cert_pfx_base64: '',
  cert_senha: '',
  cert_validade: '',
  csc_id: '',
  csc_token: '',
  nfce_serie: '001',
}

type Section = 'emitente' | 'endereco' | 'nfce' | 'certificado'

function cnpjMask(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function cepMask(v: string) {
  return v.replace(/\D/g, '').slice(0, 8)
    .replace(/^(\d{5})(\d)/, '$1-$2')
}

function phoneMask(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

export function FiscalTab({ onError }: FiscalTabProps) {
  const [form, setForm]           = useState<FiscalConfigPayload>(EMPTY)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [section, setSection]     = useState<Section>('emitente')
  const [uploadingCert, setUploadingCert] = useState(false)
  const certRef = useRef<HTMLInputElement>(null)

  // ── Sequências de numeração ───────────────────────────────────────────────
  // NFC-e: lido e salvo em nfce_pdv (campo ultimo)
  const [nfceSeq,   setNfceSeq]   = useState<number>(0)
  // NF-e: lido e salvo em nfe_numero_seq
  const [nfeSeq,    setNfeSeq]    = useState<number>(0)
  const [nfeSerie,  setNfeSerie]  = useState<string>('001')
  const [loadingSeq, setLoadingSeq] = useState(false)
  const [savedSeq,  setSavedSeq]  = useState(false)

  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const config = await getFiscalConfig()
        if (config) {
          const { id, company_id, created_at, updated_at, ...rest } = config as any
          setForm({ ...EMPTY, ...rest })
          setCompanyId(company_id)

          const serieNfce = (rest.nfce_serie ?? '001').padStart(3, '0')

          // NFC-e: busca o último número do nfce_pdv pela série ativa
          const { data: pdv } = await supabase
            .from('nfce_pdv')
            .select('ultimo')
            .eq('company_id', company_id)
            .eq('serie', serieNfce)
            .maybeSingle()

          // NF-e: busca em nfe_numero_seq
          const { data: seqNfe } = await supabase
            .from('nfe_numero_seq')
            .select('ultimo, serie')
            .eq('company_id', company_id)
            .eq('serie', '001')
            .maybeSingle()

          setNfceSeq(pdv?.ultimo    ?? 0)
          setNfeSeq(seqNfe?.ultimo  ?? 0)
          setNfeSerie(seqNfe?.serie ?? '001')
        }
      } catch (e: any) {
        onError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Busca endereço pelo CEP
  const fetchCep = async (cep: string) => {
    const raw = cep.replace(/\D/g, '')
    if (raw.length !== 8) return
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
      const data = await res.json()
      if (data.erro) return
      setForm(f => ({
        ...f,
        logradouro:  data.logradouro ?? f.logradouro,
        bairro:      data.bairro     ?? f.bairro,
        municipio:   data.localidade ?? f.municipio,
        uf:          data.uf         ?? f.uf,
        codigo_ibge: data.ibge       ?? f.codigo_ibge,
      }))
    } catch {}
  }

  const set = (field: keyof FiscalConfigPayload, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCert(true)
    try {
      const reader = new FileReader()
      reader.onload = () => {
        const b64 = (reader.result as string).split(',')[1]
        set('cert_pfx_base64', b64)
      }
      reader.readAsDataURL(file)
    } finally {
      setUploadingCert(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const payload = {
        ...form,
        nfce_serie: (form.nfce_serie ?? '').padStart(3, '0') || '001',
      }
      await saveFiscalConfig(payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      onError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Salvar sequências de numeração ────────────────────────────────────────
  const handleSaveSeq = async () => {
    if (!companyId) { onError('company_id não encontrado'); return }
    setLoadingSeq(true)
    setSavedSeq(false)
    try {
      const serieNfce = (form.nfce_serie ?? '001').padStart(3, '0')
      const serieNfe  = nfeSerie.padStart(3, '0')

      // NFC-e: atualiza o campo `ultimo` no nfce_pdv (registro já existe via NfcePdvSection)
      const { error: errNfce } = await supabase
        .from('nfce_pdv')
        .update({ ultimo: nfceSeq })
        .eq('company_id', companyId)
        .eq('serie', serieNfce)

      if (errNfce) throw new Error(errNfce.message)

      // NF-e: upsert em nfe_numero_seq
      const { error: errNfe } = await supabase
        .from('nfe_numero_seq')
        .upsert(
          { company_id: companyId, serie: serieNfe, ultimo: nfeSeq },
          { onConflict: 'company_id,serie' }
        )

      if (errNfe) throw new Error(errNfe.message)

      setSavedSeq(true)
      setTimeout(() => setSavedSeq(false), 3000)
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoadingSeq(false)
    }
  }

  const inputCls = 'w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 outline-none focus:border-[#1a4a8a] focus:ring-2 focus:ring-[#1a4a8a]/10 transition-all placeholder-gray-300 disabled:opacity-50'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  const tabs: { id: Section; label: string; icon: string }[] = [
    { id: 'emitente',    label: 'Emitente',     icon: '🏢' },
    { id: 'endereco',    label: 'Endereço',     icon: '📍' },
    { id: 'nfce',        label: 'NFC-e / NF-e', icon: '🧾' },
    { id: 'certificado', label: 'Certificado',  icon: '🔐' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Carregando configurações fiscais...</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Configurações Fiscais</h2>
          <p className="text-xs text-gray-400 mt-0.5">Dados do emitente para emissão de NFC-e e NF-e</p>
        </div>

        {/* Ambiente badge */}
        <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
          form.ambiente === 1
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {form.ambiente === 1
            ? <><ShieldCheck size={13} /> Produção</>
            : <><AlertTriangle size={13} /> Homologação</>
          }
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-all ${
              section === t.id
                ? 'bg-white text-[#1a4a8a] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Emitente ── */}
      {section === 'emitente' && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3">
            Dados do Emitente
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Razão Social *</label>
              <input
                className={inputCls}
                value={form.razao_social}
                onChange={e => set('razao_social', e.target.value)}
                placeholder="Nome Empresarial Ltda"
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Nome Fantasia</label>
              <input
                className={inputCls}
                value={form.nome_fantasia ?? ''}
                onChange={e => set('nome_fantasia', e.target.value)}
                placeholder="Nome comercial (opcional)"
              />
            </div>

            <div>
              <label className={labelCls}>CNPJ *</label>
              <input
                className={inputCls}
                value={cnpjMask(form.cnpj)}
                onChange={e => set('cnpj', e.target.value.replace(/\D/g, ''))}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>

            <div>
              <label className={labelCls}>Inscrição Estadual</label>
              <input
                className={inputCls}
                value={form.ie ?? ''}
                onChange={e => set('ie', e.target.value)}
                placeholder="000.000.000.000"
              />
            </div>

            <div>
              <label className={labelCls}>CRT — Regime Tributário *</label>
              <select
                className={inputCls}
                value={form.crt}
                onChange={e => set('crt', Number(e.target.value) as CRT)}
              >
                {CRT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Telefone</label>
              <input
                className={inputCls}
                value={phoneMask(form.telefone ?? '')}
                onChange={e => set('telefone', e.target.value.replace(/\D/g, ''))}
                placeholder="(11) 99999-9999"
                maxLength={15}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Endereço ── */}
      {section === 'endereco' && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3">
            Endereço do Estabelecimento
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>CEP *</label>
              <input
                className={inputCls}
                value={cepMask(form.cep)}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '')
                  set('cep', raw)
                  if (raw.length === 8) fetchCep(raw)
                }}
                placeholder="00000-000"
                maxLength={9}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Logradouro *</label>
              <input
                className={inputCls}
                value={form.logradouro}
                onChange={e => set('logradouro', e.target.value)}
                placeholder="Rua, Av., Alameda..."
              />
            </div>

            <div>
              <label className={labelCls}>Número *</label>
              <input
                className={inputCls}
                value={form.numero}
                onChange={e => set('numero', e.target.value)}
                placeholder="123"
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Complemento</label>
              <input
                className={inputCls}
                value={form.complemento ?? ''}
                onChange={e => set('complemento', e.target.value)}
                placeholder="Sala, Andar, Bloco..."
              />
            </div>

            <div>
              <label className={labelCls}>Bairro *</label>
              <input
                className={inputCls}
                value={form.bairro}
                onChange={e => set('bairro', e.target.value)}
                placeholder="Centro"
              />
            </div>

            <div>
              <label className={labelCls}>Município *</label>
              <input
                className={inputCls}
                value={form.municipio}
                onChange={e => set('municipio', e.target.value)}
                placeholder="São Paulo"
              />
            </div>

            <div>
              <label className={labelCls}>UF *</label>
              <select
                className={inputCls}
                value={form.uf}
                onChange={e => set('uf', e.target.value)}
              >
                {UF_OPTIONS.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Código IBGE (7 dígitos) *</label>
              <input
                className={inputCls}
                value={form.codigo_ibge}
                onChange={e => set('codigo_ibge', e.target.value.replace(/\D/g, '').slice(0, 7))}
                placeholder="3550308"
                maxLength={7}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Preenchido automaticamente ao buscar o CEP
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── NFC-e / NF-e ── */}
      {section === 'nfce' && (
        <div className="space-y-4">

          {/* Ambiente SEFAZ */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3">
              Ambiente SEFAZ
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([2, 1] as AmbienteSEFAZ[]).map(amb => (
                <button
                  key={amb}
                  type="button"
                  onClick={() => set('ambiente', amb)}
                  className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                    form.ambiente === amb
                      ? amb === 1
                        ? 'border-green-400 bg-green-50'
                        : 'border-amber-400 bg-amber-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    form.ambiente === amb
                      ? amb === 1 ? 'border-green-500' : 'border-amber-500'
                      : 'border-gray-300'
                  }`}>
                    {form.ambiente === amb && (
                      <div className={`w-2 h-2 rounded-full ${amb === 1 ? 'bg-green-500' : 'bg-amber-500'}`} />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${
                      form.ambiente === amb
                        ? amb === 1 ? 'text-green-800' : 'text-amber-800'
                        : 'text-gray-700'
                    }`}>
                      {amb === 1 ? '🟢 Produção' : '🟡 Homologação'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {amb === 1
                        ? 'Notas fiscais com validade jurídica'
                        : 'Ambiente de testes — notas sem validade'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <NfcePdvSection companyId={companyId!} onError={onError} />

          {/* ── Numeração — Última nota emitida ── */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Numeração — Última nota emitida
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Configure apenas ao migrar de outro sistema. Em uso normal, o sistema incrementa automaticamente.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              {/* NFC-e */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">NFC-e</span>
                  <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5 font-medium">
                    Série {(form.nfce_serie ?? '001').padStart(3, '0')}
                  </span>
                </div>
                <label className={labelCls}>Último número emitido</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={nfceSeq}
                  onChange={e => setNfceSeq(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                />
                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  Próxima NFC-e será emitida como n°{' '}
                  <span className="font-semibold text-gray-600">{nfceSeq + 1}</span>
                </p>
              </div>

              {/* NF-e */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">NF-e</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">Série</span>
                    <input
                      type="text"
                      maxLength={3}
                      className="w-14 h-6 px-2 text-xs border border-gray-200 rounded-md
                        focus:outline-none focus:border-[#1a4a8a] text-center font-mono
                        bg-amber-50 text-amber-600 border-amber-200"
                      value={nfeSerie}
                      onChange={e => setNfeSerie(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      onBlur={e => {
                        const raw = e.target.value.replace(/\D/g, '')
                        setNfeSerie(raw.length > 0 ? raw.padStart(3, '0') : '001')
                      }}
                    />
                  </div>
                </div>
                <label className={labelCls}>Último número emitido</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={nfeSeq}
                  onChange={e => setNfeSeq(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                />
                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                  Próxima NF-e será emitida como n°{' '}
                  <span className="font-semibold text-gray-600">{nfeSeq + 1}</span>
                </p>
              </div>
            </div>

            {/* Aviso */}
            <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
              <span className="text-base leading-none shrink-0">⚠️</span>
              <span>
                Alterar a numeração pode causar rejeição pela SEFAZ se o número já tiver sido
                utilizado. Use apenas para sincronizar a sequência ao migrar de outro emissor.
              </span>
            </div>

            {/* Botão salvar numeração */}
            <div className="flex items-center justify-end gap-3">
              {savedSeq && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                  <CheckCircle2 size={14} />
                  Numeração salva!
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveSeq}
                disabled={loadingSeq}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg
                  bg-[#1a4a8a] text-white hover:bg-[#1a4a8a]/90
                  disabled:opacity-50 transition-colors font-medium"
              >
                {loadingSeq
                  ? <><Loader2 size={14} className="animate-spin" /> Salvando...</>
                  : <><Save size={14} /> Salvar numeração</>
                }
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ── Certificado Digital ── */}
      {section === 'certificado' && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3">
            Certificado Digital A1 (.pfx)
          </h3>

          {/* Upload area */}
          <div
            onClick={() => certRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#1a4a8a]/40 hover:bg-blue-50/30 transition-all"
          >
            <input
              ref={certRef}
              type="file"
              accept=".pfx,.p12"
              className="hidden"
              onChange={handleCertUpload}
            />
            <div className="flex flex-col items-center gap-2">
              {uploadingCert ? (
                <Loader2 size={24} className="text-[#1a4a8a] animate-spin" />
              ) : form.cert_pfx_base64 ? (
                <CheckCircle2 size={24} className="text-green-500" />
              ) : (
                <Upload size={24} className="text-gray-300" />
              )}
              <p className="text-sm font-medium text-gray-600">
                {form.cert_pfx_base64
                  ? 'Certificado carregado — clique para substituir'
                  : 'Clique para selecionar o arquivo .pfx'}
              </p>
              <p className="text-xs text-gray-400">Certificado A1 no formato PFX / PKCS#12</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Senha do Certificado</label>
              <input
                type="password"
                className={inputCls}
                value={form.cert_senha ?? ''}
                onChange={e => set('cert_senha', e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className={labelCls}>Validade do Certificado</label>
              <input
                type="date"
                className={inputCls}
                value={form.cert_validade ?? ''}
                onChange={e => set('cert_validade', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            <span className="text-base leading-none">⚠️</span>
            <span>
              O certificado é armazenado de forma segura como base64 no banco de dados.
              Recomendamos verificar a validade periodicamente para evitar interrupções na emissão.
            </span>
          </div>
        </div>
      )}

      {/* Botão salvar configurações fiscais */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium animate-pulse">
            <CheckCircle2 size={15} />
            Salvo com sucesso!
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg bg-[#1a4a8a] text-white hover:bg-[#1a4a8a]/90 disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? (
            <><Loader2 size={15} className="animate-spin" /> Salvando...</>
          ) : (
            <><Save size={15} /> Salvar configurações</>
          )}
        </button>
      </div>
    </div>
  )
}