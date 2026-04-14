import { ShoppingCart } from "lucide-react"
import { Button } from "../ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet"
import { Separator } from "../ui/separator"
import { useCartStore } from "@/stores/cart-store"
import { CartItem } from "./item"
import { useState } from "react"
import { CheckoutDialog } from "../checkout/checkout-dialog"

export const CartSidebar = () => {

    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const { cart } = useCartStore(state => state);
    const subtotal = cart.reduce((s, item) => s + item.totalWithAddons, 0)
    return(
        <Sheet>
            <SheetTrigger asChild>
                <Button className="relative">
                    <ShoppingCart />
                    <p>Carrinho</p>  
                    {cart.length > 0 &&
                        <div className="absolute -right-2 -top-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-700 text-white text-xs font-bold rounded-full">
                            {cart.length}
                        </div>
                    }               
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Carrinho</SheetTitle>
                </SheetHeader>

                <div className="ml-5 mr-5 flex flex-col gap-5 my-3">
                    {cart.map(item => (
                    <CartItem key={item.id} item={item}/>  // ✅ sempre único
                ))}
                </div>

                <Separator className="my-4"/>

                <div className="ml-5 mr-5 flex justify-between items-center text-xs">
                    <div>Subtotal:</div>
                    <div>R$ {subtotal.toFixed(2)}</div>
                </div>
                <Separator className="my-4"/>

                <div className="text-center">
                    <Button
                    disabled={cart.length === 0}
                    onClick={() => setCheckoutOpen(true)}
                    >Finalizar Compra</Button>
                </div>

                <CheckoutDialog 
                open={checkoutOpen}
                onOpenChange={setCheckoutOpen}
                />

            </SheetContent>
        </Sheet>
    )
}