import { Order } from '@/types/product'
import { getPaymentLabel } from '@/lib/payment-labels'

// ── helpers ───────────────────────────────────────────────────

function fmt(value: unknown): string {
  const n = Number(value)
  return isNaN(n) ? '0,00' : n.toFixed(2).replace('.', ',')
}

function formatDateTime(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife' })
}

function getStatusLabel(order: Order): string {
  const isPickup = order.delivery_type === 'pickup'
  const map: Record<string, string> = {
    pending:            'Pendente',
    confirmed:          'Confirmado',
    delivering:         isPickup ? 'Pronto p/ retirada' : 'Saiu p/ entrega',
    'Pronto p/ retirada': 'Pronto p/ retirada',
    completed:          'Concluído',
    cancelled:          'Cancelado',
  }
  return map[order.status] ?? order.status
}

// ── main export function ──────────────────────────────────────

export async function exportOrderPdf(order: Order): Promise<void> {
  // Importa jsPDF dinamicamente (não quebra SSR)
  const { jsPDF } = await import('jspdf')

  const isPickup = order.delivery_type === 'pickup'

  // Largura de cupom: 80mm = ~227pt
  const PAGE_W  = 227
  const MARGIN  = 14
  const INNER_W = PAGE_W - MARGIN * 2

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [PAGE_W, 900], // altura será recortada depois
  })

  let y = 0

  // ── helpers de desenho ───────────────────────────────────────

  const line = (extra = 0) => {
    y += 4 + extra
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(MARGIN, y, PAGE_W - MARGIN, y)
    y += 6
  }

  const dottedLine = () => {
    y += 4
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.4)
    doc.setLineDashPattern([2, 2], 0)
    doc.line(MARGIN, y, PAGE_W - MARGIN, y)
    doc.setLineDashPattern([], 0)
    y += 6
  }

  const text = (
    str: string,
    opts: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'center' | 'right'; x?: number } = {}
  ) => {
    const { size = 8, bold = false, color = [30, 30, 30], align = 'left', x = MARGIN } = opts
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...color)

    const maxWidth = PAGE_W - MARGIN * 2
    const xPos = align === 'center' ? PAGE_W / 2 : align === 'right' ? PAGE_W - MARGIN : x

    // Quebra automaticamente se necessário
    const lines = doc.splitTextToSize(str, maxWidth)
    doc.text(lines, xPos, y, { align })
    y += (size + 3) * lines.length
  }

  const row = (left: string, right: string, opts: { bold?: boolean; size?: number } = {}) => {
    const { bold = false, size = 8 } = opts
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(30, 30, 30)
    doc.text(left, MARGIN, y)
    doc.text(right, PAGE_W - MARGIN, y, { align: 'right' })
    y += size + 4
  }

  // ── Cabeçalho ────────────────────────────────────────────────
  y = 18

  text('deliveryExpress', { size: 13, bold: true, align: 'center' })
  y += 2
  text('Cupom de Pedido', { size: 8, color: [100, 100, 100], align: 'center' })
  y += 8
  line()

  // Número + data
  text(`Pedido #${order.code ?? order.id}`, { size: 11, bold: true, align: 'center' })
  y += 3
  text(formatDateTime(order.created_at), { size: 7.5, color: [120, 120, 120], align: 'center' })
  y += 4

  // Tipo de entrega
  const typeLabel = isPickup ? '🏪 Retirada no local' : '🛵 Entrega'
  text(typeLabel, { size: 8, bold: true, align: 'center', color: isPickup ? [100, 40, 160] : [30, 80, 200] })
  y += 2

  line()

  // ── Status timeline ──────────────────────────────────────────
  text('LINHA DO TEMPO', { size: 7, bold: true, color: [120, 120, 120] })
  y += 4

  row('🕐 Pedido recebido:', formatDateTime(order.created_at))

  if (order.dispatched_at) {
    const dispatchLabel = isPickup ? '🏪 Pronto p/ retirada:' : '🛵 Despachado:'
    row(dispatchLabel, formatDateTime(order.dispatched_at))
  }

  if (order.completed_at) {
    const completedLabel = order.status === 'cancelled' ? '❌ Cancelado:' : '✅ Concluído:'
    row(completedLabel, formatDateTime(order.completed_at))
  }

  // Status atual
  y += 2
  const statusLabel = getStatusLabel(order)
  text(`Status atual: ${statusLabel}`, { size: 8, bold: true })
  y += 2

  line()

  // ── Cliente ──────────────────────────────────────────────────
  text('CLIENTE', { size: 7, bold: true, color: [120, 120, 120] })
  y += 4

  text(order.customer ?? '—', { size: 9, bold: true })
  if (order.customer_phone) {
    y += 1
    text(`Tel: ${order.customer_phone}`, { size: 8 })
  }
  y += 2

  // ── Endereço / Retirada ──────────────────────────────────────
  if (isPickup) {
    y += 2
    text('🏪 Retirada no estabelecimento', { size: 8, bold: true, color: [100, 40, 160] })
    y += 2
  } else if (order.address) {
    const addr = order.address
    y += 2
    text('ENDEREÇO DE ENTREGA', { size: 7, bold: true, color: [120, 120, 120] })
    y += 4
    text(`${addr.street}, ${addr.number}${addr.complement ? ` — ${addr.complement}` : ''}`, { size: 8 })
    text(`${addr.district}, ${addr.city} / ${(addr.state ?? '').toUpperCase()}`, { size: 8 })
    y += 2
  }

  line()

  // ── Itens ────────────────────────────────────────────────────
  text('ITENS DO PEDIDO', { size: 7, bold: true, color: [120, 120, 120] })
  y += 5

  // Cabeçalho da tabela
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(120, 120, 120)
  doc.text('Produto', MARGIN, y)
  doc.text('Qtd', MARGIN + 95, y, { align: 'center' })
  doc.text('Unit.', MARGIN + 128, y, { align: 'right' })
  doc.text('Subtotal', PAGE_W - MARGIN, y, { align: 'right' })
  y += 3
  dottedLine()

  for (const item of order.items ?? []) {
    // Nome do produto (pode quebrar linha)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    const nameLines = doc.splitTextToSize(item.product_name, 88)
    doc.text(nameLines, MARGIN, y)

    // Qtd, preço e subtotal na primeira linha
    doc.setFont('helvetica', 'normal')
    doc.text(String(item.quantity), MARGIN + 95, y, { align: 'center' })
    doc.text(`R$ ${fmt(item.unit_price)}`, MARGIN + 128, y, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.text(`R$ ${fmt(item.quantity * item.unit_price)}`, PAGE_W - MARGIN, y, { align: 'right' })

    y += (9) * nameLines.length

    // Addons
    for (const addon of item.addons ?? []) {
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(`  ↳ ${addon.qty}× ${addon.itemName}`, MARGIN, y)
      if (addon.subtotal > 0) {
        doc.text(`+R$ ${fmt(addon.subtotal)}`, PAGE_W - MARGIN, y, { align: 'right' })
      }
      y += 10
    }

    // Observação
    if (item.observation) {
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(180, 120, 0)
      const obsLines = doc.splitTextToSize(`OBS: "${item.observation}"`, INNER_W)
      doc.text(obsLines, MARGIN, y)
      y += 10 * obsLines.length
    }

    y += 3
  }

  dottedLine()

  // Total
  row('TOTAL', `R$ ${fmt(order.total)}`, { bold: true, size: 10 })
  y += 2

  line()

  // ── Pagamento ────────────────────────────────────────────────
  text('PAGAMENTO', { size: 7, bold: true, color: [120, 120, 120] })
  y += 4

  text(getPaymentLabel(order.payment_method), { size: 9, bold: true })
  y += 2

  // Status do pagamento
  if (order.status === 'confirmed' && order.payment_method === 'pix') {
    text('✅ Pago online (Pix)', { size: 8, color: [20, 160, 80] })
  } else if (!['completed', 'cancelled'].includes(order.status)) {
    text('⏳ Cobrar do cliente', { size: 8, color: [120, 120, 120] })
  } else {
    text('Pago na entrega / retirada', { size: 8 })
  }

  // Troco
  if (order.payment_method === 'dinheiro') {
    y += 2
    if (order.change === null || order.change === undefined) {
      text('💵 Pagamento em dinheiro na entrega', { size: 8 })
    } else if (order.change === 0) {
      text('💵 Sem troco (valor exato)', { size: 8 })
    } else {
      const trocoBase = (order.change ?? 0) + (order.total ?? 0)
      text(`💵 Troco para: R$ ${fmt(trocoBase)}`, { size: 8 })
      text(`   Troco: R$ ${fmt(order.change)}`, { size: 8 })
    }
  }

  y += 2
  line()

  // ── Rodapé ───────────────────────────────────────────────────
  y += 4
  text('Obrigado pela preferência!', { size: 8, bold: true, align: 'center', color: [80, 80, 80] })
  y += 3
  text('deliveryExpress © 2026', { size: 7, color: [160, 160, 160], align: 'center' })
  y += 12

  // Recorta a página na altura real do conteúdo
  const finalHeight = y
  const docFinal = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [PAGE_W, finalHeight],
  })

  // Copia tudo recriando com a altura certa
  // (jsPDF não permite redimensionar após criação — então geramos duas vezes
  //  com um helper de re-render, ou simplesmente usamos o tamanho estimado fixo)
  // Para evitar complexidade, exportamos o doc original com a altura ajustada via internal:
  ;(doc as any).internal.pageSize.height = finalHeight

  doc.save(`pedido-${order.code ?? order.id}.pdf`)
}