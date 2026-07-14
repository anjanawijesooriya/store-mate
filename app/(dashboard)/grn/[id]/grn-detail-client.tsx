"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  PackagePlus,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCT_UNITS = ["pcs", "kg", "g", "l", "ml", "box", "pack", "dozen", "pair", "set", "sqft"];

const CATEGORY_GROUPS: { label: string; items: string[] }[] = [
  { label: "Food & Beverages",   items: ["Groceries", "Beverages", "Dairy & Eggs", "Bakery & Bread", "Meat & Seafood", "Vegetables", "Fruits", "Snacks & Confectionery", "Spices & Condiments", "Frozen Foods"] },
  { label: "Health & Beauty",    items: ["Makeup & Cosmetics", "Skincare", "Hair Care", "Salon & Spa Products", "Perfumes & Fragrances", "Personal Care", "Medicine & Supplements", "Baby Products"] },
  { label: "Electronics & Tech", items: ["Mobile Phones", "Mobile Accessories", "Computers & Laptops", "Computer Accessories", "Audio & Visual", "Cameras & Photography", "Batteries & Chargers", "Electronics"] },
  { label: "Home & Living",      items: ["Household Items", "Kitchen & Cookware", "Furniture & Home Decor", "Cleaning Products", "Bedding & Linens", "Garden & Outdoor"] },
  { label: "Clothing & Fashion", items: ["Clothing", "Footwear", "Fashion Accessories", "Jewellery & Watches", "Bags & Luggage", "Kids Clothing"] },
  { label: "Automotive",         items: ["Vehicle Spare Parts", "Vehicle Accessories", "Lubricants & Oils", "Tyres & Wheels"] },
  { label: "Hardware & Tools",   items: ["Hardware", "Tools & Equipment", "Electrical Supplies", "Plumbing Supplies", "Building Materials"] },
  { label: "Stationery & Office",items: ["Stationery", "Books & Magazines", "Office Supplies", "Art & Craft"] },
  { label: "Sports & Leisure",   items: ["Sports Equipment", "Toys & Games"] },
  { label: "Services",           items: ["Repair & Maintenance", "Installation", "Consultation", "Delivery", "Cleaning", "Tailoring", "Other Services"] },
  { label: "Other",              items: ["Pet Supplies", "Agriculture & Farming", "Other"] },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type GRNStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

interface GRNItem {
  id: string;
  productId: string | null;
  product: { id: string; name: string; unit: string; costPrice: number; itemCode: string | null } | null;
  newName: string | null;
  newCategory: string | null;
  newUnit: string | null;
  newSellPrice: number | null;
  newItemCode: string | null;
  quantity: number;
  unitCost: number;
  updateCost: boolean;
}

interface GRN {
  id: string;
  supplierName: string | null;
  referenceNo: string | null;
  note: string | null;
  status: GRNStatus;
  confirmedAt: string | null;
  createdAt: string;
  items: GRNItem[];
}

interface ProductHit {
  id: string;
  name: string;
  unit: string;
  costPrice: number;
  stockQty: number;
  itemCode: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLKR(n: number) {
  const [int, dec] = Number(n).toFixed(2).split(".");
  return `LKR ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${dec}`;
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("en-LK", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function itemDisplayName(item: GRNItem): string {
  return item.product?.name ?? item.newName ?? "Unknown";
}

function itemUnit(item: GRNItem): string {
  return item.product?.unit ?? item.newUnit ?? "pcs";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GrnDetailClient({ id }: { id: string }) {
  const router = useRouter();

  const [grn, setGrn]         = useState<GRN | null>(null);
  const [loading, setLoading] = useState(true);

  // Header edit
  const [editingHeader, setEditingHeader]   = useState(false);
  const [headerSupplier, setHeaderSupplier] = useState("");
  const [headerRef, setHeaderRef]           = useState("");
  const [headerNote, setHeaderNote]         = useState("");
  const [savingHeader, setSavingHeader]     = useState(false);

  // Add item search
  const [search, setSearch]                 = useState("");
  const [searchResults, setSearchResults]   = useState<ProductHit[]>([]);
  const [searching, setSearching]           = useState(false);
  const searchTimer                         = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add item form (existing product)
  const [selectedProduct, setSelectedProduct] = useState<ProductHit | null>(null);
  const [addQty, setAddQty]                   = useState("");
  const [addCost, setAddCost]                 = useState("");
  const [addUpdateCost, setAddUpdateCost]     = useState(true);
  const [addingItem, setAddingItem]           = useState(false);

  // New-product mode
  const [newProductMode, setNewProductMode]   = useState(false);
  const [npName, setNpName]                   = useState("");
  const [npCategory, setNpCategory]           = useState("");
  const [npUnit, setNpUnit]                   = useState("pcs");
  const [npSellPrice, setNpSellPrice]         = useState("");
  const [npItemCode, setNpItemCode]           = useState("");
  const [npQty, setNpQty]                     = useState("");
  const [npCost, setNpCost]                   = useState("");

  // Remove item
  const [removingItemId, setRemovingItemId]   = useState<string | null>(null);

  // Confirm dialog
  const [confirmOpen, setConfirmOpen]         = useState(false);
  const [confirming, setConfirming]           = useState(false);

  // Cancel
  const [cancelling, setCancelling]           = useState(false);

  // ── Load GRN ─────────────────────────────────────────────────

  async function loadGrn() {
    try {
      const res = await fetch(`/api/grn/${id}`);
      if (!res.ok) { toast.error("GRN not found"); router.push("/grn"); return; }
      const data: GRN = await res.json();
      setGrn(data);
      setHeaderSupplier(data.supplierName ?? "");
      setHeaderRef(data.referenceNo ?? "");
      setHeaderNote(data.note ?? "");
    } catch {
      toast.error("Failed to load GRN");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadGrn(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Product search ────────────────────────────────────────────

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(search.trim())}&limit=8`);
        const data = await res.json();
        setSearchResults(
          (data.products ?? []).map((p: ProductHit & { costPrice: string | number; stockQty: string | number }) => ({
            ...p,
            costPrice: Number(p.costPrice),
            stockQty:  Number(p.stockQty),
          }))
        );
      } catch { /* silent */ } finally { setSearching(false); }
    }, 250);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  function selectProduct(p: ProductHit) {
    setSelectedProduct(p);
    setAddCost(p.costPrice > 0 ? p.costPrice.toFixed(2) : "");
    setAddQty("");
    setSearch("");
    setSearchResults([]);
    setNewProductMode(false);
  }

  function clearAddForm() {
    setSelectedProduct(null);
    setAddQty("");
    setAddCost("");
    setAddUpdateCost(true);
    setSearch("");
    setSearchResults([]);
    setNpName(""); setNpCategory(""); setNpUnit("pcs");
    setNpSellPrice(""); setNpItemCode(""); setNpQty(""); setNpCost("");
  }

  // ── Save header ───────────────────────────────────────────────

  async function saveHeader() {
    if (!grn) return;
    setSavingHeader(true);
    try {
      const res = await fetch(`/api/grn/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_header", supplierName: headerSupplier, referenceNo: headerRef, note: headerNote }),
      });
      if (!res.ok) { toast.error("Failed to save"); return; }
      setGrn((g) => g ? { ...g, supplierName: headerSupplier || null, referenceNo: headerRef || null, note: headerNote || null } : g);
      setEditingHeader(false);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingHeader(false);
    }
  }

  // ── Add item ──────────────────────────────────────────────────

  async function handleAddItem() {
    const qty  = parseFloat(addQty);
    const cost = parseFloat(addCost);
    if (!selectedProduct || isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) return;

    setAddingItem(true);
    try {
      const res = await fetch(`/api/grn/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_item", productId: selectedProduct.id, quantity: qty, unitCost: cost, updateCost: addUpdateCost }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to add item"); return; }
      setGrn((g) => g ? { ...g, items: [...g.items, data.item] } : g);
      clearAddForm();
      toast.success(`${selectedProduct.name} added`);
    } catch {
      toast.error("Failed to add item");
    } finally {
      setAddingItem(false);
    }
  }

  async function handleAddNewProduct() {
    const qty  = parseFloat(npQty);
    const cost = parseFloat(npCost);
    const sellP = npSellPrice ? parseFloat(npSellPrice) : null;
    if (!npName.trim() || isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
      toast.error("Product name, quantity, and cost price are required");
      return;
    }

    setAddingItem(true);
    try {
      const res = await fetch(`/api/grn/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_item",
          newName: npName, newCategory: npCategory, newUnit: npUnit || "pcs",
          newSellPrice: sellP, newItemCode: npItemCode,
          quantity: qty, unitCost: cost,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to add item"); return; }
      setGrn((g) => g ? { ...g, items: [...g.items, data.item] } : g);
      clearAddForm();
      toast.success(`New product "${npName}" queued — will be created on confirm`);
    } catch {
      toast.error("Failed to add item");
    } finally {
      setAddingItem(false);
    }
  }

  // ── Remove item ───────────────────────────────────────────────

  async function handleRemoveItem(itemId: string) {
    setRemovingItemId(itemId);
    try {
      const res = await fetch(`/api/grn/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_item", itemId }),
      });
      if (!res.ok) { toast.error("Failed to remove item"); return; }
      setGrn((g) => g ? { ...g, items: g.items.filter((i) => i.id !== itemId) } : g);
    } catch {
      toast.error("Failed to remove item");
    } finally {
      setRemovingItemId(null);
    }
  }

  // ── Confirm GRN ───────────────────────────────────────────────

  async function handleConfirm() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/grn/${id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to confirm GRN"); return; }
      toast.success("GRN confirmed — stock updated");
      setConfirmOpen(false);
      loadGrn();
    } catch {
      toast.error("Failed to confirm GRN");
    } finally {
      setConfirming(false);
    }
  }

  // ── Cancel GRN ────────────────────────────────────────────────

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/grn/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to cancel GRN"); return; }
      toast.success("GRN cancelled");
      router.push("/grn");
    } catch {
      toast.error("Failed to cancel GRN");
    } finally {
      setCancelling(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────

  const totalValue = grn?.items.reduce((s, i) => s + i.quantity * i.unitCost, 0) ?? 0;
  const totalQty   = grn?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const isDraft    = grn?.status === "DRAFT";

  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!grn) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/grn")} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> GRNs
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">GRN #{grn.id.slice(-8).toUpperCase()}</h1>
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold flex-shrink-0",
            grn.status === "DRAFT"     && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
            grn.status === "CONFIRMED" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            grn.status === "CANCELLED" && "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
          )}>
            {grn.status === "DRAFT"     && <><Loader2 className="h-3 w-3" /> Draft</>}
            {grn.status === "CONFIRMED" && <><CheckCircle2 className="h-3 w-3" /> Confirmed</>}
            {grn.status === "CANCELLED" && <><XCircle className="h-3 w-3" /> Cancelled</>}
          </span>
        </div>
        {/* Action buttons */}
        {isDraft && (
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
              Cancel GRN
            </Button>
            <Button
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={grn.items.length === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Confirm & Receive
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column: header + items ─────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Header card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  GRN Details
                </CardTitle>
                {isDraft && !editingHeader && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setEditingHeader(true)}>
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {editingHeader ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Supplier Name</Label>
                      <Input value={headerSupplier} onChange={(e) => setHeaderSupplier(e.target.value)} placeholder="e.g. ABC Distributors" className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Reference / Invoice No.</Label>
                      <Input value={headerRef} onChange={(e) => setHeaderRef(e.target.value)} placeholder="e.g. INV-2024-001" className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Note</Label>
                    <Input value={headerNote} onChange={(e) => setHeaderNote(e.target.value)} placeholder="Optional note" className="h-8 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveHeader} disabled={savingHeader} className="h-7 text-xs">
                      {savingHeader ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />} Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingHeader(false); setHeaderSupplier(grn.supplierName ?? ""); setHeaderRef(grn.referenceNo ?? ""); setHeaderNote(grn.note ?? ""); }} className="h-7 text-xs">
                      <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Supplier</p>
                    <p className="font-medium">{grn.supplierName || <span className="text-muted-foreground italic">Not set</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reference No.</p>
                    <p className="font-medium">{grn.referenceNo || <span className="text-muted-foreground italic">Not set</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">{formatDateTime(grn.createdAt)}</p>
                  </div>
                  {grn.confirmedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Confirmed At</p>
                      <p className="font-medium">{formatDateTime(grn.confirmedAt)}</p>
                    </div>
                  )}
                  {grn.note && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Note</p>
                      <p className="font-medium">{grn.note}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Items ({grn.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {grn.items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No items yet — add products below</p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Product</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Qty</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Unit Cost</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Subtotal</th>
                        {isDraft && <th className="w-8 px-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {grn.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-3 py-2.5">
                            <p className="font-medium">{itemDisplayName(item)}</p>
                            {!item.productId && (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">New product</span>
                            )}
                            {item.product?.itemCode && (
                              <p className="text-xs text-muted-foreground">Code: {item.product.itemCode}</p>
                            )}
                            {item.updateCost && item.productId && (
                              <p className="text-xs text-amber-600 dark:text-amber-400">Cost price will update</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                            {item.quantity} {itemUnit(item)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">{formatLKR(item.unitCost)}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold">{formatLKR(item.quantity * item.unitCost)}</td>
                          {isDraft && (
                            <td className="px-2 py-2.5">
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                disabled={removingItemId === item.id}
                                className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                              >
                                {removingItemId === item.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Add item panel — DRAFT only ───────────────────── */}
          {isDraft && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Add Item
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Mode toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setNewProductMode(false); clearAddForm(); }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      !newProductMode
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    <Search className="h-3.5 w-3.5" /> Existing Product
                  </button>
                  <button
                    onClick={() => { setNewProductMode(true); clearAddForm(); }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      newProductMode
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    <PackagePlus className="h-3.5 w-3.5" /> New Product
                  </button>
                </div>

                {/* ── Existing product ── */}
                {!newProductMode && (
                  <div className="space-y-3">
                    {!selectedProduct ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by name, item code or SKU..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                          />
                          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                        {searchResults.length > 0 && (
                          <div className="rounded-lg border border-border divide-y divide-border shadow-sm">
                            {searchResults.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => selectProduct(p)}
                                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                              >
                                <div>
                                  <p className="text-sm font-medium">{p.name}</p>
                                  <p className="text-xs text-muted-foreground">Stock: {p.stockQty} {p.unit}{p.itemCode ? ` · ${p.itemCode}` : ""}</p>
                                </div>
                                <p className="text-xs text-muted-foreground font-mono">Cost: {formatLKR(p.costPrice)}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-lg bg-muted/40 border border-border px-3 py-2.5">
                          <div>
                            <p className="text-sm font-medium">{selectedProduct.name}</p>
                            <p className="text-xs text-muted-foreground">Current stock: {selectedProduct.stockQty} {selectedProduct.unit}</p>
                          </div>
                          <button onClick={clearAddForm} className="text-muted-foreground hover:text-foreground">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Quantity Received</Label>
                            <Input
                              type="number" min="0.01" step="0.01"
                              value={addQty} onChange={(e) => setAddQty(e.target.value)}
                              placeholder={`e.g. 10 ${selectedProduct.unit}`}
                              className="h-9 font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Unit Cost (LKR)</Label>
                            <Input
                              type="number" min="0" step="0.01"
                              value={addCost} onChange={(e) => setAddCost(e.target.value)}
                              placeholder="0.00"
                              className="h-9 font-mono"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={addUpdateCost}
                            onChange={(e) => setAddUpdateCost(e.target.checked)}
                            className="rounded"
                          />
                          Update product cost price to {addCost ? formatLKR(parseFloat(addCost) || 0) : "new cost"}
                        </label>
                        {addQty && addCost && (
                          <p className="text-xs text-muted-foreground font-mono">
                            Subtotal: {formatLKR((parseFloat(addQty) || 0) * (parseFloat(addCost) || 0))}
                          </p>
                        )}
                        <Button
                          size="sm"
                          onClick={handleAddItem}
                          disabled={addingItem || !addQty || !addCost}
                          className="gap-1.5"
                        >
                          {addingItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          Add to GRN
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── New product ── */}
                {newProductMode && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-3 py-2">
                      This product will be created in your inventory when you confirm the GRN.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs">Product Name <span className="text-destructive">*</span></Label>
                        <Input value={npName} onChange={(e) => setNpName(e.target.value)} placeholder="e.g. Basmati Rice 1kg" className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Category</Label>
                        <Select value={npCategory} onValueChange={(v) => v && setNpCategory(v)}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72 min-w-[260px]">
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
                      <div className="space-y-1.5">
                        <Label className="text-xs">Unit</Label>
                        <Select value={npUnit} onValueChange={(v) => v && setNpUnit(v)}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_UNITS.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Item Code</Label>
                        <Input value={npItemCode} onChange={(e) => setNpItemCode(e.target.value)} placeholder="Optional" className="h-9 font-mono" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Selling Price (LKR)</Label>
                        <Input type="number" min="0" step="0.01" value={npSellPrice} onChange={(e) => setNpSellPrice(e.target.value)} placeholder="0.00" className="h-9 font-mono" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Quantity Received <span className="text-destructive">*</span></Label>
                        <Input type="number" min="0.01" step="0.01" value={npQty} onChange={(e) => setNpQty(e.target.value)} placeholder="e.g. 50" className="h-9 font-mono" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Unit Cost (LKR) <span className="text-destructive">*</span></Label>
                        <Input type="number" min="0" step="0.01" value={npCost} onChange={(e) => setNpCost(e.target.value)} placeholder="0.00" className="h-9 font-mono" />
                      </div>
                    </div>
                    {npQty && npCost && (
                      <p className="text-xs text-muted-foreground font-mono">
                        Subtotal: {formatLKR((parseFloat(npQty) || 0) * (parseFloat(npCost) || 0))}
                      </p>
                    )}
                    <Button
                      size="sm"
                      onClick={handleAddNewProduct}
                      disabled={addingItem || !npName.trim() || !npQty || !npCost}
                      className="gap-1.5"
                    >
                      {addingItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackagePlus className="h-3.5 w-3.5" />}
                      Add New Product to GRN
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column: summary ────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total items</span>
                <span className="font-medium">{grn.items.length} line{grn.items.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total units</span>
                <span className="font-medium font-mono">{totalQty.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm font-bold">
                <span>Total Value</span>
                <span className="font-mono text-foreground">{formatLKR(totalValue)}</span>
              </div>

              {grn.items.some((i) => !i.productId) && (
                <div className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-3 py-2">
                  {grn.items.filter((i) => !i.productId).length} new product{grn.items.filter((i) => !i.productId).length !== 1 ? "s" : ""} will be created on confirm.
                </div>
              )}

              {isDraft && grn.items.length > 0 && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setConfirmOpen(true)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm & Receive Stock
                </Button>
              )}

              {grn.status === "CONFIRMED" && (
                <div className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded px-3 py-2 font-medium">
                  Stock received and inventory updated.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Confirm dialog ────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Goods Received?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>This will update inventory stock for all {grn.items.length} item{grn.items.length !== 1 ? "s" : ""} and lock the GRN. This cannot be undone.</p>
            <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-1.5">
              <div className="flex justify-between">
                <span>Lines</span>
                <span className="font-medium text-foreground">{grn.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total units</span>
                <span className="font-mono text-foreground">{totalQty.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-foreground">
                <span>Total value</span>
                <span className="font-mono">{formatLKR(totalValue)}</span>
              </div>
              {grn.items.some((i) => !i.productId) && (
                <p className="text-xs text-blue-700 dark:text-blue-400 pt-1 border-t border-border">
                  {grn.items.filter((i) => !i.productId).length} new product{grn.items.filter((i) => !i.productId).length !== 1 ? "s" : ""} will be created.
                </p>
              )}
            </div>
          </div>
          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={confirming}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={confirming} className="bg-green-600 hover:bg-green-700 text-white">
              {confirming && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm & Receive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
