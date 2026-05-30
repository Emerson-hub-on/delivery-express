'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Save, Upload, CheckCircle2, Loader2, ImageIcon,
  Clock, Globe, Phone, Mail, MapPin, Facebook, Instagram, Twitter, MessageCircle
} from 'lucide-react'

interface StoreProfile {
  banner_url: string | null
  logo_url: string | null
  description: string | null
  phone: string | null
  email: string | null
  address: string | null
  opening_time: string | null
  closing_time: string | null
  facebook_url: string | null
  instagram_url: string | null
  twitter_url: string | null
  whatsapp: string | null
  is_open: boolean
  min_order: number
}

const EMPTY: StoreProfile = {
  banner_url: null,
  logo_url: null,
  description: null,
  phone: null,
  email: null,
  address: null,
  opening_time: '08:00',
  closing_time: '23:00',
  facebook_url: null,
  instagram_url: null,
  twitter_url: null,
  whatsapp: null,
  is_open: true,
  min_order: 0,
}

interface StoreTabProps {
  onError: (msg: string) => void
  companyId: string
}

function phoneMask(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

async function uploadImage(
  file: File,
  companyId: string,
  bucket: string,
  path: string
): Promise<string> {
  const ext = file.name.split('.').pop()
  const filePath = `${companyId}/${path}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
  return data.publicUrl
}

export function StoreTab({ onError, companyId }: StoreTabProps) {
  const [form, setForm] = useState<StoreProfile>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const bannerRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  const inputCls =
    'w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 outline-none ' +
    'focus:border-[#1a4a8a] focus:ring-2 focus:ring-[#1a4a8a]/10 transition-all placeholder-gray-300 disabled:opacity-50'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!companyId) return
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('company_profiles')
          .select('*')
          .eq('company_id', companyId)
          .single()
        if (error && error.code !== 'PGRST116') throw error
        if (data) {
          setForm({
            banner_url:    data.banner_url    ?? null,
            logo_url:      data.logo_url      ?? null,
            description:   data.description   ?? null,
            phone:         data.phone         ?? null,
            email:         data.email         ?? null,
            address:       data.address       ?? null,
            opening_time:  data.opening_time  ? data.opening_time.slice(0, 5) : '08:00',
            closing_time:  data.closing_time  ? data.closing_time.slice(0, 5) : '23:00',
            facebook_url:  data.facebook_url  ?? null,
            instagram_url: data.instagram_url ?? null,
            twitter_url:   data.twitter_url   ?? null,
            whatsapp:      data.whatsapp       ?? null,
            is_open:       data.is_open       ?? true,
            min_order:     data.min_order      ?? 0,
          })
        }
      } catch (e: any) {
        onError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [companyId])

  const set = <K extends keyof StoreProfile>(field: K, value: StoreProfile[K]) =>
    setForm(f => ({ ...f, [field]: value }))

  // ── Image upload helpers ──────────────────────────────────────────────────
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'banner_url' | 'logo_url',
    setUploading: (v: boolean) => void
  ) => {
    const file = e.target.files?.[0]
    if (!file || !companyId) return
    setUploading(true)
    try {
      const url = await uploadImage(file, companyId, 'company-images', field.replace('_url', ''))
      set(field, url)
    } catch (e: any) {
      onError('Erro ao fazer upload: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!companyId) return
    setSaving(true)
    setSaved(false)
    try {
      const payload = {
        company_id:    companyId,
        banner_url:    form.banner_url,
        logo_url:      form.logo_url,
        description:   form.description,
        phone:         form.phone?.replace(/\D/g, '') || null,
        email:         form.email || null,
        address:       form.address || null,
        opening_time:  form.opening_time,
        closing_time:  form.closing_time,
        facebook_url:  form.facebook_url || null,
        instagram_url: form.instagram_url || null,
        twitter_url:   form.twitter_url  || null,
        whatsapp:      form.whatsapp?.replace(/\D/g, '') || null,
        is_open:       form.is_open,
        min_order:     form.min_order,
        updated_at:    new Date().toISOString(),
      }
      const { error } = await supabase
        .from('company_profiles')
        .upsert(payload, { onConflict: 'company_id' })
      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      onError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Carregando dados da loja...</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Perfil da Loja</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Informações exibidas no site e no rodapé
        </p>
      </div>

      {/* ── Imagens ── */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3 flex items-center gap-2">
          <ImageIcon size={14} className="text-gray-400" /> Imagens
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Banner */}
          <div className="space-y-2">
            <label className={labelCls}>Banner</label>
            <div
              onClick={() => bannerRef.current?.click()}
              className="relative w-full h-32 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden cursor-pointer
                hover:border-[#1a4a8a]/40 hover:bg-blue-50/20 transition-all flex items-center justify-center bg-gray-50"
            >
              {form.banner_url ? (
                <>
                  <img src={form.banner_url} alt="Banner" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-medium">Trocar imagem</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-gray-300">
                  {uploadingBanner
                    ? <Loader2 size={22} className="text-[#1a4a8a] animate-spin" />
                    : <Upload size={22} />
                  }
                  <span className="text-xs text-gray-400">Clique para enviar</span>
                  <span className="text-[10px] text-gray-300">Recomendado: 1200×300 px</span>
                </div>
              )}
            </div>
            <input
              ref={bannerRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handleImageUpload(e, 'banner_url', setUploadingBanner)}
            />
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <label className={labelCls}>Logo / Foto do Perfil</label>
            <div
              onClick={() => logoRef.current?.click()}
              className="relative w-full h-32 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden cursor-pointer
                hover:border-[#1a4a8a]/40 hover:bg-blue-50/20 transition-all flex items-center justify-center bg-gray-50"
            >
              {form.logo_url ? (
                <>
                  <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-medium">Trocar imagem</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-gray-300">
                  {uploadingLogo
                    ? <Loader2 size={22} className="text-[#1a4a8a] animate-spin" />
                    : <Upload size={22} />
                  }
                  <span className="text-xs text-gray-400">Clique para enviar</span>
                  <span className="text-[10px] text-gray-300">Recomendado: 400×400 px</span>
                </div>
              )}
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handleImageUpload(e, 'logo_url', setUploadingLogo)}
            />
          </div>
        </div>
      </div>

      {/* ── Informações Gerais ── */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3 flex items-center gap-2">
          <Globe size={14} className="text-gray-400" /> Informações Gerais
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Descrição / Slogan</label>
            <textarea
              className={`${inputCls} h-20 py-2 resize-none`}
              value={form.description ?? ''}
              onChange={e => set('description', e.target.value)}
              placeholder="Ex.: Delivery rápido e seguro na palma da sua mão..."
            />
          </div>

          <div>
            <label className={labelCls}>Pedido mínimo (R$)</label>
            <input
              type="number"
              className={inputCls}
              value={form.min_order}
              onChange={e => set('min_order', Number(e.target.value))}
              min={0}
              step={0.5}
            />
          </div>

          <div className="flex items-center gap-3 pt-5">
            <button
              type="button"
              onClick={() => set('is_open', !form.is_open)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                transition-colors duration-200 ease-in-out focus:outline-none
                ${form.is_open ? 'bg-green-500' : 'bg-gray-200'}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                  transition duration-200 ease-in-out ${form.is_open ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
            <span className="text-sm text-gray-700">
              Loja {form.is_open ? <span className="text-green-600 font-medium">Aberta</span> : <span className="text-gray-400 font-medium">Fechada</span>}
            </span>
          </div>
        </div>
      </div>

      {/* ── Contato ── */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3 flex items-center gap-2">
          <Phone size={14} className="text-gray-400" /> Contato
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Telefone / WhatsApp</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                className={`${inputCls} pl-8`}
                value={phoneMask(form.phone ?? '')}
                onChange={e => set('phone', e.target.value.replace(/\D/g, ''))}
                placeholder="(11) 99999-9999"
                maxLength={15}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>E-mail</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                className={`${inputCls} pl-8`}
                type="email"
                value={form.email ?? ''}
                onChange={e => set('email', e.target.value)}
                placeholder="contato@sualoja.com"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Endereço</label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                className={`${inputCls} pl-8`}
                value={form.address ?? ''}
                onChange={e => set('address', e.target.value)}
                placeholder="Rua Exemplo, 123 — Bairro, Cidade - UF"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Horário ── */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3 flex items-center gap-2">
          <Clock size={14} className="text-gray-400" /> Horário de Funcionamento
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Abre às</label>
            <input
              type="time"
              className={inputCls}
              value={form.opening_time ?? '08:00'}
              onChange={e => set('opening_time', e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Fecha às</label>
            <input
              type="time"
              className={inputCls}
              value={form.closing_time ?? '23:00'}
              onChange={e => set('closing_time', e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <Clock size={11} />
          O horário é exibido como "Seg – Dom: {form.opening_time ?? '08:00'}h às {form.closing_time ?? '23:00'}h"
        </p>
      </div>

      {/* ── Redes Sociais ── */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-3 flex items-center gap-2">
          <Globe size={14} className="text-gray-400" /> Redes Sociais
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Facebook</label>
            <div className="relative">
              <Facebook size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1877F2]" />
              <input
                className={`${inputCls} pl-8`}
                value={form.facebook_url ?? ''}
                onChange={e => set('facebook_url', e.target.value)}
                placeholder="https://facebook.com/sualoja"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Instagram</label>
            <div className="relative">
              <Instagram size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E1306C]" />
              <input
                className={`${inputCls} pl-8`}
                value={form.instagram_url ?? ''}
                onChange={e => set('instagram_url', e.target.value)}
                placeholder="https://instagram.com/sualoja"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>X (Twitter)</label>
            <div className="relative">
              <Twitter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700" />
              <input
                className={`${inputCls} pl-8`}
                value={form.twitter_url ?? ''}
                onChange={e => set('twitter_url', e.target.value)}
                placeholder="https://x.com/sualoja"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>WhatsApp</label>
            <div className="relative">
              <MessageCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#25D366]" />
              <input
                className={`${inputCls} pl-8`}
                value={form.whatsapp ?? ''}
                onChange={e => set('whatsapp', e.target.value.replace(/\D/g, '').slice(0, 13))}
                placeholder="5511999999999"
                maxLength={13}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Só o número com DDD e código do país (ex: 5511999999999)
            </p>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium animate-pulse">
            <CheckCircle2 size={15} /> Salvo com sucesso!
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg bg-[#1a4a8a] text-white
            hover:bg-[#1a4a8a]/90 disabled:opacity-50 transition-colors font-medium"
        >
          {saving
            ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
            : <><Save size={15} /> Salvar configurações</>
          }
        </button>
      </div>
    </div>
  )
}