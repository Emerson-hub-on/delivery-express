'use client'
import { useState } from 'react'
import { Customer } from '@/types/customer'
import { CustomerForm } from './CustomerForm'
import { deleteCustomer } from '@/services/customers'
import { displayDoc } from './customer.helpers'

interface Props {
  customers:    Customer[]
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>
  loading:      boolean
  showForm:     boolean
  setShowForm:  (v: boolean) => void
  companyId:    string
  onError:      (msg: string) => void
}

export function CustomersTab({
  customers, setCustomers, loading,
  showForm, setShowForm, companyId, onError,
}: Props) {
  const [search,   setSearch]   = useState('')
  const [editing,  setEditing]  = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = customers.filter(c =>
    [c.name, c.email, c.phone, c.cpf, c.cnpj, c.razao_social]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cliente?')) return
    try {
      setDeleting(id)
      await deleteCustomer(id)
      setCustomers(prev => prev.filter(c => c.id !== id))
    } catch (e: any) {
      onError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const handleSaved = (customer: Customer) => {
    setCustomers(prev => {
      const exists = prev.some(c => c.id === customer.id)
      return exists
        ? prev.map(c => c.id === customer.id ? customer : c)
        : [customer, ...prev]
    })
    setEditing(null)
    setShowForm(false)
  }

  // ── Form view ──────────────────────────────────────────────────────────────
  if (showForm || editing) {
    return (
      <CustomerForm
        initial={editing}
        companyId={companyId}
        onSaved={handleSaved}
        onCancel={() => { setEditing(null); setShowForm(false) }}
        onError={onError}
      />
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Search */}
      <div className="mb-4 flex items-center gap-3 bg-white border border-gray-200
        rounded-xl px-4 py-2.5 shadow-sm">
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none"
          viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail, CPF, CNPJ..."
          className="flex-1 text-sm outline-none text-gray-700
            placeholder:text-gray-400 bg-transparent"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-gray-300 hover:text-gray-500 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] text-gray-400
              uppercase tracking-wide">
              <th className="text-left px-5 py-3">Nome</th>
              <th className="text-left px-5 py-3">Contato</th>
              <th className="text-left px-5 py-3">CPF / CNPJ</th>
              <th className="text-left px-5 py-3">Tipo</th>
              <th className="text-left px-5 py-3">Cidade</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {/* Loading skeleton */}
            {loading && [1, 2, 3].map(i => (
              <tr key={i} className="border-t border-gray-50 animate-pulse">
                <td className="px-5 py-3">
                  <div className="h-3 w-32 bg-gray-100 rounded mb-1.5" />
                  <div className="h-2.5 w-40 bg-gray-50 rounded" />
                </td>
                <td className="px-5 py-3"><div className="h-3 w-24 bg-gray-100 rounded" /></td>
                <td className="px-5 py-3"><div className="h-3 w-28 bg-gray-100 rounded" /></td>
                <td className="px-5 py-3"><div className="h-5 w-8 bg-gray-100 rounded-full" /></td>
                <td className="px-5 py-3"><div className="h-3 w-20 bg-gray-100 rounded" /></td>
                <td className="px-5 py-3" />
              </tr>
            ))}

            {/* Empty */}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-14 text-gray-400 text-sm">
                  {search
                    ? 'Nenhum cliente encontrado para essa busca.'
                    : 'Nenhum cliente cadastrado ainda.'}
                </td>
              </tr>
            )}

            {/* Rows */}
            {!loading && filtered.map(c => (
              <tr key={c.id}
                className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.email}</p>
                  {c.razao_social && (
                    <p className="text-xs text-gray-400 italic">{c.razao_social}</p>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-600 text-xs">
                  {c.phone ?? '—'}
                </td>
                <td className="px-5 py-3 text-gray-600 font-mono text-xs">
                  {displayDoc(c)}
                </td>
                <td className="px-5 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    c.pessoa_tipo === 'juridica'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {c.pessoa_tipo === 'juridica' ? 'PJ' : 'PF'}
                  </span>
                  {c.is_guest && (
                    <span className="ml-1.5 text-[10px] px-2 py-0.5 rounded-full
                      font-medium bg-gray-100 text-gray-500">
                      avulso
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  <td className="px-5 py-3 text-gray-500 text-xs">
                  {c.municipio
                    ? `${c.municipio} / ${c.uf?.toUpperCase() ?? ''}`
                    : '—'}
                </td>
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setEditing(c)}
                    className="text-xs text-gray-500 hover:text-gray-800 mr-3 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deleting === c.id}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors
                      disabled:opacity-40"
                  >
                    {deleting === c.id ? '...' : 'Excluir'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {!loading && customers.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-right">
          {filtered.length} de {customers.length}{' '}
          {customers.length === 1 ? 'cliente' : 'clientes'}
        </p>
      )}
    </div>
  )
}