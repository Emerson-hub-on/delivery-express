'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { signIn } from '@/services/auth'
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn'

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormValues = z.infer<typeof schema>

interface LoginFormProps {
  onSuccess: () => void
  companyId: string
}

export function LoginForm({ onSuccess, companyId }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signInWithGoogle, loading: googleLoading, error: googleError } = useGoogleSignIn()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const handleGoogle = async () => {
    const profile = await signInWithGoogle()
    if (profile) onSuccess()
  }

  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true)
      setError(null)
      await signIn(values.email, values.password, companyId)
      onSuccess()
    } catch (e: any) {
      setError(e.message ?? 'E-mail ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Botão Google */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="flex items-center justify-center gap-3 w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-60"
      >
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
        <span className="text-xs text-gray-400">ou entre com e-mail</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <Input type="email" placeholder="seu@email.com" {...field} />
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <Input type="password" placeholder="••••••" {...field} />
              <FormMessage />
            </FormItem>
          )} />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </Form>
    </div>
  )
}