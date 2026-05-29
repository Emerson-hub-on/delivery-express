'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Separator } from './separator'

interface StoreProfile {
  phone: string | null
  email: string | null
  address: string | null
  opening_time: string | null
  closing_time: string | null
  facebook_url: string | null
  instagram_url: string | null
  twitter_url: string | null
  description: string | null
  logo_url: string | null
}

interface FooterProps {
  slug: string
}

function formatPhone(raw: string | null) {
  if (!raw) return null
  const d = raw.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  return raw
}

function formatTime(t: string | null) {
  return t ? t.slice(0, 5) : null
}

const paymentMethods = [
  { icon: '💳', label: 'Cartão de Crédito' },
  { icon: '🟣', label: 'Cartão de Débito' },
  { icon: '📱', label: 'PIX' },
  { icon: '💵', label: 'Dinheiro' },
]

export const Footer = ({ slug }: FooterProps) => {
  const [profile, setProfile] = useState<StoreProfile | null>(null)

  useEffect(() => {
    if (!slug) return
    const load = async () => {
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', slug)
        .single()
      if (!company) return

      const { data } = await supabase
        .from('company_profiles')
        .select('phone, email, address, opening_time, closing_time, facebook_url, instagram_url, twitter_url, description, logo_url')
        .eq('company_id', company.id)
        .single()

      if (data) setProfile(data)
    }
    load()
  }, [slug])

  // Build contact items dynamically — only show rows that have data
  const contactItems = [
    profile?.phone && {
      icon: (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.08 3.4 2 2 0 0 1 3.06 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 5.96 5.96l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      ),
      label: 'Telefone',
      value: formatPhone(profile.phone),
    },
    profile?.email && {
      icon: (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      ),
      label: 'E-mail',
      value: profile.email,
    },
    profile?.address && {
      icon: (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
      label: 'Endereço',
      value: profile.address,
    },
    (profile?.opening_time || profile?.closing_time) && {
      icon: (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      label: 'Horário',
      value: `Seg – Dom: ${formatTime(profile?.opening_time ?? null) ?? '08:00'}h às ${formatTime(profile?.closing_time ?? null) ?? '23:00'}h`,
    },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[]

  const socialLinks = [
    profile?.facebook_url && {
      label: 'Facebook',
      href: profile.facebook_url,
      icon: (
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      ),
    },
    profile?.instagram_url && {
      label: 'Instagram',
      href: profile.instagram_url,
      icon: (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
    profile?.twitter_url && {
      label: 'X (Twitter)',
      href: profile.twitter_url,
      icon: (
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25z" />
        </svg>
      ),
    },
  ].filter(Boolean) as { label: string; href: string; icon: React.ReactNode }[]

  return (
    <footer className="w-full pb-16 md:pb-0">
      {/* Top gradient bar */}
      <div className="h-0.5 bg-linear-to-r from-[#0f2d5e] via-[#2563eb] to-[#0f2d5e]" />

      {/* Body */}
      <div
        className="relative overflow-hidden px-4 py-10"
        style={{ background: 'linear-gradient(135deg, #0f2d5e 0%, #1a4a8a 50%, #1d5ca8 100%)' }}
      >
        {/* Dot-grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z' fill='%23fff' fill-opacity='0.035'/%3E%3C%2Fsvg%3E")`,
          }}
        />
        <div
          className="absolute rounded-full pointer-events-none"
          aria-hidden="true"
          style={{ width: 280, height: 280, background: 'rgba(255,255,255,0.04)', bottom: -80, right: -80 }}
        />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">

            {/* Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {profile?.logo_url ? (
                  <img
                    src={profile.logo_url}
                    alt="Logo"
                    className="w-7 h-7 rounded-[7px] object-cover"
                  />
                ) : (
                  <div
                    className="w-7 h-7 rounded-[7px] flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.12)' }}
                    aria-hidden="true"
                  >
                    <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                      <path d="M7 21L14 7l7 14H7z" fill="white" fillOpacity="0.9" />
                      <circle cx="14" cy="12" r="2.5" fill="white" />
                    </svg>
                  </div>
                )}
                <p className="font-medium text-[15px] text-white">webState</p>
              </div>

              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {profile?.description ?? 'Delivery rápido e seguro na palma da sua mão.'}
              </p>

              {/* Social links — only rendered if at least one exists */}
              {socialLinks.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  {socialLinks.map(({ label, href, icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150"
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '0.5px solid rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.5)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.14)'
                        ;(e.currentTarget as HTMLAnchorElement).style.color = '#fff'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.07)'
                        ;(e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)'
                      }}
                    >
                      {icon}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Contato */}
            {contactItems.length > 0 && (
              <div className="space-y-4">
                <p className="text-[11px] font-medium tracking-widest uppercase" style={{ color: '#93b4da' }}>
                  Contato
                </p>
                <div className="space-y-3">
                  {contactItems.map(({ icon, label, value }) => (
                    <div key={label} className="flex items-start gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: 'rgba(255,255,255,0.08)', color: '#93b4da' }}
                        aria-hidden="true"
                      >
                        {icon}
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wide" style={{ color: '#5a82b4' }}>
                          {label}
                        </p>
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pagamentos */}
            <div className="space-y-4">
              <p className="text-[11px] font-medium tracking-widest uppercase" style={{ color: '#93b4da' }}>
                Formas de Pagamento
              </p>
              <div className="flex flex-wrap gap-2">
                {paymentMethods.map(({ icon, label }) => (
                  <span
                    key={label}
                    className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5"
                    style={{
                      border: '0.5px solid rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.55)',
                      background: 'rgba(255,255,255,0.05)',
                    }}
                  >
                    {icon} {label}
                  </span>
                ))}
              </div>
            </div>

          </div>

          <Separator className="my-8" style={{ borderColor: 'rgba(255,255,255,0.1)' }} />

          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            <span>© {new Date().getFullYear()} webState. Todos os direitos reservados.</span>
            <span>
              Desenvolvido com 🩵 por{' '}
              <span className="font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Emerson</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}