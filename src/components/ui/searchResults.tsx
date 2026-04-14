'use client'
import { useEffect, useState } from 'react'
import { getProductsByCompany } from '@/services/product'
import { Product } from '@/types/product'
import { useCartStore } from '@/stores/cart-store'
import { toast } from 'sonner'

interface SearchResultsProps {
    query: string
    companyId: string
    onClose: () => void
}

const SearchResults = ({ query, companyId, onClose }: SearchResultsProps) => {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(false)
    const { upsertCartItem } = useCartStore(s => s)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            const data = await getProductsByCompany(companyId)
            setProducts(data)
            setLoading(false)
        }
        load()
    }, [companyId])

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase())
    )

    const handleAdd = (product: Product) => {
        upsertCartItem(product, 1)
        toast.success('Produto adicionado ao carrinho!', {
            description: product.name,
        })
        onClose()
    }

    if (loading) {
        return (
            <div className="px-4 py-3 text-sm text-zinc-400">Buscando...</div>
        )
    }

    if (filtered.length === 0) {
        return (
            <div className="px-4 py-3 text-sm text-zinc-400">
                Nenhum produto encontrado para "{query}"
            </div>
        )
    }

    return (
        <div className="max-h-72 overflow-y-auto border-t border-zinc-100 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-700">
            {filtered.map(product => (
                <button
                    key={product.id}
                    onClick={() => handleAdd(product)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
                >
                    {/* Imagem */}
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-zinc-100 shrink-0">
                        {product.image ? (
                            <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-zinc-200 dark:bg-zinc-700" />
                        )}
                    </div>

                    {/* Nome e preço */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-800 dark:text-zinc-100 truncate">
                            {product.name}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            R$ {product.price.toFixed(2)}
                        </p>
                    </div>
                </button>
            ))}
        </div>
    )
}