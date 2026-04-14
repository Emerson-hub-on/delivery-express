import { Cart } from "@/types/cart";
import { CartItemQuantity } from "./item-quantity";

type Props = {
  item: Cart;
}

export const CartItem = ({ item }: Props) => {
  return (
    <div className="flex items-start gap-5">
      <div className="w-16 shrink-0 overflow-hidden rounded">
        <img src={item.product.image} className="w-full h-auto object-cover" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.product.name}</p>
        <p className="text-xs opacity-50">R$ {item.product.price.toFixed(2)}</p>

        {/* Adicionais selecionados */}
        {item.addons.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5">
            {item.addons.map(addon => (
              <p key={addon.itemId} className="text-xs text-gray-400">
                {addon.qty}x {addon.itemName}
                {addon.subtotal > 0 && ` (+R$ ${addon.subtotal.toFixed(2)})`}
              </p>
            ))}
          </div>
        )}

        {/* Observação */}
        {item.observation && (
          <p className="text-xs text-gray-400 italic mt-1">"{item.observation}"</p>
        )}

        <p className="text-xs font-semibold mt-1">R$ {item.totalWithAddons.toFixed(2)}</p>
      </div>

      <CartItemQuantity cartItem={item} />
    </div>
  );
};