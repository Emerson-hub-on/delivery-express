import { Cart } from "@/types/cart";
import { CartItemQuantity } from "./item-quantity";
import { Badge } from "../ui/badge";

type Props = {
  item: Cart;
};

export const CartItem = ({ item }: Props) => {
  return (
    <div className="group flex items-start gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors border border-transparent hover:border-border/50">
      {/* Imagem */}
      <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-lg shadow-sm">
        <img
          src={item.product.image}
          alt={item.product.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="text-sm font-semibold leading-tight truncate">
          {item.product.name}
        </p>
        <p className="text-xs text-muted-foreground">
          R$ {item.product.price.toFixed(2)} / un.
        </p>

        {/* Adicionais */}
        {item.addons.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.addons.map((addon) => (
              <Badge
                key={addon.itemId}
                variant="secondary"
                className="text-[10px] font-normal px-1.5 py-0"
              >
                {addon.qty}× {addon.itemName}
                {addon.subtotal > 0 && ` +R$${addon.subtotal.toFixed(2)}`}
              </Badge>
            ))}
          </div>
        )}

        {/* Observação */}
        {item.observation && (
          <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">
            "{item.observation}"
          </p>
        )}

        {/* Preço total + controles */}
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm font-bold text-foreground">
            R$ {item.totalWithAddons.toFixed(2)}
          </p>
          <CartItemQuantity cartItem={item} />
        </div>
      </div>
    </div>
  );
};