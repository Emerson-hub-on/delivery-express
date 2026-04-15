'use client'
import { Dispatch, SetStateAction, useEffect, useState } from "react"
import { CheckoutSteps } from "@/types/checkout-steps"
import { useCheckoutStore } from "@/stores/checkout-store"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useCustomerAddress } from "@/hooks/useCustomerAddress"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

const formSchema = z.object({
  cep:        z.string().optional(),
  street:     z.string().min(2, "Preencha a rua"),
  number:     z.string().min(1, "Preencha o número"),
  complement: z.string().optional(),
  district:   z.string().min(2, "Preencha o bairro"),
  city:       z.string().min(2, "Preencha a cidade"),
  state:      z.string().min(2, "Preencha o estado"),
})

type FormValues = z.infer<typeof formSchema>

type Props = {
  setStep: Dispatch<SetStateAction<CheckoutSteps>>
}

export const StepAddress = ({ setStep }: Props) => {
  const params = useParams<{ slug: string }>()
  const [companyId, setCompanyId] = useState('')
  const { address, setAddress } = useCheckoutStore(state => state)
  const { address: savedAddress, loading: loadingSaved } = useCustomerAddress()
  const [usingSaved, setUsingSaved] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError]     = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cep:        "",
      street:     address?.street     ?? "",
      number:     address?.number     ?? "",
      complement: address?.complement ?? "",
      district:   address?.district   ?? "",
      city:       address?.city       ?? "",
      state:      address?.state      ?? "",
    },
  })

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

  useEffect(() => {
    if (!address && savedAddress) {
      form.reset({
        cep:        "",
        street:     savedAddress.street,
        number:     savedAddress.number,
        complement: savedAddress.complement ?? "",
        district:   savedAddress.district,
        city:       savedAddress.city,
        state:      savedAddress.state,
      })
      setUsingSaved(true)
    }
  }, [savedAddress])

  const handleUseSaved = () => {
    if (!savedAddress) return
    form.reset({
      cep:        "",
      street:     savedAddress.street,
      number:     savedAddress.number,
      complement: savedAddress.complement ?? "",
      district:   savedAddress.district,
      city:       savedAddress.city,
      state:      savedAddress.state,
    })
    setUsingSaved(true)
  }

  const handleUseNew = () => {
    form.reset({ cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" })
    setUsingSaved(false)
    setCepError(null)
  }

  const handleCepChange = async (raw: string) => {
    // Mantém só dígitos, formata como 00000-000
    const digits = raw.replace(/\D/g, "").slice(0, 8)
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    form.setValue("cep", formatted)
    setCepError(null)

    if (digits.length !== 8) return

    setCepLoading(true)
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()

      if (data.erro) {
        setCepError("CEP não encontrado.")
        return
      }

      form.setValue("street",   data.logradouro ?? "")
      form.setValue("district", data.bairro     ?? "")
      form.setValue("city",     data.localidade ?? "")
      form.setValue("state",    data.uf         ?? "")

      // Foca no número após preencher automaticamente
      setTimeout(() => {
        const numberInput = document.querySelector<HTMLInputElement>('input[name="number"]')
        numberInput?.focus()
      }, 100)
    } catch {
      setCepError("Erro ao buscar CEP. Verifique sua conexão.")
    } finally {
      setCepLoading(false)
    }
  }

const onSubmit = (values: FormValues) => {
  if (!usingSaved) {
    const digits = (values.cep ?? "").replace(/\D/g, "")
    if (digits.length !== 8) {
      form.setError("cep", { message: "CEP inválido" })
      return
    }
  }

  const { cep, ...addressFields } = values
  setAddress(addressFields)
  setStep('when-to-pay')
}

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">

        {/* Card endereço salvo */}
        {!loadingSaved && savedAddress && (
          <button
            type="button"
            onClick={usingSaved ? handleUseNew : handleUseSaved}
            className={`w-full rounded-xl border-2 px-4 py-3 text-left transition-colors ${
              usingSaved
                ? "border-green-500 bg-green-50"
                : "border-gray-200 bg-gray-50 hover:border-gray-300"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-base">📍</span>
                <div className="flex flex-col gap-0.5">
                  <span className={`text-sm font-semibold ${usingSaved ? "text-green-800" : "text-gray-700"}`}>
                    Endereço cadastrado
                  </span>
                  <span className={`text-sm ${usingSaved ? "text-green-700" : "text-gray-500"}`}>
                    {savedAddress.street}, {savedAddress.number}
                    {savedAddress.complement ? ` — ${savedAddress.complement}` : ""}
                  </span>
                  <span className={`text-xs ${usingSaved ? "text-green-600" : "text-gray-400"}`}>
                    {savedAddress.district}, {savedAddress.city} — {savedAddress.state}
                  </span>
                </div>
              </div>

              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                usingSaved ? "border-green-500 bg-green-500" : "border-gray-300"
              }`}>
                {usingSaved && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>

            {usingSaved && (
              <p className="mt-2 text-xs text-green-600 border-t border-green-200 pt-2">
                ✓ Este endereço será usado na entrega. Clique para inserir outro.
              </p>
            )}
          </button>
        )}

        {/* Campos do form — ocultos quando endereço salvo está selecionado */}
        {!usingSaved && (
          <div className="grid grid-cols-2 gap-3">

            {/* CEP — largura total, com spinner e erro inline */}
            <div className="col-span-2">
              <FormField control={form.control} name="cep" render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <div className="relative">
                    <Input
                      {...field}
                      placeholder="00000-000"
                      inputMode="numeric"
                      maxLength={9}
                      onChange={e => handleCepChange(e.target.value)}
                      className={cepError ? "border-red-400 pr-9" : "pr-9"}
                    />
                    {cepLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="w-4 h-4 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  {cepError
                    ? <p className="text-[0.8rem] font-medium text-destructive">{cepError}</p>
                    : <FormMessage />
                  }
                </FormItem>
              )} />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <FormField control={form.control} name="street" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rua</FormLabel>
                  <Input placeholder="Nome da rua" {...field} />
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="number" render={({ field }) => (
              <FormItem>
                <FormLabel>Número</FormLabel>
                <Input placeholder="123" {...field} />
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="complement" render={({ field }) => (
              <FormItem>
                <FormLabel>Complemento</FormLabel>
                <Input placeholder="Apto, bloco... (opcional)" {...field} />
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="district" render={({ field }) => (
              <FormItem>
                <FormLabel>Bairro</FormLabel>
                <Input placeholder="Bairro" {...field} />
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="city" render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade</FormLabel>
                <Input placeholder="Cidade" {...field} />
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="state" render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <Input placeholder="PB" {...field} />
                <FormMessage />
              </FormItem>
            )} />
          </div>
        )}

        <div className="flex justify-between mt-1">
          <Button variant="link" type="button" onClick={() => setStep("delivery")}>
            Anterior
          </Button>
          <Button type="submit">Próximo</Button>
        </div>
      </form>
    </Form>
  )
}