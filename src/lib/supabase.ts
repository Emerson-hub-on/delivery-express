import { createBrowserClient } from '@supabase/ssr'

const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

declare global {
  var _supabase: ReturnType<typeof createClient> | undefined
}

export const supabase =
  globalThis._supabase ?? (globalThis._supabase = createClient())