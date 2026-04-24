import { useCartStore } from "@/stores/cart-store";
import { Cart } from "@/types/cart";
import { Button } from "../ui/button";
import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";

type Props = {
  cartItem: Cart;
};

export const CartItemQuantity = ({ cartItem }: Props) => {
  const { updateQty, removeFromCart } = useCartStore((state) => state);

  const handlePlus = () => updateQty(cartItem.id, cartItem.quantity + 1);
  const handleMinus = () => {
    if (cartItem.quantity <= 1) {
      removeFromCart(cartItem.id);
    } else {
      updateQty(cartItem.id, cartItem.quantity - 1);
    }
  };

  return (
    <div className="flex items-center gap-1 bg-muted rounded-full px-1 py-0.5 border border-border/60">
      <Button
        onClick={handleMinus}
        variant="ghost"
        size="icon"
        className="size-6 rounded-full hover:bg-background hover:shadow-sm transition-all"
      >
        {cartItem.quantity <= 1 ? (
          <Trash2Icon className="size-3 text-destructive" />
        ) : (
          <MinusIcon className="size-3" />
        )}
      </Button>
      <span className="text-xs font-semibold w-4 text-center tabular-nums">
        {cartItem.quantity}
      </span>
      <Button
        onClick={handlePlus}
        variant="ghost"
        size="icon"
        className="size-6 rounded-full hover:bg-background hover:shadow-sm transition-all"
      >
        <PlusIcon className="size-3" />
      </Button>
    </div>
  );
};