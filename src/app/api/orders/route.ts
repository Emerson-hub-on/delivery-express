import { createOrder } from '@/backend/services/orders'

export async function POST(req: Request) {
  const body = await req.json()

  const result = await createOrder(body)

  if (result.error) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  return Response.json(result.data)
}