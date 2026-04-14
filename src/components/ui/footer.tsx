import { Separator } from "./separator"

const contactItems = [
  {
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.08 3.4 2 2 0 0 1 3.06 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 5.96 5.96l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
    label: "Telefone",
    value: "(11) 99999-9999",
  },
  {
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
    label: "E-mail",
    value: "contato@deliveryexpress.com",
  },
  {
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    label: "Endereço",
    value: "Rua Exemplo, 123 — São Paulo, SP",
  },
  {
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    label: "Horário",
    value: "Seg – Dom: 10h às 23h",
  },
]

const paymentMethods = [
  { icon: '💳', label: 'Cartão de Crédito' },
  { icon: '🟣', label: 'Cartão de Débito' },
  { icon: '📱', label: 'PIX' },
  { icon: '💵', label: 'Dinheiro' },
]

export const Footer = () => {
  return (
    <footer className="w-full">

      <div className="h-0.5 bg-gradient-to-r from-orange-700 via-orange-400 to-orange-700" />

      <div className="bg-[#0d1b2a] text-zinc-100 px-4 py-10">
        <div className="max-w-7xl mx-auto">

          {/* GRID PRINCIPAL */}
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">

            {/* Brand */}
            <div className="space-y-3">
              <p className="font-bold text-base flex items-center gap-2 text-orange-400">
                🚀 deliveryExpress
              </p>

              <p className="text-sm text-orange-100/40 leading-relaxed">
                Delivery rápido e seguro na palma da sua mão.<br />
                Qualidade e sabor entregues com carinho.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <a href="#" className="text-orange-900 hover:text-orange-400 transition-colors">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                  </svg>
                </a>

                <a href="#" className="text-orange-900 hover:text-orange-400 transition-colors">
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
                    viewBox="0 0 24 24">
                    <rect x="2" y="2" width="20" height="20" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </a>

                <a href="#" className="text-orange-900 hover:text-orange-400 transition-colors">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Contato */}
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-widest uppercase text-orange-400">
                Contato
              </p>

              <div className="space-y-4">
                {contactItems.map(({ icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="mt-0.5 text-orange-500">{icon}</span>
                    <div>
                      <p className="text-xs text-orange-700 uppercase">
                        {label}
                      </p>
                      <p className="text-sm text-orange-100/70">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pagamentos */}
            <div className="space-y-4">
              <p className="text-xs font-semibold tracking-widest uppercase text-orange-400">
                Formas de Pagamento
              </p>

              <div className="flex flex-wrap gap-2">
                {paymentMethods.map(({ icon, label }) => (
                  <span key={label}
                    className="flex items-center gap-1.5 text-xs border border-orange-950 text-orange-200/50 rounded-md px-3 py-1.5">
                    {icon} {label}
                  </span>
                ))}
              </div>
            </div>

          </div>

          <Separator className="border-orange-950 my-8" />

          {/* Copyright */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-orange-900">
            <span>© {new Date().getFullYear()} deliveryExpress. Todos os direitos reservados.</span>
            <span>
              Desenvolvido com 🩵 por <span className="font-semibold text-orange-800">Emerson</span>
            </span>
          </div>

        </div>
      </div>
    </footer>
  )
}