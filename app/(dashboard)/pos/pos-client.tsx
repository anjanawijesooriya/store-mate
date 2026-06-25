"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, BookOpen, Percent, Tag, X, Printer, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  sellPrice: number;
  stockQty: number;
  category: string | null;
}

interface CartItem {
  productId: string;
  name: string;
  unit: string;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  lineTotal: number;
}

interface CompletedSale {
  id: string;
  total: number;
  amountPaid: number;
  paymentMethod: string;
  items: Array<{ product: { name: string; unit: string }; quantity: number; unitPrice: number; lineTotal: number }>;
  customer: { name: string; phone: string | null } | null;
  createdAt: string;
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "CARD", label: "Card", icon: CreditCard },
  { value: "ONLINE", label: "Online", icon: Smartphone },
  { value: "CREDIT", label: "Credit", icon: BookOpen },
];

function formatLKR(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function POSClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountTendered, setAmountTendered] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const discountAmt = discountType === "percent" ? (subtotal * discount) / 100 : discount;
  const total = Math.max(0, subtotal - discountAmt);
  const change = parseFloat(amountTendered || "0") - total;

  // Fetch recent/popular products on mount
  useEffect(() => {
    fetch("/api/products?limit=12&page=1")
      .then((r) => r.json())
      .then((d) => setRecentProducts(d.products ?? []))
      .catch(() => {});
  }, []);

  // Debounced product search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(searchQuery)}&limit=20`);
        const data = await res.json();
        setSearchResults(data.products ?? []);
      } catch {
        /* ignore */
      }
    }, 150);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQty) {
          toast.warning(`Only ${product.stockQty} ${product.unit} in stock`);
          return prev;
        }
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, lineTotal: (i.quantity + 1) * i.unitPrice }
            : i
        );
      }
      if (product.stockQty <= 0) {
        toast.error(`${product.name} is out of stock`);
        return prev;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          unitPrice: Number(product.sellPrice),
          originalPrice: Number(product.sellPrice),
          quantity: 1,
          lineTotal: Number(product.sellPrice),
        },
      ];
    });
    setSearchQuery("");
    setSearchResults([]);
    searchRef.current?.focus();
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i;
          const newQty = i.quantity + delta;
          if (newQty <= 0) return null as unknown as CartItem;
          return { ...i, quantity: newQty, lineTotal: newQty * i.unitPrice };
        })
        .filter(Boolean)
    );
  }

  function updateLinePrice(productId: string, newPrice: number) {
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, unitPrice: newPrice, lineTotal: i.quantity * newPrice }
          : i
      )
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  function clearCart() {
    setCart([]);
    setDiscount(0);
    setAmountTendered("");
    setCheckoutOpen(false);
    setCompletedSale(null);
  }

  async function completeSale() {
    if (cart.length === 0) return;
    if (paymentMethod === "CASH" && parseFloat(amountTendered || "0") < total) {
      toast.error("Amount tendered must be at least the total");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          discount: discountAmt,
          paymentMethod,
          amountPaid: paymentMethod === "CASH" ? parseFloat(amountTendered) : total,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sale failed");
        return;
      }

      setCompletedSale(data.sale);
      setShowReceipt(true);
      setCheckoutOpen(false);
      toast.success("Sale completed!");
    } catch {
      toast.error("Failed to complete sale");
    } finally {
      setLoading(false);
    }
  }

  const displayProducts = searchQuery ? searchResults : recentProducts;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      {/* Left — Product search */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search product name or scan barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base"
            autoFocus
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 overflow-y-auto">
          {displayProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              disabled={product.stockQty <= 0}
              className={cn(
                "text-left rounded-xl border border-border bg-card p-3 hover:border-primary hover:shadow-sm transition-all active:scale-95",
                product.stockQty <= 0 && "opacity-50 cursor-not-allowed"
              )}
            >
              <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                {product.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{product.unit}</p>
              <p className="mt-1.5 text-base font-bold text-primary font-mono">
                {formatLKR(Number(product.sellPrice))}
              </p>
              {product.stockQty <= 0 && (
                <p className="text-xs text-destructive font-medium mt-0.5">Out of stock</p>
              )}
              {product.stockQty > 0 && product.stockQty <= 5 && (
                <p className="text-xs text-[color:var(--brand-warning)] font-medium mt-0.5">
                  Only {product.stockQty} left
                </p>
              )}
            </button>
          ))}

          {displayProducts.length === 0 && searchQuery && (
            <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
              No products found for &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      </div>

      {/* Right — Cart */}
      <div className="w-full lg:w-96 flex flex-col border border-border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Cart</span>
            {cart.length > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs">{cart.length}</Badge>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Search for a product or tap a product card to add to cart
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{item.name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          value={item.unitPrice}
                          min={0}
                          step={0.01}
                          onChange={(e) => updateLinePrice(item.productId, parseFloat(e.target.value) || 0)}
                          className="w-24 text-xs font-mono border border-border rounded px-1.5 py-0.5 bg-background text-foreground"
                          title="Unit price (editable)"
                        />
                        <span className="text-xs text-muted-foreground">/ {item.unit}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <p className="text-sm font-bold font-mono text-foreground">
                        {formatLKR(item.lineTotal)}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item.productId, -1)}
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-mono w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.productId, 1)}
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="w-6 h-6 rounded border border-border flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors ml-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t border-border p-4 space-y-3">
              {/* Discount */}
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={discount || ""}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="Discount"
                  className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-background font-mono"
                />
                <button
                  onClick={() => setDiscountType(discountType === "amount" ? "percent" : "amount")}
                  className="flex items-center gap-1 text-xs font-medium border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted transition-colors"
                >
                  {discountType === "percent" ? <Percent className="h-3 w-3" /> : <span className="font-mono text-xs">LKR</span>}
                </button>
              </div>

              {/* Totals */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatLKR(subtotal)}</span>
                </div>
                {discountAmt > 0 && (
                  <div className="flex justify-between text-[color:var(--brand-success)]">
                    <span>Discount</span>
                    <span className="font-mono">- {formatLKR(discountAmt)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-xl">
                  <span className="text-foreground">Total</span>
                  <span className="font-mono text-primary">{formatLKR(total)}</span>
                </div>
              </div>

              <button
                onClick={() => setCheckoutOpen(true)}
                className="w-full h-14 rounded-xl font-bold text-lg text-white transition-all active:scale-[0.98]"
                style={{ backgroundColor: "var(--cta)" }}
              >
                Charge — {formatLKR(total)}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setPaymentMethod(value)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors",
                      paymentMethod === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === "CASH" && (
              <div className="space-y-2">
                <Label htmlFor="tendered">Amount Tendered (LKR)</Label>
                <Input
                  id="tendered"
                  type="number"
                  min={total}
                  step={0.01}
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                  className="font-mono text-lg h-12"
                  placeholder={total.toFixed(2)}
                />
                {change >= 0 && amountTendered && (
                  <div className="flex justify-between items-center rounded-lg bg-[color:var(--brand-success)]/10 border border-[color:var(--brand-success)]/20 px-4 py-2">
                    <span className="text-sm font-medium text-[color:var(--brand-success)]">Change</span>
                    <span className="text-lg font-bold font-mono text-[color:var(--brand-success)]">
                      {formatLKR(change)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <Separator />

            <div className="flex justify-between items-center">
              <span className="font-semibold text-foreground">Total Due</span>
              <span className="text-2xl font-bold font-mono text-primary">{formatLKR(total)}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCheckoutOpen(false)} disabled={loading}>
              Back
            </Button>
            <Button
              onClick={completeSale}
              disabled={loading || (paymentMethod === "CASH" && parseFloat(amountTendered || "0") < total)}
              className="font-bold flex-1"
              style={{ backgroundColor: "var(--cta)", color: "white" }}
            >
              {loading ? "Processing..." : "Confirm Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[color:var(--brand-success)]">
              <Check className="h-5 w-5" />
              Sale Complete!
            </DialogTitle>
          </DialogHeader>

          {completedSale && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm font-mono">
                {completedSale.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-foreground">
                      {item.product.name} × {item.quantity}
                    </span>
                    <span className="font-semibold">{formatLKR(item.lineTotal)}</span>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary">{formatLKR(completedSale.total)}</span>
                </div>
                {completedSale.paymentMethod === "CASH" && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Change</span>
                    <span>{formatLKR(completedSale.amountPaid - completedSale.total)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Receipt
                </Button>
                <Button
                  className="flex-1 font-semibold"
                  onClick={() => {
                    setShowReceipt(false);
                    clearCart();
                  }}
                >
                  New Sale
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
