'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, ImageIcon } from 'lucide-react'

interface SettingsTabProps {
  onError: (msg: string) => void
}

export function SettingsTab({ onError }: SettingsTabProps) {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const bannerRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  // Busca companyId e profile direto do Supabase — sem depender da store
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!company) return
      setCompanyId(company.id)

      const { data: profile } = await supabase
        .from('company_profiles')
        .select('banner_url, logo_url')
        .eq('company_id', company.id)
        .maybeSingle()

      if (profile) {
        setBannerUrl(profile.banner_url)
        setLogoUrl(profile.logo_url)
      }
    }
    load()
  }, [])

const uploadImage = async (file: File, bucket: string, type: 'banner' | 'logo') => {
  if (!companyId) { onError('Empresa não encontrada'); return }

  const ext = file.name.split('.').pop()
  const path = `${companyId}/${type}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true })

  if (uploadError) { onError(uploadError.message); return }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`

  const field = type === 'banner' ? 'banner_url' : 'logo_url'
  const { error: dbError } = await supabase
    .from('company_profiles')
    .upsert(
      { company_id: companyId, [field]: publicUrl },
      { onConflict: 'company_id' }
    )

  if (dbError) { onError(dbError.message); return }

  // ← revalida o cardápio após salvar com sucesso
  const { data: company } = await supabase
    .from('companies')
    .select('slug')
    .eq('id', companyId)
    .maybeSingle()

  if (company?.slug) {
    await fetch('/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: company.slug,
        secret: process.env.NEXT_PUBLIC_REVALIDATE_SECRET
      })
    })
  }

  if (type === 'banner') setBannerUrl(publicUrl)
  else setLogoUrl(publicUrl)
}

  const handleBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploadingBanner(true)
      await uploadImage(file, 'company-banners', 'banner')
    } finally {
      setUploadingBanner(false)
    }
  }

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploadingLogo(true)
      await uploadImage(file, 'company-logos', 'logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Configurações da loja</h2>

      {/* Banner */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <div>
          <h3 className="font-medium text-gray-700">Banner</h3>
          <p className="text-xs text-gray-400 mt-0.5">Recomendado: 1200×400px.</p>
        </div>
        <div className="w-full h-36 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200">
          {bannerUrl ? (
            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400 gap-2">
              <ImageIcon size={20} />
              <span className="text-sm">Sem banner</span>
            </div>
          )}
        </div>
        <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBanner} />
        <button
          onClick={() => bannerRef.current?.click()}
          disabled={uploadingBanner || !companyId}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          <Upload size={15} />
          {uploadingBanner ? 'Enviando...' : 'Trocar banner'}
        </button>
      </div>

      {/* Logo */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <div>
          <h3 className="font-medium text-gray-700">Foto de perfil</h3>
          <p className="text-xs text-gray-400 mt-0.5">Recomendado: 200×200px.</p>
        </div>
        <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-100 border-2 border-gray-400">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400">
              <ImageIcon size={20} />
            </div>
          )}
        </div>
        <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
        <button
          onClick={() => logoRef.current?.click()}
          disabled={uploadingLogo || !companyId}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          <Upload size={15} />
          {uploadingLogo ? 'Enviando...' : 'Trocar foto'}
        </button>
      </div>
    </div>
  )
}