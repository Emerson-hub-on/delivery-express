import { supabase } from '@/lib/supabase'
import { ifoodApi, type IFoodCategory, type IFoodItem } from './ifoodApiClient'

export interface SyncResult {
  success: boolean
  syncedAt: string
  categories: { inserted: number; updated: number; deactivated: number }
  products: { inserted: number; updated: number; deactivated: number }
  errors: string[]
}

type IFoodItemWithCategory = IFoodItem & {
  categoryId: string
  categoryName: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function centsToReais(cents: number): number {
  return cents / 100
}

// ─────────────────────────────────────────
// CATEGORIAS
// ─────────────────────────────────────────

async function syncCategories(
  ifoodCategories: IFoodCategory[],
  companyId: string,
  errors: string[]
) {
  let inserted = 0
  let updated = 0
  let deactivated = 0

  const { data: existingCats, error } = await supabase
    .from('categories')
    .select('id, name, active')
    .eq('company_id', companyId)

  if (error) {
    errors.push(error.message)
    return { inserted, updated, deactivated }
  }

  const existingMap = new Map<string, { id: number; name: string; active: boolean }>(
    (existingCats ?? []).map((c) => [c.name, c])
  )

  const ifoodSlugs = new Set<string>()

  for (const cat of ifoodCategories) {
    const slug = slugify(cat.name)
    ifoodSlugs.add(slug)

    const isActive = cat.status === 'AVAILABLE'

    if (existingMap.has(slug)) {
      const { error } = await supabase
        .from('categories')
        .update({
          label: cat.name,
          active: isActive,
        })
        .eq('name', slug)
        .eq('company_id', companyId)

      if (error) errors.push(error.message)
      else updated++
    } else {
      const { error } = await supabase
        .from('categories')
        .insert({
          name: slug,
          label: cat.name,
          active: isActive,
          company_id: companyId,
        })

      if (error) errors.push(error.message)
      else inserted++
    }
  }

  // Desativar removidos
  for (const [slug, cat] of existingMap.entries()) {
    if (!ifoodSlugs.has(slug) && cat.active) {
      const { error } = await supabase
        .from('categories')
        .update({ active: false })
        .eq('name', slug)
        .eq('company_id', companyId)

      if (error) errors.push(error.message)
      else deactivated++
    }
  }

  return { inserted, updated, deactivated }
}

// ─────────────────────────────────────────
// PRODUTOS
// ─────────────────────────────────────────

async function syncProducts(
  ifoodItems: IFoodItemWithCategory[],
  companyId: string,
  errors: string[]
) {
  let inserted = 0
  let updated = 0
  let deactivated = 0

  const { data: existing, error } = await supabase
    .from('products')
    .select('id, name, active')
    .eq('company_id', companyId)

  if (error) {
    errors.push(error.message)
    return { inserted, updated, deactivated }
  }

  const existingMap = new Map<string, { id: number; active: boolean }>(
    (existing ?? []).map((p) => [p.name.toLowerCase().trim(), p])
  )

  const ifoodNames = new Set<string>()

  for (const item of ifoodItems) {
    const key = item.name.toLowerCase().trim()
    ifoodNames.add(key)

    const isActive = item.status === 'AVAILABLE'

    const payload = {
      price: centsToReais(item.price),
      active: isActive,
      category: slugify(item.categoryName),
      image: item.logoUrl ?? item.imagePath ?? '',
      description: item.description ?? null,
    }

    if (existingMap.has(key)) {
      const existingItem = existingMap.get(key)!

      const { error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', existingItem.id)

      if (error) errors.push(`Erro ao atualizar ${item.name}: ${error.message}`)
      else updated++
    } else {
      const { error } = await supabase
        .from('products')
        .insert({
          ...payload,
          name: item.name.trim(),
          company_id: companyId,
        })

      if (error) errors.push(`Erro ao inserir ${item.name}: ${error.message}`)
      else inserted++
    }
  }

  // Desativar removidos
  for (const [name, prod] of existingMap.entries()) {
    if (!ifoodNames.has(name) && prod.active) {
      const { error } = await supabase
        .from('products')
        .update({ active: false })
        .eq('id', prod.id)

      if (error) errors.push(error.message)
      else deactivated++
    }
  }

  return { inserted, updated, deactivated }
}

// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────

export async function runIFoodSync(companyId: string): Promise<SyncResult> {
  const errors: string[] = []

  const result: SyncResult = {
    success: false,
    syncedAt: new Date().toISOString(),
    categories: { inserted: 0, updated: 0, deactivated: 0 },
    products: { inserted: 0, updated: 0, deactivated: 0 },
    errors,
  }

  try {
    console.log('[iFood Sync] Buscando cardápio...')

    const menu: IFoodCategory[] = await ifoodApi.getFullMenu()

    if (!menu?.length) {
      throw new Error('Cardápio vazio do iFood')
    }

    const items: IFoodItemWithCategory[] = menu.flatMap((cat: IFoodCategory) =>
      (cat.items ?? []).map((item: IFoodItem) => ({
        ...item,
        categoryId: cat.id,
        categoryName: cat.name,
      }))
    )

    result.categories = await syncCategories(menu, companyId, errors)
    result.products = await syncProducts(items, companyId, errors)

    result.success = errors.length === 0
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)

    console.error('[iFood Sync] ERRO:', msg)
    errors.push(`Erro fatal na sincronização: ${msg}`)

    result.success = false
  }

  return result
}

// ─────────────────────────────────────────
// LOOP
// ─────────────────────────────────────────

const SYNC_INTERVAL = 5 * 60 * 1000
let timer: NodeJS.Timeout | null = null

export function startSyncLoop(
  companyId: string,
  onResult?: (r: SyncResult) => void
) {
  if (timer) return () => stopSyncLoop()

  runIFoodSync(companyId).then(onResult)

  timer = setInterval(async () => {
    const result = await runIFoodSync(companyId)
    onResult?.(result)
  }, SYNC_INTERVAL)

  return () => stopSyncLoop()
}

export function stopSyncLoop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}