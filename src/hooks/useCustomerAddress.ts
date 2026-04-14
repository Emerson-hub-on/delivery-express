'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getCustomerProfile, updateCustomerProfile } from '@/services/auth'

export type Address = {
  street: string
  number: string
  complement?: string
  district: string
  city: string
  state: string
}

export function useCustomerAddress() {
  const { user } = useAuth()
  const [address, setAddress] = useState<Address | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAddress = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      setLoading(true)
      const profile = await getCustomerProfile(user.id)
      setAddress(profile?.address ?? null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchAddress() }, [fetchAddress])

  const saveAddress = useCallback(async (newAddress: Address) => {
    if (!user) return
    try {
      setSaving(true)
      setError(null)
      await updateCustomerProfile(user.id, { address: newAddress })
      setAddress(newAddress)
    } catch (e: any) {
      setError(e.message)
      throw e
    } finally {
      setSaving(false)
    }
  }, [user])

  return { address, loading, saving, error, saveAddress }
}
