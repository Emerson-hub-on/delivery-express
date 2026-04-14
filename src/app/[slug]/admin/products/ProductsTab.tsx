'use client'
import { useState } from 'react'
import { Product, CategoryItem } from '@/types/product'
import { createProduct, updateProduct, deleteProduct, archiveProduct, checkProductHasOrders } from '@/services/product'
import { supabase } from '@/lib/supabase'
import { ProductForm } from './ProductForm'
import { ProductList } from './ProductList'

const EMPTY_PRODUCT: Omit<Product, 'id'> = {
  name: '',
  category: '',
  image: '',
  price: 0,
  description: '',
  active: true,
  ncm: '',
  cest: '',
  cfop: '5102',
  unit_com: 'UN',
  unit_trib: undefined,
  origem: 0,
  icms_csosn: '400',
  icms_aliq: undefined,
  pis_cst: '07',
  pis_aliq: 0,
  cofins_cst: '07',
  cofins_aliq: 0,
}

interface ProductsTabProps {
  products: Product[]
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>
  categories: CategoryItem[]
  loadingCats: boolean
  loading: boolean
  showForm: boolean
  setShowForm: (v: boolean) => void
  onError: (msg: string | null) => void
  onGoToCategories: () => void
}

export function ProductsTab({
  products,
  setProducts,
  categories,
  loadingCats,
  loading,
  showForm,
  setShowForm,
  onError,
  onGoToCategories,
}: ProductsTabProps) {
  const [form, setForm] = useState<Omit<Product, 'id'>>({
    ...EMPTY_PRODUCT,
    category: categories[0]?.name ?? '',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // ── Estado do modal de confirmação de exclusão ───────────────
  const [deleteModal, setDeleteModal] = useState<{
    productId: number
    productName: string
    orderCount: number  // 0 = sem pedidos → pode deletar; >0 → oferece arquivar
  } | null>(null)
  const [deleteChecking, setDeleteChecking] = useState(false)

  const handleFieldChange = (
    field: keyof Omit<Product, 'id'>,
    value: string | number | boolean
  ) => {
    setForm(f => ({ ...f, [field]: value }))
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return onError('Apenas imagens são permitidas.')
    if (file.size > 2 * 1024 * 1024) return onError('A imagem deve ter no máximo 2MB.')
    setImagePreview(URL.createObjectURL(file))
    try {
      setUploading(true)
      onError(null)
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('products').upload(fileName, file, { upsert: false })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('products').getPublicUrl(fileName)
      setForm(f => ({ ...f, image: data.publicUrl }))
    } catch (e: any) {
      onError('Erro ao enviar imagem: ' + e.message)
      setImagePreview(null)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.name || !form.image || form.price <= 0 || !form.category)
      return onError('Preencha nome, categoria, imagem e preço.')

    if (form.ncm && !/^\d{8}$/.test(form.ncm))
      return onError('NCM deve ter exatamente 8 dígitos numéricos.')

    if (form.cest && !/^\d{7}$/.test(form.cest))
      return onError('CEST deve ter exatamente 7 dígitos numéricos.')

    const payload: Omit<Product, 'id'> = {
      ...form,
      ncm: form.ncm || undefined,
      cest: form.cest || undefined,
      unit_trib: form.unit_trib || undefined,
      icms_aliq: form.icms_csosn === '900' ? (form.icms_aliq ?? undefined) : undefined,
    }

    try {
      setSaving(true)
      onError(null)
      if (editingId !== null) {
        const updated = await updateProduct(editingId, payload)
        setProducts(prev => prev.map(p => p.id === editingId ? updated : p))
      } else {
        const created = await createProduct(payload)
        setProducts(prev => [...prev, created])
      }
      resetForm()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (product: Product) => {
    const { id, ...rest } = product
    setForm({ ...EMPTY_PRODUCT, ...rest })
    setEditingId(id)
    setShowForm(true)
    setImagePreview(product.image)
  }

  // ── Clique inicial no botão de excluir ───────────────────────
  // Verifica pedidos vinculados antes de mostrar o modal
  const handleDeleteRequest = async (id: number) => {
    const product = products.find(p => p.id === id)
    if (!product) return

    try {
      setDeleteChecking(true)
      onError(null)
      const orderCount = await checkProductHasOrders(id)
      setDeleteModal({ productId: id, productName: product.name, orderCount })
    } catch (e: any) {
      onError('Erro ao verificar pedidos: ' + e.message)
    } finally {
      setDeleteChecking(false)
    }
  }

  // ── Confirma exclusão definitiva (sem pedidos) ───────────────
  const handleConfirmDelete = async () => {
    if (!deleteModal) return
    try {
      await deleteProduct(deleteModal.productId)
      setProducts(prev => prev.filter(p => p.id !== deleteModal.productId))
      setDeleteModal(null)
    } catch (e: any) {
      onError(e.message)
      setDeleteModal(null)
    }
  }

  // ── Confirma arquivamento (com pedidos vinculados) ───────────
  const handleConfirmArchive = async () => {
    if (!deleteModal) return
    try {
      const archived = await archiveProduct(deleteModal.productId)
      setProducts(prev => prev.map(p => p.id === deleteModal.productId ? archived : p))
      setDeleteModal(null)
    } catch (e: any) {
      onError(e.message)
      setDeleteModal(null)
    }
  }

  // ── Reativa produto arquivado ────────────────────────────────
  const handleActivate = async (id: number) => {
    try {
      onError(null)
      const reactivated = await updateProduct(id, { active: true })
      setProducts(prev => prev.map(p => p.id === id ? reactivated : p))
    } catch (e: any) {
      onError(e.message)
    }
  }

  const handleCancel = () => {
    resetForm()
    onError(null)
  }

  const resetForm = () => {
    setForm({ ...EMPTY_PRODUCT, category: categories[0]?.name ?? '' })
    setEditingId(null)
    setShowForm(false)
    setImagePreview(null)
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-400 text-sm">Carregando produtos...</div>
  }

  return (
    <>
      {showForm && (
        <ProductForm
          form={form}
          editingId={editingId}
          categories={categories}
          loadingCats={loadingCats}
          saving={saving}
          uploading={uploading}
          imagePreview={imagePreview}
          onFieldChange={handleFieldChange}
          onImageChange={handleImageChange}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onGoToCategories={onGoToCategories}
        />
      )}

      <ProductList
        products={products}
        categories={categories}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
        onActivate={handleActivate}
        deletingId={deleteChecking ? -1 : null}
      />

      {/* ── Modal de confirmação ─────────────────────────────── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDeleteModal(null)}
          />

          {/* Card */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">

            {deleteModal.orderCount === 0 ? (
              // ── Sem pedidos: pode deletar ──────────────────
              <>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🗑️</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Excluir produto?</p>
                    <p className="text-sm text-gray-500 mt-1">
                      <strong>{deleteModal.productName}</strong> não possui pedidos vinculados e será
                      excluído permanentemente. Essa ação não pode ser desfeita.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setDeleteModal(null)}
                    className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="text-sm px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                  >
                    Excluir permanentemente
                  </button>
                </div>
              </>
            ) : (
              // ── Com pedidos: oferece arquivar ──────────────
              <>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Este produto tem pedidos vinculados</p>
                    <p className="text-sm text-gray-500 mt-1">
                      <strong>{deleteModal.productName}</strong> aparece em{' '}
                      <strong>{deleteModal.orderCount} {deleteModal.orderCount === 1 ? 'pedido' : 'pedidos'}</strong>.
                      Excluí-lo causaria inconsistência nos relatórios.
                    </p>
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 leading-relaxed">
                      <strong>Recomendado: Arquivar.</strong> O produto fica inativo e some do
                      cardápio, mas o histórico de pedidos e relatórios continua íntegro.
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end flex-wrap">
                  <button
                    onClick={() => setDeleteModal(null)}
                    className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmArchive}
                    className="text-sm px-4 py-2 rounded-lg bg-black hover:bg-gray-800 text-white transition-colors"
                  >
                    Arquivar produto
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
