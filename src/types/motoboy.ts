export interface Motoboy {
  id: string        // ← uuid, era number
  name: string
  email: string
  phone: string
  active: boolean
  created_at: string
  user_id?: string
  password?: string
}