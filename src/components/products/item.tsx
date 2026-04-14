'use client'
import { useState } from 'react'
import { Product } from '@/types/product'
import { Button } from '../ui/button'
import { ProductModal } from './ProductModal'

type Props = {
  item: Product
}

export const ProductItem = ({ item }: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div>
        <div
          className="rounded-md overflow-hidden cursor-pointer"
          onClick={() => setOpen(true)}
        >
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-32 object-cover hover:scale-105 transition-transform duration-200"
          />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-lg">{item.name}</p>
          <p className="text-sm opacity-50">R$ {item.price.toFixed(2)}</p>
          <Button
            variant="outline"
            onClick={() => setOpen(true)}
          >
            Adicionar
          </Button>
        </div>
      </div>

      {open && (
        <ProductModal
          product={item}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
