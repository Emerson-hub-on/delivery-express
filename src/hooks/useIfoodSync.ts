/**
 * useIFoodSync.ts
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  runIFoodSync,
  startSyncLoop,
  stopSyncLoop,
  type SyncResult,
} from '@/services/ifoodSyncService'

interface UseIFoodSyncOptions {
  autoStart?: boolean
  onSync?: (result: SyncResult) => void
}

interface UseIFoodSyncReturn {
  syncing: boolean
  lastResult: SyncResult | null
  loopActive: boolean
  syncNow: () => Promise<void>
  startLoop: () => Promise<void>
  stopLoop: () => void
}

export function useIFoodSync(options: UseIFoodSyncOptions = {}): UseIFoodSyncReturn {
  const { autoStart = false, onSync } = options

  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [loopActive, setLoopActive] = useState(false)

  const companyIdRef = useRef<string | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  // 🔹 resolve companyId uma vez
  const resolveCompanyId = useCallback(async () => {
    if (companyIdRef.current) return companyIdRef.current

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Usuário não autenticado')
    }

    companyIdRef.current = user.id
    return user.id
  }, [])

  const handleResult = useCallback(
    (result: SyncResult) => {
      setLastResult(result)
      onSync?.(result)
    },
    [onSync]
  )

  const syncNow = useCallback(async () => {
    if (syncing) return

    setSyncing(true)

    try {
      const companyId = await resolveCompanyId()

      const result = await runIFoodSync(companyId)
      handleResult(result)
    } finally {
      setSyncing(false)
    }
  }, [syncing, handleResult, resolveCompanyId])

  const startLoop = useCallback(async () => {
    if (loopActive) return

    const companyId = await resolveCompanyId()

    const stop = startSyncLoop(companyId, (result: SyncResult) => {
      handleResult(result)
    })

    stopRef.current = stop
    setLoopActive(true)
  }, [loopActive, handleResult, resolveCompanyId])

  const stopLoop = useCallback(() => {
    stopSyncLoop()
    stopRef.current?.()
    stopRef.current = null
    setLoopActive(false)
  }, [])

  // auto-start
  useEffect(() => {
    if (autoStart) {
      startLoop()
    }

    return () => {
      if (autoStart) {
        stopLoop()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    syncing,
    lastResult,
    loopActive,
    syncNow,
    startLoop,
    stopLoop,
  }
}