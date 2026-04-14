// src/lib/generate-message.ts

type GenerateMessageParams = {
  name: string
  phone: string
  address: {
    street: string
    number: string
    complement?: string
    district: string
    city: string
    state: string
  }
  deliveryType: 'delivery' | 'pickup'
  cart: Array<{ quantity: number; product: { name: string } }>
  paymentMethod?: string | null
  payWhen?: 'now' | 'on-delivery' | null
  change?: number | null
}

const PAYMENT_LABELS: Record<string, string> = {
  pix:      'Pix',
  credito:  'Cartão de Crédito',
  debito:   'Cartão de Débito',
  dinheiro: 'Dinheiro',
}

export const generateMessage = ({
  name,
  phone,
  address,
  deliveryType,
  cart,
  paymentMethod,
  payWhen,
  change,
}: GenerateMessageParams): string => {

  const orderProducts = cart.map(item => `${item.quantity} x ${item.product.name}`)

  const addressBlock = deliveryType === 'pickup'
    ? `📍 *Retirada no local*`
    : `📍 *Endereço de entrega:*
    - Rua: ${address.street}
    - Número: ${address.number}${address.complement ? `\n    - Complemento: ${address.complement}` : ''}
    - Bairro: ${address.district}
    - Cidade/UF: ${address.city}/${address.state}`

  // Bloco de pagamento — só exibe se tiver método definido
  const paymentBlock = (() => {
    if (!paymentMethod) return ''
    const label = PAYMENT_LABELS[paymentMethod] ?? paymentMethod
    const when  = payWhen === 'now' ? 'Pagar agora' : 'Pagar na entrega/retirada'

    let block = `\n    💳 *Pagamento:*
    - Forma: ${label}
    - Quando: ${when}`

    // Troco só aparece para dinheiro na entrega
    if (paymentMethod === 'dinheiro' && payWhen !== 'now') {
      if (change === 0 || change === null) {
        block += `\n    - Troco: Não precisa`
      } else if (change && change > 0) {
        block += `\n    - Troco para: ${(change).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      }
    }

    return block
  })()

  return `✨ *Seja bem-vindo(a)!*  
    É um prazer atender você 😊

    📋 *Informações do cliente:*  
    👤 Nome: ${name}
    📱 Telefone: ${phone}

    ${addressBlock}

    🛒 *Pedido:*  
    ${orderProducts.join("\n    ")}
    ${paymentBlock}
    🙏 Agradecemos pela preferência!`
}