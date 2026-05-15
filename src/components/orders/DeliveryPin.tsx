interface DeliveryPinProps {
  pin: string
}

export function DeliveryPin({ pin }: DeliveryPinProps) {
  return (
    <div
      className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex flex-col items-center gap-1"
      onClick={e => e.stopPropagation()}
    >
      <p className="text-[10px] text-blue-500 font-medium uppercase tracking-wide">
        🔐 Código de confirmação de entrega
      </p>
      <p className="text-2xl font-bold text-blue-700 tracking-[0.25em]">
        {pin}
      </p>
      <p className="text-[10px] text-blue-400 text-center">
        Mostre ao motoboy no momento da entrega
      </p>
    </div>
  )
}
