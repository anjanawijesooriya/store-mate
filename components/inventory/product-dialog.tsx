"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, ScanBarcode, Shirt } from "lucide-react";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

const PRODUCT_UNITS = ["pcs", "kg", "g", "l", "ml", "box", "pack", "dozen", "pair", "set", "sqft"];
const SERVICE_UNITS = ["job", "visit", "hour", "session", "repair", "installation", "service", "pcs"];

const CATEGORY_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Food & Beverages",
    items: ["Groceries", "Beverages", "Dairy & Eggs", "Bakery & Bread", "Meat & Seafood",
            "Vegetables", "Fruits", "Snacks & Confectionery", "Spices & Condiments", "Frozen Foods"],
  },
  {
    label: "Health & Beauty",
    items: ["Makeup & Cosmetics", "Skincare", "Hair Care", "Salon & Spa Products",
            "Perfumes & Fragrances", "Personal Care", "Medicine & Supplements", "Baby Products"],
  },
  {
    label: "Electronics & Tech",
    items: ["Mobile Phones", "Mobile Accessories", "Computers & Laptops", "Computer Accessories",
            "Audio & Visual", "Cameras & Photography", "Batteries & Chargers", "Electronics"],
  },
  {
    label: "Home & Living",
    items: ["Household Items", "Kitchen & Cookware", "Furniture & Home Decor",
            "Cleaning Products", "Bedding & Linens", "Garden & Outdoor"],
  },
  {
    label: "Clothing & Fashion",
    items: ["Clothing", "Footwear", "Fashion Accessories", "Jewellery & Watches", "Bags & Luggage", "Kids Clothing"],
  },
  {
    label: "Automotive",
    items: ["Vehicle Spare Parts", "Vehicle Accessories", "Lubricants & Oils", "Tyres & Wheels"],
  },
  {
    label: "Hardware & Tools",
    items: ["Hardware", "Tools & Equipment", "Electrical Supplies", "Plumbing Supplies", "Building Materials"],
  },
  {
    label: "Stationery & Office",
    items: ["Stationery", "Books & Magazines", "Office Supplies", "Art & Craft"],
  },
  {
    label: "Sports & Leisure",
    items: ["Sports Equipment", "Toys & Games"],
  },
  {
    label: "Services",
    items: ["Repair & Maintenance", "Installation", "Consultation", "Delivery", "Cleaning", "Tailoring", "Other Services"],
  },
  {
    label: "Other",
    items: ["Pet Supplies", "Agriculture & Farming", "Other"],
  },
];

interface Product {
  id: string;
  name: string;
  itemCode: string | null;
  sku: string | null;
  category: string | null;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stockQty: number;
  lowStockAt: number;
  imageUrl: string | null;
  warrantyPeriod: string | null;
  isWeighted?: boolean;
  pluCode?: string | null;
  isService?: boolean;
  _count?: { variants: number };
}

export interface SavedProduct {
  id: string;
  name: string;
  sellPrice: number;
  openVariants: boolean;
}

interface ProductDialogProps {
  open: boolean;
  product?: Product | null;
  variantsEnabled?: boolean;
  weightedProductsEnabled?: boolean;
  onClose: () => void;
  onSave: (created?: SavedProduct) => void;
  isService?: boolean;
}

export function ProductDialog({ open, product, variantsEnabled, weightedProductsEnabled, onClose, onSave, isService: forceService }: ProductDialogProps) {
  const isEdit = !!product;
  const serviceMode = forceService ?? product?.isService ?? false;
  const [loading, setLoading] = useState(false);
  const [skuFlash, setSkuFlash] = useState(false);
  const skuRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // true when editing a product that already has variants — locked, cannot turn off
  const lockedVariants = isEdit && (product?._count?.variants ?? 0) > 0;
  const [hasVariants, setHasVariants] = useState(false);
  const [isWeighted, setIsWeighted] = useState(false);

  const handleBarcodeScan = useCallback((barcode: string) => {
    update("sku", barcode);
    skuRef.current?.focus();
    setSkuFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSkuFlash(false), 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useBarcodeScan(handleBarcodeScan, { enabled: open && !serviceMode });

  const [form, setForm] = useState({
    name: "",
    itemCode: "",
    sku: "",
    category: "",
    unit: serviceMode ? "job" : "pcs",
    costPrice: "",
    sellPrice: "",
    stockQty: "",
    lowStockAt: "5",
    warrantyPeriod: "",
    pluCode: "",
  });

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        itemCode: product.itemCode ?? "",
        sku: product.sku ?? "",
        category: product.category ?? "",
        unit: product.unit,
        costPrice: String(product.costPrice),
        sellPrice: String(product.sellPrice),
        stockQty: String(product.stockQty),
        lowStockAt: String(product.lowStockAt),
        warrantyPeriod: product.warrantyPeriod ?? "",
        pluCode: product.pluCode ?? "",
      });
      setHasVariants((product._count?.variants ?? 0) > 0);
      setIsWeighted(product.isWeighted ?? false);
    } else {
      setForm({
        name: "",
        itemCode: "",
        sku: "",
        category: "",
        unit: serviceMode ? "job" : "pcs",
        costPrice: "",
        sellPrice: "",
        stockQty: "",
        lowStockAt: "5",
        warrantyPeriod: "",
        pluCode: "",
      });
      setHasVariants(false);
      setIsWeighted(false);
    }
  }, [product, open, serviceMode]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.sellPrice) {
      toast.error(serviceMode ? "Service name and price are required" : "Name, cost price and sell price are required");
      return;
    }
    if (!serviceMode && !form.costPrice) {
      toast.error("Cost price is required");
      return;
    }

    setLoading(true);
    try {
      const url = isEdit ? `/api/products/${product!.id}` : "/api/products";
      const method = isEdit ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        name: form.name,
        itemCode: form.itemCode || null,
        sku: form.sku || null,
        category: form.category || null,
        unit: form.unit,
        sellPrice: parseFloat(form.sellPrice),
        isService: serviceMode,
      };

      if (serviceMode) {
        body.costPrice = parseFloat(form.costPrice || "0");
      } else {
        body.costPrice = parseFloat(form.costPrice);
        if (hasVariants) {
          // Stock tracked per variant — product-level stock stays 0
          body.stockQty = 0;
          body.lowStockAt = 0;
        } else {
          body.stockQty = parseFloat(form.stockQty || "0");
          body.lowStockAt = parseFloat(form.lowStockAt || "5");
        }
        body.warrantyPeriod = form.warrantyPeriod.trim() || null;
        body.isWeighted = isWeighted;
        const isScaleUnit = ["kg", "g"].includes(form.unit);
        body.pluCode = isWeighted && isScaleUnit ? (form.pluCode.trim() || null) : null;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        return;
      }

      toast.success(isEdit ? (serviceMode ? "Service updated" : "Product updated") : (serviceMode ? "Service added" : "Product added"));

      if (!isEdit && !serviceMode && hasVariants && data.product) {
        onSave({ id: data.product.id, name: data.product.name, sellPrice: parseFloat(form.sellPrice), openVariants: true });
      } else {
        onSave();
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setLoading(false);
    }
  }

  const title = isEdit
    ? (serviceMode ? "Edit Service" : "Edit Product")
    : (serviceMode ? "Add Service" : "Add Product");

  const MEASURE_UNITS = ["kg", "g", "l", "ml"];
  const units = serviceMode ? SERVICE_UNITS : isWeighted ? MEASURE_UNITS : PRODUCT_UNITS;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{serviceMode ? "Service Name" : "Product Name"} *</Label>
            <Input
              id="name"
              placeholder={serviceMode ? "e.g. Screen Repair, Oil Change" : "e.g. Sunlight Soap 100g"}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="itemCode">Item Code</Label>
            <Input
              id="itemCode"
              placeholder="e.g. PROD-001, ITM-2024"
              value={form.itemCode}
              onChange={(e) => update("itemCode", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!serviceMode && (
              <div className="space-y-2">
                <Label htmlFor="sku">SKU / Barcode</Label>
                <div className="relative">
                  <Input
                    ref={skuRef}
                    id="sku"
                    placeholder="Type or scan barcode"
                    value={form.sku}
                    onChange={(e) => update("sku", e.target.value)}
                    className={skuFlash ? "pr-20 ring-2 ring-[color:var(--brand-success)] border-[color:var(--brand-success)] transition-all" : "pr-8"}
                  />
                  {skuFlash ? (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[color:var(--brand-success)] pointer-events-none">
                      Scanned!
                    </span>
                  ) : (
                    <span
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      title="Scan a barcode to fill automatically"
                    >
                      <ScanBarcode className="h-4 w-4 text-muted-foreground/40" />
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className={`space-y-2 ${serviceMode ? "col-span-2" : ""}`}>
              <Label htmlFor="unit">{serviceMode ? "Unit / Billing Type" : "Unit"}</Label>
              <Select value={form.unit} onValueChange={(v) => v && update("unit", v)}>
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={form.category} onValueChange={(v) => v && update("category", v)}>
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                className="max-h-72 min-w-[240px] max-w-[calc(100vw-2rem)]"
              >
                {CATEGORY_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.items.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="costPrice">
                {serviceMode ? "Labour Cost (LKR)" : "Cost Price (LKR) *"}
                {serviceMode && <span className="text-muted-foreground font-normal"> (optional)</span>}
              </Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.costPrice}
                onChange={(e) => update("costPrice", e.target.value)}
                required={!serviceMode}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellPrice">{serviceMode ? "Charge Price (LKR) *" : "Sell Price (LKR) *"}</Label>
              <Input
                id="sellPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.sellPrice}
                onChange={(e) => update("sellPrice", e.target.value)}
                required
                className="font-mono"
              />
            </div>
          </div>

          {/* Variants toggle — only for physical products when variantsEnabled */}
          {!serviceMode && variantsEnabled && (
            <label className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              hasVariants
                ? "border-primary/40 bg-primary/5"
                : "border-border hover:bg-muted/40"
            } ${lockedVariants ? "opacity-60 cursor-not-allowed" : ""}`}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary flex-shrink-0"
                checked={hasVariants}
                disabled={lockedVariants}
                onChange={(e) => !lockedVariants && setHasVariants(e.target.checked)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Shirt className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <p className="text-sm font-medium">This product has variants</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lockedVariants
                    ? "Stock is tracked per variant — manage via the Variants button"
                    : "Enable to track stock per size / colour instead of at product level"}
                </p>
              </div>
            </label>
          )}

          {!serviceMode && (
            <>
              {hasVariants ? (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 text-xs text-primary leading-relaxed flex items-start gap-2">
                  <Shirt className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    Opening stock and low stock alert are set <strong>per variant</strong>.
                    {!isEdit && " After saving this product, the Variant Manager will open so you can add sizes and stock."}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="stockQty">{isEdit ? "Current Stock" : "Opening Stock"}</Label>
                    <Input
                      id="stockQty"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={form.stockQty}
                      onChange={(e) => update("stockQty", e.target.value)}
                      className="font-mono"
                      disabled={isEdit}
                    />
                    {isEdit && (
                      <p className="text-xs text-muted-foreground">Use stock adjustment to change stock level</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lowStockAt">Low Stock Alert At</Label>
                    <Input
                      id="lowStockAt"
                      type="number"
                      step="1"
                      min="0"
                      placeholder="5"
                      value={form.lowStockAt}
                      onChange={(e) => update("lowStockAt", e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="warrantyPeriod">Warranty Period <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="warrantyPeriod"
                  placeholder="e.g. 1 year, 6 months, 2 years"
                  value={form.warrantyPeriod}
                  onChange={(e) => update("warrantyPeriod", e.target.value)}
                />
              </div>

              {/* Sold by weight / volume — only shown when enabled by admin */}
              {weightedProductsEnabled && <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Sold by weight / volume</p>
                    <p className="text-xs text-muted-foreground mt-0.5">For items weighed on a scale (kg, g) or dispensed by volume (L, ml)</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isWeighted}
                    onClick={() => {
                      const next = !isWeighted;
                      setIsWeighted(next);
                      if (next && !["kg", "g", "l", "ml"].includes(form.unit)) update("unit", "kg");
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${isWeighted ? "bg-primary" : "bg-input"}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform ${isWeighted ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                </div>
                {isWeighted && ["kg", "g"].includes(form.unit) && (
                  <div className="space-y-1.5">
                    <Label htmlFor="pluCode" className="text-xs">PLU Code <span className="text-muted-foreground font-normal">(5-digit code for label-printing scale — weight products only)</span></Label>
                    <Input
                      id="pluCode"
                      placeholder="e.g. 00123"
                      maxLength={5}
                      value={form.pluCode}
                      onChange={(e) => update("pluCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
                      className="font-mono w-36"
                    />
                    <p className="text-xs text-muted-foreground">Set the same 5-digit PLU on your weighing scale to match this product.</p>
                  </div>
                )}
                {isWeighted && ["l", "ml"].includes(form.unit) && (
                  <p className="text-xs text-muted-foreground">Volume products (L, ml) — cashier enters quantity manually at POS. No scale barcode integration.</p>
                )}
              </div>}
            </>
          )}

          {serviceMode && (
            <div className="rounded-lg bg-blue-500/8 border border-blue-500/20 px-3 py-2.5 text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
              Services are always available in POS — no stock tracking or deductions.
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="font-semibold">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEdit ? "Save Changes" : (serviceMode ? "Add Service" : (hasVariants ? "Add Product & Manage Variants →" : "Add Product"))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
