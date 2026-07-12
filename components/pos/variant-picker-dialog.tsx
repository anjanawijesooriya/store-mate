"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface PickerVariant {
  id: string;
  size: string;
  color: string | null;
  stockQty: number;
  lowStockAt: number;
  sellPrice: number | null;
}

interface Props {
  productId: string | null;
  productName: string;
  baseSellPrice: number;
  open: boolean;
  onClose: () => void;
  onSelect: (variant: PickerVariant) => void;
}

export function VariantPickerDialog({
  productId,
  productName,
  baseSellPrice,
  open,
  onClose,
  onSelect,
}: Props) {
  const [variants, setVariants] = useState<PickerVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PickerVariant | null>(null);

  useEffect(() => {
    if (!open || !productId) {
      setVariants([]);
      setSelected(null);
      return;
    }
    setLoading(true);
    fetch(`/api/products/${productId}/variants`)
      .then((r) => r.json())
      .then((d) => {
        setVariants(
          (d.variants ?? []).map((v: PickerVariant) => ({
            ...v,
            stockQty: Number(v.stockQty),
            lowStockAt: Number(v.lowStockAt),
            sellPrice: v.sellPrice !== null ? Number(v.sellPrice) : null,
          }))
        );
      })
      .catch(() => toast.error("Failed to load variants"))
      .finally(() => setLoading(false));
  }, [open, productId]);

  function handleConfirm() {
    if (!selected) return;
    onSelect(selected);
    setSelected(null);
    onClose();
  }

  const selectedPrice =
    selected?.sellPrice != null ? selected.sellPrice : baseSellPrice;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug">{productName}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Select a size / colour to add to cart</p>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : variants.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-6">No variants available</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 py-2 max-h-64 overflow-y-auto">
            {variants.map((v) => {
              const label = v.color ? `${v.size} / ${v.color}` : v.size;
              const outOfStock = v.stockQty <= 0;
              const lowStock = !outOfStock && v.stockQty <= v.lowStockAt;
              const isSelected = selected?.id === v.id;
              return (
                <button
                  key={v.id}
                  disabled={outOfStock}
                  onClick={() => setSelected(v)}
                  className={`relative flex flex-col items-center rounded-lg border-2 px-2 py-2.5 text-xs font-medium transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : outOfStock
                      ? "border-border bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50"
                      : "border-border hover:border-primary/50 text-foreground"
                  }`}
                >
                  <span className="font-semibold text-sm leading-tight text-center break-words w-full">
                    {label}
                  </span>
                  {outOfStock ? (
                    <span className="mt-1 text-[10px] text-destructive">Out of stock</span>
                  ) : lowStock ? (
                    <span className="mt-1 text-[10px] text-amber-600 flex items-center gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" />
                      {v.stockQty} left
                    </span>
                  ) : (
                    <span className="mt-1 text-[10px] text-muted-foreground">{v.stockQty} in stock</span>
                  )}
                  {v.sellPrice !== null && (
                    <Badge className="mt-1 text-[9px] px-1 py-0 h-auto bg-primary/10 text-primary border-primary/20">
                      custom price
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-sm flex justify-between items-center">
            <span className="text-muted-foreground">
              {selected.color ? `${selected.size} / ${selected.color}` : selected.size}
            </span>
            <span className="font-bold font-mono text-primary">
              LKR {selectedPrice.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelected(null);
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selected}>
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
