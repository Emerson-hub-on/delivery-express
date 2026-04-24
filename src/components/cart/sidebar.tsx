import { ShoppingCart, Receipt, ChevronLeft } from "lucide-react";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { Separator } from "../ui/separator";
import { useCartStore } from "@/stores/cart-store";
import { CartItem } from "./item";
import { useState } from "react";
import { CheckoutDialog } from "../checkout/checkout-dialog";

export const CartSidebar = () => {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { cart } = useCartStore((state) => state);
  const [sheetOpen, setSheetOpen] = useState(false);
  const subtotal = cart.reduce((s, item) => s + item.totalWithAddons, 0);
  const totalItems = cart.reduce((s, item) => s + item.quantity, 0);

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button className="relative gap-2 rounded-full px-4 shadow-md">
          <ShoppingCart className="size-4" />
          <span className="text-sm font-medium">Carrinho</span>
          {cart.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 min-w-5 h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-[11px] font-bold rounded-full shadow">
              {totalItems}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex flex-col p-0 gap-0 w-full sm:max-w-md">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
              <ShoppingCart className="size-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold leading-none">
                Seu pedido
              </SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalItems === 0
                  ? "Nenhum item adicionado"
                  : `${totalItems} ${totalItems === 1 ? "item" : "itens"} no carrinho`}
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* Lista de itens */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <ShoppingCart className="size-7 opacity-40" />
              </div>
              <p className="text-sm font-medium">Carrinho vazio</p>
              <p className="text-xs opacity-60 text-center">
                Adicione itens do menu para começar
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {cart.map((item) => (
                <CartItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Rodapé com resumo e botão */}
        {cart.length > 0 && (
          <div className="border-t border-border/60 px-5 pt-4 pb-6 bg-background space-y-4">
            {/* Resumo de valores */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <Separator className="opacity-50" />
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-lg font-bold text-foreground">
                  R$ {subtotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Botão finalizar */}
            <Button
              className="w-full h-12 rounded-xl text-sm font-semibold gap-2 shadow-md"
              onClick={() => setCheckoutOpen(true)}
              disabled={cart.length === 0}
            >
              <Receipt className="size-4" />
              Finalizar pedido
            </Button>
            <Button
            variant="ghost"
            className="w-full h-10 rounded-xl text-sm text-muted-foreground gap-1.5 hover:text-foreground"
            onClick={() => setSheetOpen(false)}
            >
            <ChevronLeft className="size-4" />
            Continuar comprando
            </Button>
          </div>
        )}
      </SheetContent>

      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </Sheet>
  );
};