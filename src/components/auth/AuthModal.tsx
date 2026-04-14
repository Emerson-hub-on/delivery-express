'use client'
import { useState } from 'react'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

interface AuthModalProps {
  open: boolean
  prefillName?: string
  onClose: () => void
  onSuccess: () => void
  companyId: string  // ← novo
}

type AuthTab = 'login' | 'register'

export function AuthModal({ open, prefillName = '', onClose, onSuccess, companyId }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>('register')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {tab === 'register' ? 'Criar conta' : 'Entrar'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {tab === 'register'
                ? 'Crie uma conta para acompanhar seus pedidos'
                : 'Acesse para ver seus pedidos'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-5">
          {(['register', 'login'] as AuthTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors
                ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'register' ? 'Cadastro' : 'Já tenho conta'}
            </button>
          ))}
        </div>

        {tab === 'register'
          ? <RegisterForm prefillName={prefillName} onSuccess={onSuccess} companyId={companyId} />  
          : <LoginForm onSuccess={onSuccess} companyId={companyId} />}  
      </div>
    </div>
  )
}
