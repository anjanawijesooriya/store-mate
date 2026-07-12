"use client";

import { useState, useEffect, useCallback } from "react";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Upload, Download, Search, Package, Wrench, Edit, Trash2, AlertTriangle, RefreshCw, Shirt } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProductDialog, SavedProduct } from "@/components/inventory/product-dialog";
import { StockAdjustDialog } from "@/components/inventory/stock-adjust-dialog";
import { ImportDialog } from "@/components/inventory/import-dialog";
import { VariantManager } from "@/components/inventory/variant-manager";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  itemCode: string | null;
  sku: string | null;
  category: string | null;
  unit: string;
  costPrice: number;
  sellPrice: number;
  variantPriceMin?: number | null;
  variantPriceMax?: number | null;
  stockQty: number;
  lowStockAt: number;
  imageUrl: string | null;
  isActive: boolean;
  warrantyPeriod: string | null;
  isService: boolean;
  isWeighted?: boolean;
  _count?: { variants: number };
}

function formatLKR(n: number) {
  const [int, dec] = Number(n).toFixed(2).split(".");
  return `LKR ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${dec}`;
}

function StockBadge({ qty, low, isWeighted }: { qty: number; low: number; isWeighted?: boolean }) {
  if (isWeighted)
    return (
      <Badge className="bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-50 dark:bg-sky-950/30 dark:border-sky-800 dark:text-sky-400">
        by weight
      </Badge>
    );
  if (qty <= 0)
    return (
      <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15">
        Out of stock
      </Badge>
    );
  if (qty <= low)
    return (
      <Badge className="bg-[color:var(--brand-warning)]/15 text-[color:var(--brand-warning)] border-[color:var(--brand-warning)]/30 hover:bg-[color:var(--brand-warning)]/15">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Low ({qty})
      </Badge>
    );
  return (
    <Badge className="bg-[color:var(--brand-success)]/15 text-[color:var(--brand-success)] border-[color:var(--brand-success)]/30 hover:bg-[color:var(--brand-success)]/15">
      {qty}
    </Badge>
  );
}

type TabMode = "product" | "service";

export function InventoryClient() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabMode>("product");
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [filter, setFilter] = useState(searchParams.get("filter") ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [variantsEnabled, setVariantsEnabled] = useState(false);
  const [weightedProductsEnabled, setWeightedProductsEnabled] = useState(false);
  const [variantProduct, setVariantProduct] = useState<{ id: string; name: string; sellPrice: number } | null>(null);

  useEffect(() => {
    fetch("/api/shop").then((r) => r.json()).then((d) => {
      setVariantsEnabled(d.shop?.variantsEnabled ?? false);
      setWeightedProductsEnabled(d.shop?.weightedProductsEnabled ?? false);
    }).catch(() => {});
  }, []);

  const fetchProducts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("type", tab);
      if (search) params.set("search", search);
      if (filter && tab === "product") params.set("filter", filter);
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts((data.products ?? []).sort((a: Product, b: Product) => a.name.localeCompare(b.name)));
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [search, filter, tab]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useAutoRefresh(useCallback(() => fetchProducts(true), [fetchProducts]));

  // Reset filter when switching to service tab
  useEffect(() => {
    if (tab === "service") setFilter("");
  }, [tab]);

  async function confirmDelete() {
    if (!deleteProduct) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteProduct.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`"${deleteProduct.name}" deleted`);
      setDeleteProduct(null);
      fetchProducts();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("type", tab);
      params.set("limit", "10000");
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      const allProducts: Product[] = (data.products ?? []).sort(
        (a: Product, b: Product) => a.name.localeCompare(b.name),
      );

      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Sheet 1 — Products
      const headers = [
        "Name", "Item Code", "SKU", "Category", "Unit",
        "Cost Price", "Sell Price", "Stock Qty", "Low Stock Alert", "Warranty Period",
      ];
      const rows = allProducts.map((p) => [
        p.name,
        p.itemCode ?? "",
        p.sku ?? "",
        p.category ?? "",
        p.unit,
        Number(p.costPrice),
        Number(p.sellPrice),
        Number(p.stockQty),
        Number(p.lowStockAt),
        p.warrantyPeriod ?? "",
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = [
        { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 8 },
        { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 17 }, { wch: 16 },
      ];
      const sheetName = tab === "service" ? "Services" : "Products";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Sheet 2 — Variants (only when variantsEnabled and not service tab)
      const hasVariantProducts = !isServiceTab && variantsEnabled &&
        allProducts.some((p) => (p._count?.variants ?? 0) > 0);
      if (hasVariantProducts) {
        const varRes = await fetch("/api/products/variants");
        if (varRes.ok) {
          const varData = await varRes.json();
          type VRow = { variantId: string; productName: string; itemCode: string | null; size: string; color: string | null; sku: string | null; stockQty: number; lowStockAt: number; sellPrice: number | null };
          const varHeaders = [
            "Variant ID", "Product Name", "Item Code", "Size", "Colour", "Variant SKU",
            "Stock Qty", "Low Stock Alert", "Price Override",
          ];
          const varRows = (varData.variants as VRow[]).map((v) => [
            v.variantId,
            v.productName,
            v.itemCode ?? "",
            v.size,
            v.color ?? "",
            v.sku ?? "",
            v.stockQty,
            v.lowStockAt,
            v.sellPrice ?? "",
          ]);
          const ws2 = XLSX.utils.aoa_to_sheet([varHeaders, ...varRows]);
          ws2["!cols"] = [
            { wch: 28 }, { wch: 26 }, { wch: 13 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
            { wch: 10 }, { wch: 17 }, { wch: 14 },
          ];
          XLSX.utils.book_append_sheet(wb, ws2, "Variants");
        }
      }

      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `estoremate-${tab}s-${date}.xlsx`);
      toast.success(
        hasVariantProducts
          ? `${allProducts.length} products + variants exported (2 sheets)`
          : `${allProducts.length} ${tab}s exported`
      );
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  const isServiceTab = tab === "service";
  const itemLabel = isServiceTab ? "service" : "product";
  const itemLabelPlural = isServiceTab ? "services" : "products";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        description={`${total} ${total !== 1 ? itemLabelPlural : itemLabel}`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="font-semibold gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{exporting ? "Exporting…" : "Export Excel"}</span>
              <span className="sm:hidden">Export</span>
            </Button>
            {!isServiceTab && (
              <Button
                variant="outline"
                onClick={() => setImportOpen(true)}
                className="font-semibold gap-2"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import Excel</span>
                <span className="sm:hidden">Import</span>
              </Button>
            )}
            <Button onClick={() => setAddOpen(true)} className="font-semibold">
              <Plus className="h-4 w-4 mr-2" />
              {isServiceTab ? "Add Service" : "Add Product"}
            </Button>
          </div>
        }
      />

      {/* Tab toggle */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => setTab("product")}
          className={cn(
            "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all",
            tab === "product"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Package className="h-4 w-4" />
          Products
        </button>
        <button
          onClick={() => setTab("service")}
          className={cn(
            "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all",
            tab === "service"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Wrench className="h-4 w-4" />
          Services
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isServiceTab ? "Search services..." : "Search products or SKU..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {!isServiceTab && (
          <div className="flex gap-2">
            {["", "low-stock"].map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
                className={cn(f === "low-stock" && filter === f && "bg-[color:var(--brand-warning)] border-[color:var(--brand-warning)]")}
              >
                {f === "" ? "All" : "Low Stock"}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={isServiceTab ? Wrench : Package}
          title={isServiceTab ? "No services yet" : "No products yet"}
          description={
            filter === "low-stock"
              ? "No products are running low on stock right now."
              : isServiceTab
                ? "Add services like repairs, installations, or consultations."
                : "Add your first product to start managing your inventory."
          }
          action={
            filter === ""
              ? { label: isServiceTab ? "Add Service" : "Add Product", onClick: () => setAddOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden shadow-sm overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">{isServiceTab ? "Service" : "Product"}</TableHead>
                {!isServiceTab && <TableHead className="font-semibold hidden md:table-cell">Item Code</TableHead>}
                {!isServiceTab && <TableHead className="font-semibold hidden lg:table-cell">SKU / Barcode</TableHead>}
                <TableHead className="font-semibold hidden md:table-cell">Category</TableHead>
                {!isServiceTab && <TableHead className="font-semibold hidden lg:table-cell">Warranty</TableHead>}
                <TableHead className="font-semibold text-right hidden sm:table-cell">Cost</TableHead>
                <TableHead className="font-semibold text-right">Price</TableHead>
                {!isServiceTab && <TableHead className="font-semibold text-center">Stock</TableHead>}
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product, i) => (
                <TableRow
                  key={product.id}
                  className={cn(i % 2 === 0 ? "bg-background" : "bg-muted/20")}
                >
                  <TableCell>
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.unit}</p>
                  </TableCell>
                  {!isServiceTab && (
                    <TableCell className="text-sm text-muted-foreground font-mono hidden md:table-cell">
                      {product.itemCode ?? "—"}
                    </TableCell>
                  )}
                  {!isServiceTab && (
                    <TableCell className="text-sm text-muted-foreground font-mono hidden lg:table-cell">
                      {product.sku ?? "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                    {product.category ?? "—"}
                  </TableCell>
                  {!isServiceTab && (
                    <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                      {product.warrantyPeriod ?? "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                    {formatLKR(Number(product.costPrice))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">
                    {(() => {
                      const hasVariants = variantsEnabled && (product._count?.variants ?? 0) > 0;
                      const min = product.variantPriceMin;
                      const max = product.variantPriceMax;
                      if (hasVariants && min !== null && min !== undefined && max !== null && max !== undefined && min !== max) {
                        return (
                          <span className="text-xs">
                            {formatLKR(min)}
                            <span className="text-muted-foreground mx-1">–</span>
                            {formatLKR(max)}
                          </span>
                        );
                      }
                      const displayPrice = hasVariants && min !== null && min !== undefined ? min : Number(product.sellPrice);
                      return formatLKR(displayPrice);
                    })()}
                  </TableCell>
                  {!isServiceTab && (
                    <TableCell className="text-center">
                      {variantsEnabled && (product._count?.variants ?? 0) > 0 ? (
                        <button
                          onClick={() => setVariantProduct({ id: product.id, name: product.name, sellPrice: Number(product.sellPrice) })}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 rounded-full px-2 py-0.5 hover:bg-primary/5 transition-colors"
                          title="Manage variants"
                        >
                          <Shirt className="h-3 w-3" />
                          {product._count!.variants} variant{product._count!.variants !== 1 ? "s" : ""}
                        </button>
                      ) : variantsEnabled && Number(product.stockQty) <= 0 ? (
                        <button
                          onClick={() => setVariantProduct({ id: product.id, name: product.name, sellPrice: Number(product.sellPrice) })}
                          className="inline-flex"
                          title="Add variants to set up stock"
                        >
                          <Badge className="bg-muted text-muted-foreground border-border hover:bg-muted gap-1">
                            <Shirt className="h-3 w-3" />
                            No variants
                          </Badge>
                        </button>
                      ) : (
                        <button
                          onClick={() => setAdjustProduct(product)}
                          className="inline-flex"
                          title="Adjust stock"
                        >
                          <StockBadge qty={Number(product.stockQty)} low={Number(product.lowStockAt)} isWeighted={product.isWeighted} />
                        </button>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!isServiceTab && variantsEnabled && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary/70 hover:text-primary"
                          onClick={() => setVariantProduct({ id: product.id, name: product.name, sellPrice: Number(product.sellPrice) })}
                          title="Manage variants"
                        >
                          <Shirt className="h-4 w-4" />
                        </Button>
                      )}
                      {!isServiceTab && (product._count?.variants ?? 0) === 0 && (!variantsEnabled || Number(product.stockQty) > 0) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setAdjustProduct(product)}
                          title="Adjust stock"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditProduct(product)}
                        title={isServiceTab ? "Edit service" : "Edit product"}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteProduct(product)}
                        title={isServiceTab ? "Delete service" : "Delete product"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      <ProductDialog
        open={addOpen}
        isService={isServiceTab}
        variantsEnabled={variantsEnabled}
        weightedProductsEnabled={weightedProductsEnabled}
        onClose={() => setAddOpen(false)}
        onSave={(created?: SavedProduct) => {
          setAddOpen(false);
          fetchProducts(true).then(() => {
            if (created?.openVariants) {
              setVariantProduct({ id: created.id, name: created.name, sellPrice: created.sellPrice });
            }
          });
        }}
      />
      <ProductDialog
        open={!!editProduct}
        product={editProduct}
        variantsEnabled={variantsEnabled}
        weightedProductsEnabled={weightedProductsEnabled}
        onClose={() => setEditProduct(null)}
        onSave={() => {
          setEditProduct(null);
          fetchProducts(true);
        }}
      />
      {!isServiceTab && (
        <StockAdjustDialog
          open={!!adjustProduct}
          product={adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onSave={() => {
            setAdjustProduct(null);
            fetchProducts();
          }}
        />
      )}

      <ImportDialog
        open={importOpen}
        variantsEnabled={variantsEnabled}
        weightedProductsEnabled={weightedProductsEnabled}
        onClose={() => { setImportOpen(false); fetchProducts(true); }}
        onImported={() => fetchProducts(true)}
      />

      {variantsEnabled && (
        <VariantManager
          productId={variantProduct?.id ?? null}
          productName={variantProduct?.name ?? ""}
          baseSellPrice={Number(variantProduct?.sellPrice ?? 0)}
          open={!!variantProduct}
          onClose={() => { setVariantProduct(null); fetchProducts(); }}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteProduct} onOpenChange={(o) => { if (!o && !deleting) setDeleteProduct(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete {isServiceTab ? "Service" : "Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold">&ldquo;{deleteProduct?.name}&rdquo;</span>?
            </p>
            <div className="rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2.5 text-xs text-destructive leading-relaxed">
              This action cannot be undone. Past sales records are preserved.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteProduct(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : `Delete ${isServiceTab ? "Service" : "Product"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
