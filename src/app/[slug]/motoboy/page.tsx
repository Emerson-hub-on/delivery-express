'use client'
import { useState } from 'react'
import { Motoboy } from '@/types/motoboy'
import { MotoboyLogin } from '@/components/motoboy/motoboy-login'
import { MotoboyDashboard } from '@/components/motoboy/motoboy-dashboard'

export default function MotoboyPage() {
  const [motoboy, setMotoboy] = useState<Motoboy | null>(null)

  if (!motoboy) {
    return <MotoboyLogin onLogin={setMotoboy} />
  }

  return <MotoboyDashboard motoboy={motoboy} onLogout={() => setMotoboy(null)} />
}
