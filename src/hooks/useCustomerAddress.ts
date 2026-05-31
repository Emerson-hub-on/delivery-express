'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { getCustomerProfile, updateCustomerProfile } from '@/services/auth'
import { supabase } from '@/lib/supabase'

export type Address = {
  street: string
  number: string
  complement?: string
  district: string
  city: string
  state: string
}

export function useCustomerAddress() {
  const { user, loading: authLoading } = useAuth()
  const params = useParams<{ slug: string }>()
  const [companyId, setCompanyId] = useState<string>('')
  const [address, setAddress] = useState<Address | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolve companyId pelo slug
  useEffect(() => {
    if (!params?.slug) return
    supabase
      .from('companies')
      .select('id')
      .eq('slug', params.slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCompanyId(data.id)
      })
  }, [params?.slug])

  const fetchAddress = useCallback(async () => {
    if (authLoading) return
    if (!user || !companyId) { setLoading(false); return }
    try {
      setLoading(true)
      const profile = await getCustomerProfile(user.id, companyId)

      // Monta o Address a partir das colunas separadas
    const addr: Address | null = profile?.logradouro ? {
      street:     profile.logradouro,
      number:     profile.numero,
      complement: profile.complemento ?? undefined,
      district:   profile.bairro,
      city:       profile.municipio,  // ← era cidade
      state:      profile.uf,         // ← era estado
    } : null

      setAddress(addr)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao buscar endereço')
    } finally {
      setLoading(false)
    }
  }, [user, companyId, authLoading])

  useEffect(() => { fetchAddress() }, [fetchAddress])

  const saveAddress = useCallback(async (newAddress: Address) => {
    if (!user || !companyId) return
    try {
      setSaving(true)
      setError(null)

      // Salva nas colunas separadas
    await updateCustomerProfile(user.id, companyId, {
      logradouro:  newAddress.street,
      numero:      newAddress.number,
      complemento: newAddress.complement ?? null,
      bairro:      newAddress.district,
      municipio:   newAddress.city,   // ← era cidade
      uf:          newAddress.state,  // ← era estado
    })

      setAddress(newAddress)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar endereço'
      setError(msg)
      throw e
    } finally {
      setSaving(false)
    }
  }, [user, companyId])

  return { address, loading, saving, error, saveAddress, companyId }
}