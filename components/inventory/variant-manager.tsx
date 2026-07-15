"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Shirt, AlertTriangle, Pencil, X, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface ProductVariant {
  id: string;
  size: string;
  color: string | null;
  sku: string | null;
  stockQty: number;
  lowStockAt: number;
  sellPrice: number | null;
}

interface EditForm {
  size: string;
  color: string;
  sku: string;
  stockQty: string;
  lowStockAt: string;
  sellPrice: string;
}

interface Props {
  productId: string | null;
  productName: string;
  baseSellPrice: number;
  open: boolean;
  onClose: () => void;
}

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size", "28", "30", "32", "34", "36", "38", "40", "42"];

function StockPill({ qty, low }: { qty: number; low: number }) {
  if (qty <= 0)
    return <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">Out</Badge>;
  if (qty <= low)
    return <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] gap-1"><AlertTriangle className="h-2.5 w-2.5" />{qty}</Badge>;
  return <Badge className="bg-green-100 text-green-700 border-green-300 text-[10px]">{qty}</Badge>;
}

const EMPTY_EDIT: EditForm = { size: "", color: "", sku: "", stockQty: "", lowStockAt: "", sellPrice: "" };

export function VariantManager({ productId, productName, baseSellPrice, open, onClose }: Props) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ size: "", color: "", sku: "", stockQty: "", lowStockAt: "3", sellPrice: "" });
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchVariants = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/variants`);
      const data = await res.json();
      setVariants((data.variants ?? []).map((v: ProductVariant) => ({
        ...v,
        stockQty: Number(v.stockQty),
        lowStockAt: Number(v.lowStockAt),
        sellPrice: v.sellPrice !== null ? Number(v.sellPrice) : null,
      })));
    } catch {
      toast.error("Failed to load variants");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (open && productId) fetchVariants();
    else { setVariants([]); setAddOpen(false); setEditingId(null); }
  }, [open, productId, fetchVariants]);

  async function handleAdd() {
    if (!productId || !addForm.size.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          size: addForm.size.trim(),
          color: addForm.color.trim() || null,
          sku: addForm.sku.trim() || null,
          stockQty: parseFloat(addForm.stockQty || "0"),
          lowStockAt: parseFloat(addForm.lowStockAt || "3"),
          sellPrice: addForm.sellPrice ? parseFloat(addForm.sellPrice) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to add variant"); return; }
      toast.success(`${addForm.size}${addForm.color ? ` / ${addForm.color}` : ""} added`);
      setAddForm({ size: "", color: "", sku: "", stockQty: "", lowStockAt: "3", sellPrice: "" });
      setAddOpen(false);
      fetchVariants();
    } catch {
      toast.error("Failed to add variant");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(v: ProductVariant) {
    setAddOpen(false);
    setEditingId(v.id);
    setEditForm({
      size: v.size,
      color: v.color ?? "",
      sku: v.sku ?? "",
      stockQty: String(v.stockQty),
      lowStockAt: String(v.lowStockAt),
      sellPrice: v.sellPrice !== null ? String(v.sellPrice) : "",
    });
  }

  async function handleSaveEdit(variantId: string) {
    if (!editForm.size.trim()) { toast.error("Size is required"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}/variants/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          size: editForm.size.trim(),
          color: editForm.color.trim() || null,
          sku: editForm.sku.trim() || null,
          stockQty: parseFloat(editForm.stockQty || "0"),
          lowStockAt: parseFloat(editForm.lowStockAt || "3"),
          sellPrice: editForm.sellPrice ? parseFloat(editForm.sellPrice) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to save"); return; }
      toast.success("Variant updated");
      setEditingId(null);
      fetchVariants();
    } catch {
      toast.error("Failed to save variant");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(variantId: string, label: string) {
    setDeletingId(variantId);
    try {
      const res = await fetch(`/api/products/${productId}/variants/${variantId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`${label} removed`);
      if (editingId === variantId) setEditingId(null);
      fetchVariants();
    } catch {
      toast.error("Failed to remove variant");
    } finally {
      setDeletingId(null);
    }
  }

  const totalStock = variants.reduce((s, v) => s + v.stockQty, 0);
  const lowCount = variants.filter((v) => v.stockQty > 0 && v.stockQty <= v.lowStockAt).length;
  const outCount = variants.filter((v) => v.stockQty <= 0).length;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Shirt className="h-4 w-4 text-muted-foreground" />
            <SheetTitle className="text-base">{productName}</SheetTitle>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{variants.length} variant{variants.length !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>Total stock: <span className="font-semibold text-foreground">{totalStock}</span></span>
            {lowCount > 0 && <><span>·</span><span className="text-amber-600 font-semibold">{lowCount} low</span></>}
            {outCount > 0 && <><span>·</span><span className="text-destructive font-semibold">{outCount} out</span></>}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Add variant form */}
          {addOpen ? (
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">New Variant</p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {COMMON_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setAddForm((f) => ({ ...f, size: s }))}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      addForm.size === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:border-primary/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-1">
                  <Label className="text-xs">Size <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. M, 32, Free Size" value={addForm.size}
                    onChange={(e) => setAddForm((f) => ({ ...f, size: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Colour <span className="text-muted-foreground">(optional)</span></Label>
                  <Input placeholder="e.g. Red, Navy Blue" value={addForm.color}
                    onChange={(e) => setAddForm((f) => ({ ...f, color: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Stock Qty</Label>
                  <Input type="number" min={0} placeholder="0" value={addForm.stockQty}
                    onChange={(e) => setAddForm((f) => ({ ...f, stockQty: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Low Stock Alert</Label>
                  <Input type="number" min={0} placeholder="3" value={addForm.lowStockAt}
                    onChange={(e) => setAddForm((f) => ({ ...f, lowStockAt: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price Override <span className="text-muted-foreground">(blank = LKR {baseSellPrice.toLocaleString()})</span></Label>
                  <Input type="number" min={0} placeholder={baseSellPrice.toString()} value={addForm.sellPrice}
                    onChange={(e) => setAddForm((f) => ({ ...f, sellPrice: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">SKU / Barcode <span className="text-muted-foreground">(optional)</span></Label>
                  <Input placeholder="Variant barcode" value={addForm.sku}
                    onChange={(e) => setAddForm((f) => ({ ...f, sku: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={adding || !addForm.size.trim()} className="gap-1.5">
                  {adding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add Variant
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-3 border-b border-border">
              <Button size="sm" onClick={() => { setEditingId(null); setAddOpen(true); }} className="gap-1.5 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Variant
              </Button>
            </div>
          )}

          {/* Variant list */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : variants.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-2 text-muted-foreground">
              <Shirt className="h-8 w-8 opacity-25" />
              <p className="text-sm">No variants yet</p>
              <p className="text-xs">Add sizes and colours using the button above</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {variants.map((v) => {
                const label = v.color ? `${v.size} / ${v.color}` : v.size;
                const price = v.sellPrice !== null ? v.sellPrice : baseSellPrice;
                const isEditing = editingId === v.id;

                if (isEditing) {
                  return (
                    <div key={v.id} className="px-6 py-4 bg-muted/30 border-l-2 border-primary">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider">Editing: {label}</p>
                        <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Size chips */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {COMMON_SIZES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setEditForm((f) => ({ ...f, size: s }))}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                              editForm.size === s
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover:border-primary/50"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Size <span className="text-destructive">*</span></Label>
                          <Input placeholder="e.g. M, 32" value={editForm.size}
                            onChange={(e) => setEditForm((f) => ({ ...f, size: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Colour <span className="text-muted-foreground">(optional)</span></Label>
                          <Input placeholder="e.g. Red" value={editForm.color}
                            onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Stock Qty</Label>
                          <Input type="number" min={0} value={editForm.stockQty}
                            onChange={(e) => setEditForm((f) => ({ ...f, stockQty: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Low Stock Alert</Label>
                          <Input type="number" min={0} value={editForm.lowStockAt}
                            onChange={(e) => setEditForm((f) => ({ ...f, lowStockAt: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Price Override <span className="text-muted-foreground">(blank = LKR {baseSellPrice.toLocaleString()})</span></Label>
                          <Input type="number" min={0} placeholder={baseSellPrice.toString()} value={editForm.sellPrice}
                            onChange={(e) => setEditForm((f) => ({ ...f, sellPrice: e.target.value }))} className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">SKU / Barcode <span className="text-muted-foreground">(optional)</span></Label>
                          <Input placeholder="Variant barcode" value={editForm.sku}
                            onChange={(e) => setEditForm((f) => ({ ...f, sku: e.target.value }))} className="h-8 text-sm" />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(v.id)} disabled={saving || !editForm.size.trim()} className="gap-1.5">
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Save Changes
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto text-destructive hover:text-destructive"
                          onClick={() => handleDelete(v.id, label)}
                          disabled={deletingId === v.id}
                        >
                          {deletingId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={v.id} className="px-6 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        <StockPill qty={v.stockQty} low={v.lowStockAt} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        LKR {price.toLocaleString("en-LK")}
                        {v.sellPrice !== null && <span className="ml-1 text-primary">(custom)</span>}
                        {v.sku && <span className="ml-2 font-mono">· {v.sku}</span>}
                        <span className="ml-2">· alert at {v.lowStockAt}</span>
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
                      onClick={() => startEdit(v)}
                      title="Edit variant"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => handleDelete(v.id, label)}
                      disabled={deletingId === v.id}
                      title="Remove variant"
                    >
                      {deletingId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
