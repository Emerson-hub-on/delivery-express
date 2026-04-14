export default function Reports({ orders }: any) {
  const total = orders.reduce((sum: number, o: any) => sum + (o.total ?? 0), 0)

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Relatórios</h2>

      <p>Total pedidos: {orders.length}</p>
      <p>Faturamento: R$ {total.toFixed(2)}</p>
    </div>
  )
}