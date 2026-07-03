"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Product {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
}

interface StockAdjustDialogProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSave: () => void;
}

const MOVEMENT_TYPES = [
  { value: "RESTOCK",          label: "Restock — add stock" },
  { value: "ADJUSTMENT",       label: "Correction — set stock to exact count" },
  { value: "DAMAGE",           label: "Damage / Loss — subtract from stock" },
  { value: "RETURN",           label: "Customer Return — add back" },
  { value: "SET_OUT_OF_STOCK", label: "Set as Out of Stock" },
];

export function StockAdjustDialog({ open, product, onClose, onSave }: StockAdjustDialogProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("RESTOCK");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  function reset() {
    setType("RESTOCK");
    setQuantity("");
    setNote("");
  }

  const isOutOfStock = type === "SET_OUT_OF_STOCK";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;

    if (!isOutOfStock) {
      if (!quantity) {
        toast.error("Please enter a quantity");
        return;
      }
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty < 0) {
        toast.error("Please enter a valid quantity");
        return;
      }
      if ((type === "ADJUSTMENT" || type === "DAMAGE") && !note) {
        toast.error("Please provide a reason");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/products/adjust-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isOutOfStock
            ? { productId: product.id, type: "SET_OUT_OF_STOCK", note: note || "Marked as out of stock" }
            : { productId: product.id, type, quantity: parseFloat(quantity), note }
        ),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to adjust stock");
        return;
      }

      toast.success(
        isOutOfStock
          ? `${product.name} marked as out of stock`
          : `Stock updated — new level: ${data.newStock} ${product.unit}`
      );
      reset();
      onSave();
    } catch {
      toast.error("Failed to adjust stock");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            {product?.name} — current stock:{" "}
            <span className="font-semibold font-mono">{Number(product?.stockQty ?? 0)} {product?.unit}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Adjustment Type</Label>
            <Select value={type} onValueChange={(v) => { if (v) { setType(v); setQuantity(""); } }}>
              <SelectTrigger id="type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-(--radix-select-trigger-width) max-w-[calc(100vw-2rem)]">
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isOutOfStock ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              This will set <span className="font-semibold">{product?.name}</span> stock to{" "}
              <span className="font-mono font-semibold">0 {product?.unit}</span>. The item will appear as
              &ldquo;Out of Stock&rdquo; and cannot be sold until restocked.
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity ({product?.unit})</Label>
              <Input
                id="qty"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="font-mono"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">
              Note {(type === "ADJUSTMENT" || type === "DAMAGE") ? "*" : "(optional)"}
            </Label>
            <Textarea
              id="note"
              placeholder={
                isOutOfStock
                  ? "e.g. Spoilage, expired batch, damaged stock"
                  : type === "RESTOCK"
                  ? "e.g. New delivery from supplier"
                  : type === "ADJUSTMENT"
                  ? "e.g. Physical count showed 12 units (required)"
                  : type === "DAMAGE"
                  ? "e.g. Expired, broken, spoiled (required)"
                  : "e.g. Customer returned unopened item"
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              required={type === "ADJUSTMENT" || type === "DAMAGE"}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={isOutOfStock ? "bg-destructive hover:bg-destructive/90 font-semibold" : "font-semibold"}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isOutOfStock ? "Set Out of Stock" : "Update Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
