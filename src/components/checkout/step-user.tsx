// components/checkout/step-user.tsx
'use client'
import { CheckoutSteps } from "@/types/checkout-steps"
import { Dispatch, SetStateAction, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCheckoutStore } from "@/stores/checkout-store"
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn"
import { useAuth } from "@/hooks/useAuth"
import { supabase } from '@/lib/supabase'
import { RegisterForm } from "@/components/auth/RegisterForm"
import { LoginForm } from "@/components/auth/LoginForm"
import { Phone, Check } from "lucide-react"

const fullSchema = z.object({
  name:  z.string().min(2, 'Preencha seu nome'),
  phone: z.string().min(10, 'Preencha o telefone com DDD'),
})

const phoneSchema = z.object({
  phone: z.string().min(10, 'Preencha o telefone com DDD'),
})

type FullValues  = z.infer<typeof fullSchema>
type PhoneValues = z.infer<typeof phoneSchema>
type AuthTab     = 'register' | 'login'

type Props = {
  setStep: Dispatch<SetStateAction<CheckoutSteps>>
  requireAuth?: boolean
  companyId?: string
}

function maskPhone(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

export const StepUser = ({ setStep, requireAuth = false, companyId = '' }: Props) => {
  const { name, phone, setName, setPhone } = useCheckoutStore(state => state)
  const { user, loading: authLoading } = useAuth()
  const { signInWithGoogle, loading: googleLoading, error: googleError } = useGoogleSignIn()
  const [authTab, setAuthTab] = useState<AuthTab>('register')

  // ✅ Telefone salvo no banco
  const [savedPhone, setSavedPhone] = useState<string | null>(null)
  // ✅ 'saved' = usando o cadastrado | 'new' = digitando outro
  const [phoneMode, setPhoneMode] = useState<'saved' | 'new'>('saved')

  const fullForm = useForm<FullValues>({
    resolver: zodResolver(fullSchema),
    defaultValues: { name, phone },
  })

  const phoneForm = useForm<PhoneValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: '' },
  })

  useEffect(() => {
    if (!user) return

    supabase
      .from('customers')
      .select('name, phone')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        const resolvedName  = data?.name  ?? user.user_metadata?.full_name ?? ''
        const resolvedPhone = data?.phone ?? ''

        setName(resolvedName)

        if (resolvedPhone) {
          setSavedPhone(resolvedPhone)
          setPhone(resolvedPhone)        // já usa o salvo por padrão
          setPhoneMode('saved')
        } else {
          setPhoneMode('new')            // sem cadastro → já cai no formulário
        }
      })
  }, [user?.id])

  const handleGoogle = async () => { await signInWithGoogle() }
  const handleAuthSuccess = () => setStep('finish')

  // ── requireAuth ───────────────────────────────────────────
  if (requireAuth) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-amber-500 text-base leading-none mt-0.5">⚠</span>
          <p className="text-sm text-amber-800">
            Faça o <strong>cadastro ou login</strong> para continuar com a compra.
          </p>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['register', 'login'] as AuthTab[]).map(t => (
            <button key={t} type="button" onClick={() => setAuthTab(t)}
              className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors
                ${authTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'register' ? 'Cadastro' : 'Já tenho conta'}
            </button>
          ))}
        </div>

        {authTab === 'register'
          ? <RegisterForm prefillName={name} onSuccess={handleAuthSuccess} companyId={companyId} />
          : <LoginForm onSuccess={handleAuthSuccess} companyId={companyId} />}
      </div>
    )
  }

  if (authLoading) {
    return <div className="py-8 text-center text-sm text-gray-400">Carregando...</div>
  }

  // ── Logado ────────────────────────────────────────────────
  if (user) {
    const displayName = user.user_metadata?.full_name ?? user.email ?? ''

    const onSubmitPhone = (values: PhoneValues) => {
      setName(displayName)
      setPhone(values.phone)
      setStep('delivery')
    }

    const handleUseSaved = () => {
      if (savedPhone) {
        setName(displayName)
        setPhone(savedPhone)
        setStep('delivery')
      }
    }

    return (
      <div className="flex flex-col gap-4">
        {/* Card do usuário */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
          {user.user_metadata?.avatar_url && (
            <img src={user.user_metadata.avatar_url} alt={displayName}
              className="w-8 h-8 rounded-full shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        </div>

        {/* ✅ Telefone cadastrado — mesmo padrão do StepAddress */}
        {/* Telefone cadastrado */}
        {savedPhone && (
          <button
            type="button"
            onClick={() => setPhoneMode('saved')}
            className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors
              ${phoneMode === 'saved'
                ? 'border-green-400 bg-green-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'}`}
          >
            <Phone size={16} className={phoneMode === 'saved' ? 'text-green-500 shrink-0' : 'text-gray-400 shrink-0'} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${phoneMode === 'saved' ? 'text-green-700' : 'text-gray-500'}`}>
                Telefone cadastrado
              </p>
              <p className={`text-sm ${phoneMode === 'saved' ? 'text-green-800' : 'text-gray-800'}`}>
                {savedPhone}
              </p>
            </div>
            {/* ✅ Check verde quando selecionado, radio cinza quando não */}
            {phoneMode === 'saved' ? (
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                <Check size={12} className="text-white" />
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
            )}
          </button>
        )}

        {/* Usar outro telefone */}
        <button
          type="button"
          onClick={() => {
            setPhoneMode('new')
            setTimeout(() => phoneForm.setFocus('phone'), 50)
          }}
          className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors
            ${phoneMode === 'new'
              ? 'border-green-400 bg-green-50'
              : 'border-gray-200 bg-white hover:bg-gray-50'}`}
        >
          <Phone size={16} className={phoneMode === 'new' ? 'text-green-500 shrink-0' : 'text-gray-400 shrink-0'} />
          <span className={`text-sm flex-1 ${phoneMode === 'new' ? 'text-green-800' : 'text-gray-700'}`}>
            {savedPhone ? 'Usar outro telefone' : 'Informar telefone'}
          </span>
          {phoneMode === 'new' ? (
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <Check size={12} className="text-white" />
            </div>
          ) : (
            <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
          )}
        </button>

        {/* ✅ Formulário só aparece no modo 'new' */}
        {phoneMode === 'new' && (
          <Form {...phoneForm}>
            <form onSubmit={phoneForm.handleSubmit(onSubmitPhone)} className="flex flex-col gap-3">
              <FormField control={phoneForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (WhatsApp)</FormLabel>
                  <Input
                    autoFocus
                    placeholder="(83) 99999-9999"
                    {...field}
                    onChange={e => field.onChange(maskPhone(e.target.value))}
                  />
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit">Próximo</Button>
            </form>
          </Form>
        )}

        {/* ✅ Botão Próximo quando usa o salvo */}
        {phoneMode === 'saved' && (
          <Button onClick={handleUseSaved}>Próximo</Button>
        )}
      </div>
    )
  }

  // ── Não logado ────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={handleGoogle} disabled={googleLoading}
        className="flex items-center justify-center gap-3 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-60">
        {googleLoading ? (
          <svg className="w-4 h-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
        )}
        {googleLoading ? 'Conectando...' : 'Continuar com Google'}
      </button>

      {googleError && <p className="text-sm text-red-500 text-center">{googleError}</p>}

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">ou preencha manualmente</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <Form {...fullForm}>
        <form onSubmit={fullForm.handleSubmit(values => {
          setName(values.name)
          setPhone(values.phone)
          setStep('delivery')
        })} className="flex flex-col gap-4">
          <FormField control={fullForm.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Seu nome</FormLabel>
              <Input autoFocus placeholder="Qual seu nome?" {...field} />
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={fullForm.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone (WhatsApp)</FormLabel>
              <Input
                placeholder="(83) 99999-9999"
                {...field}
                onChange={e => field.onChange(maskPhone(e.target.value))}
              />
              <FormMessage />
            </FormItem>
          )} />

          <Button type="submit" variant="outline">Próximo</Button>
        </form>
      </Form>
    </div>
  )
}