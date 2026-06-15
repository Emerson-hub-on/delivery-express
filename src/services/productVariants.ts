import { supabase } from '@/lib/supabase'
import { ProductColor, ProductVariant, ProductSize } from '@/types/product'

// ── Cores ─────────────────────────────────────────────────────

export async function getColors(companyId: string): Promise<ProductColor[]> {
  const { data, error } = await supabase
    .from('product_colors')
    .select('*')
    .eq('company_id', companyId)
    .order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createColor(
  companyId: string,
  name: string,
  hexCode?: string
): Promise<ProductColor> {
  const { data, error } = await supabase
    .from('product_colors')
    .insert({ company_id: companyId, name: name.toUpperCase().trim(), hex_code: hexCode ?? null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

// ── Variantes ─────────────────────────────────────────────────

export async function getVariantsByProduct(productId: number): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*, color:product_colors(*)')
    .eq('product_id', productId)
    .order('created_at')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertVariant(
  productId: number,
  colorId: number,
  payload: { image?: string | null; sizes?: ProductSize[] | null; stock?: number | null }
): Promise<ProductVariant> {
  const { data, error } = await supabase
    .from('product_variants')
    .upsert(
      { product_id: productId, color_id: colorId, ...payload },
      { onConflict: 'product_id,color_id' }
    )
    .select('*, color:product_colors(*)')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteVariant(variantId: number): Promise<void> {
  const { error } = await supabase
    .from('product_variants')
    .delete()
    .eq('id', variantId)
  if (error) throw new Error(error.message)
}

export async function toggleVariant(variantId: number, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('product_variants')
    .update({ active })
    .eq('id', variantId)
  if (error) throw new Error(error.message)
}