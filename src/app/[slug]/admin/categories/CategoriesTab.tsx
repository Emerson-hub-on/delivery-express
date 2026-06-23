'use client'
import { useState } from 'react'
import { CategoryItem, Product } from '@/types/product'
import { createCategory, updateCategory, deleteCategory, archiveCategory } from '@/services/category'
import { CategoryForm } from './CategoryForm'
import { CategoryList } from './CategoryList'

const EMPTY_CATEGORY: Omit<CategoryItem, 'id'> = {
  name: '',
  label: '',
  category_type: undefined,
  size_group: undefined,
  sizes: [],
}

interface CategoriesTabProps {
  categories: CategoryItem[]
  setCategories: React.Dispatch<React.SetStateAction<CategoryItem[]>>
  products: Product[]
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>
  loading: boolean
  showForm: boolean
  setShowForm: (v: boolean) => void
  onError: (msg: string | null) => void
}

export function CategoriesTab({
  categories,
  setCategories,
  products,
  setProducts,
  loading,
  showForm,
  setShowForm,
  onError,
}: CategoriesTabProps) {
  const [form, setForm]         = useState<Omit<CategoryItem, 'id'>>(EMPTY_CATEGORY)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving]     = useState(false)

  const [deleteModal, setDeleteModal] = useState<{
    catId: number
    catLabel: string
    productCount: number
  } | null>(null)
  const [deleteChecking, setDeleteChecking] = useState(false)

  const handleFieldChange = (field: keyof Omit<CategoryItem, 'id'>, value: any) => {
    setForm(f => ({ ...f, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.label.trim())
      return onError('Preencha o slug e o nome de exibição.')
    const slug = form.name.trim().toLowerCase().replace(/\s+/g, '_')
    try {
      setSaving(true)
      if (editingId !== null) {
        const updated = await updateCategory(editingId, { ...form, name: slug })
        setCategories(prev => prev.map(c => c.id === editingId ? updated : c))
      } else {
        const created = await createCategory({ ...form, name: slug })
        setCategories(prev => [...prev, created])
      }
      resetForm()
    } catch (e: any) {
      if (e.message?.includes('categories_name_key')) {
        onError('Já existe uma categoria com esse slug. Escolha outro identificador.')
      } else {
        onError(e.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (cat: CategoryItem) => {
    const { id, ...rest } = cat
    setForm(rest)
    setEditingId(id)
    setShowForm(true)
  }

  const handleDeleteRequest = async (id: number) => {
    const cat = categories.find(c => c.id === id)
    if (!cat) return
    try {
      setDeleteChecking(true)
      const productCount = products.filter(p => p.category === cat.name).length
      setDeleteModal({ catId: id, catLabel: cat.label, productCount })
    } finally {
      setDeleteChecking(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteModal) return
    try {
      await deleteCategory(deleteModal.catId)
      setCategories(prev => prev.filter(c => c.id !== deleteModal.catId))
      setDeleteModal(null)
    } catch (e: any) {
      onError(e.message)
      setDeleteModal(null)
    }
  }

  const handleConfirmArchive = async () => {
    if (!deleteModal) return
    try {
      const archived = await archiveCategory(deleteModal.catId)
      setCategories(prev => prev.map(c => c.id === deleteModal.catId ? archived : c))
      setDeleteModal(null)
    } catch (e: any) {
      onError(e.message)
      setDeleteModal(null)
    }
  }

  const handleActivate = async (id: number) => {
    try {
      const reactivated = await updateCategory(id, { active: true })
      setCategories(prev => prev.map(c => c.id === id ? reactivated : c))
    } catch (e: any) {
      onError(e.message)
    }
  }

  const handleCancel = () => resetForm()

  const resetForm = () => {
    setForm(EMPTY_CATEGORY)
    setEditingId(null)
    setShowForm(false)
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-400 text-sm">Carregando categorias...</div>
  }

  return (
    <>
      <CategoryList
        categories={categories}
        products={products}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
        onActivate={handleActivate}
        onReorder={setCategories}
        deletingId={deleteChecking ? -1 : null}
      />

      {/* ── Modal formulário ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />
          <div className="relative w-full max-w-2xl my-8 bg-white rounded-2xl shadow-2xl flex flex-col">

            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">
                {editingId !== null ? 'Editar categoria' : 'Nova categoria'}
              </h2>
              <button
                onClick={handleCancel}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* conteúdo */}
            <div className="overflow-y-auto p-6">
              <CategoryForm
                form={form}
                editingId={editingId}
                saving={saving}
                onFieldChange={handleFieldChange}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal exclusão ── */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
            {deleteModal.productCount === 0 ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🗑️</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Excluir categoria?</p>
                    <p className="text-sm text-gray-500 mt-1">
                      <strong>{deleteModal.catLabel}</strong> não possui produtos vinculados e será
                      excluída permanentemente. Essa ação não pode ser desfeita.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setDeleteModal(null)} className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleConfirmDelete} className="text-sm px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors">
                    Excluir permanentemente
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Esta categoria tem produtos vinculados</p>
                    <p className="text-sm text-gray-500 mt-1">
                      <strong>{deleteModal.catLabel}</strong> possui{' '}
                      <strong>{deleteModal.productCount} {deleteModal.productCount === 1 ? 'produto' : 'produtos'}</strong>{' '}
                      vinculados. Excluí-la causaria inconsistência nos relatórios.
                    </p>
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 leading-relaxed">
                      <strong>Recomendado: Arquivar.</strong> A categoria some do sistema mas o
                      histórico de pedidos e relatórios continua íntegro.
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end flex-wrap">
                  <button onClick={() => setDeleteModal(null)} className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleConfirmArchive} className="text-sm px-4 py-2 rounded-lg bg-black hover:bg-gray-800 text-white transition-colors">
                    Arquivar categoria
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