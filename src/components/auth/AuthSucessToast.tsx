'use client'
import { useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export function AuthSuccessToast() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const authEmail = searchParams.get('auth_success')
  const email = authEmail ? decodeURIComponent(authEmail) : null

  useEffect(() => {
    if (!email) return

    // Remove o param da URL
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.delete('auth_success')
    const newUrl = newParams.size > 0 ? `${pathname}?${newParams}` : pathname
    router.replace(newUrl)

    // Esconde após 5s via DOM direto (sem estado extra)
    const toast = document.getElementById('auth-success-toast')
    if (toast) {
      toast.style.display = 'flex'
      timerRef.current = setTimeout(() => {
        toast.style.display = 'none'
      }, 5000)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [email])

  if (!email) return null

  return (
    <div
      id="auth-success-toast"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-sm"
    >
      <div className="flex items-center gap-3 bg-gray-900 text-white text-sm px-5 py-3 rounded-2xl shadow-xl">
        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="flex-1 truncate">
          Autenticado com <strong>{email}</strong> com sucesso!
        </span>
        <button
          onClick={() => {
            const toast = document.getElementById('auth-success-toast')
            if (toast) toast.style.display = 'none'
          }}
          className="ml-1 text-gray-400 hover:text-white leading-none shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  )
}