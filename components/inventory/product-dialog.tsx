"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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

const UNITS = ["pcs", "kg", "g", "l", "ml", "box", "pack", "dozen", "pair", "set", "sqft"];

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
    label: "Other",
    items: ["Pet Supplies", "Agriculture & Farming", "Other"],
  },
];

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stockQty: number;
  lowStockAt: number;
  imageUrl: string | null;
  warrantyPeriod: string | null;
}

interface ProductDialogProps {
  open: boolean;
  product?: Product | null;
  onClose: () => void;
  onSave: () => void;
}

export function ProductDialog({ open, product, onClose, onSave }: ProductDialogProps) {
  const isEdit = !!product;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    unit: "pcs",
    costPrice: "",
    sellPrice: "",
    stockQty: "",
    lowStockAt: "5",
    warrantyPeriod: "",
  });

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku ?? "",
        category: product.category ?? "",
        unit: product.unit,
        costPrice: String(product.costPrice),
        sellPrice: String(product.sellPrice),
        stockQty: String(product.stockQty),
        lowStockAt: String(product.lowStockAt),
        warrantyPeriod: product.warrantyPeriod ?? "",
      });
    } else {
      setForm({ name: "", sku: "", category: "", unit: "pcs", costPrice: "", sellPrice: "", stockQty: "", lowStockAt: "5", warrantyPeriod: "" });
    }
  }, [product, open]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.sellPrice || !form.costPrice) {
      toast.error("Name, cost price and sell price are required");
      return;
    }

    setLoading(true);
    try {
      const url = isEdit ? `/api/products/${product!.id}` : "/api/products";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          sku: form.sku || null,
          category: form.category || null,
          unit: form.unit,
          costPrice: parseFloat(form.costPrice),
          sellPrice: parseFloat(form.sellPrice),
          stockQty: parseFloat(form.stockQty || "0"),
          lowStockAt: parseFloat(form.lowStockAt || "5"),
          warrantyPeriod: form.warrantyPeriod.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save product");
        return;
      }

      toast.success(isEdit ? "Product updated" : "Product added");
      onSave();
    } catch {
      toast.error("Failed to save product");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Sunlight Soap 100g"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Barcode</Label>
              <Input
                id="sku"
                placeholder="e.g. 4890123456789"
                value={form.sku}
                onChange={(e) => update("sku", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select value={form.unit} onValueChange={(v) => v && update("unit", v)}>
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="costPrice">Cost Price (LKR) *</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.costPrice}
                onChange={(e) => update("costPrice", e.target.value)}
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellPrice">Sell Price (LKR) *</Label>
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

          <div className="space-y-2">
            <Label htmlFor="warrantyPeriod">Warranty Period <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="warrantyPeriod"
              placeholder="e.g. 1 year, 6 months, 2 years"
              value={form.warrantyPeriod}
              onChange={(e) => update("warrantyPeriod", e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="font-semibold">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEdit ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
