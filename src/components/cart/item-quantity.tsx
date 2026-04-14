import { useCartStore } from "@/stores/cart-store";
import { Cart } from "@/types/cart";
import { Button } from "../ui/button";
import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";

type Props = {
  cartItem: Cart;
}

export const CartItemQuantity = ({ cartItem }: Props) => {
  const { updateQty, removeFromCart } = useCartStore(state => state);

  const handlePlus = () => updateQty(cartItem.id, cartItem.quantity + 1);
  const handleMinus = () => {
    if (cartItem.quantity <= 1) {
      removeFromCart(cartItem.id);
    } else {
      updateQty(cartItem.id, cartItem.quantity - 1);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handlePlus} variant="outline" size="icon" className="size-5">
        <PlusIcon className="size-3" />
      </Button>
      <div>{cartItem.quantity}</div>
      <Button onClick={handleMinus} variant="outline" size="icon" className="size-5">
        {cartItem.quantity <= 1 ? <Trash2Icon className="size-3" /> : <MinusIcon className="size-3" />}
      </Button>
    </div>
  );
};