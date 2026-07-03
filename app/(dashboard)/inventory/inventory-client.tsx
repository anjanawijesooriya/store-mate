"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Package, Edit, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
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
import { ProductDialog } from "@/components/inventory/product-dialog";
import { StockAdjustDialog } from "@/components/inventory/stock-adjust-dialog";
import { cn } from "@/lib/utils";

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
  isActive: boolean;
}

function formatLKR(n: number) {
  const [int, dec] = Number(n).toFixed(2).split(".");
  return `LKR ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${dec}`;
}

function StockBadge({ qty, low }: { qty: number; low: number }) {
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

export function InventoryClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [filter, setFilter] = useState(searchParams.get("filter") ?? "");
  const [addOpen, setAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter) params.set("filter", filter);
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`${product.name} removed`);
      fetchProducts();
    } catch {
      toast.error("Failed to delete product");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        description={`${total} product${total !== 1 ? "s" : ""}`}
        action={
          <Button onClick={() => setAddOpen(true)} className="font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
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
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description={
            filter === "low-stock"
              ? "No products are running low on stock right now."
              : "Add your first product to start managing your inventory."
          }
          action={
            filter === ""
              ? { label: "Add Product", onClick: () => setAddOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Product</TableHead>
                <TableHead className="font-semibold">SKU</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold text-right">Cost</TableHead>
                <TableHead className="font-semibold text-right">Price</TableHead>
                <TableHead className="font-semibold text-center">Stock</TableHead>
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
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {product.sku ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {product.category ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatLKR(Number(product.costPrice))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">
                    {formatLKR(Number(product.sellPrice))}
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => setAdjustProduct(product)}
                      className="inline-flex"
                      title="Adjust stock"
                    >
                      <StockBadge qty={Number(product.stockQty)} low={Number(product.lowStockAt)} />
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setAdjustProduct(product)}
                        title="Adjust stock"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditProduct(product)}
                        title="Edit product"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(product)}
                        title="Delete product"
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
        onClose={() => setAddOpen(false)}
        onSave={() => {
          setAddOpen(false);
          fetchProducts();
        }}
      />
      <ProductDialog
        open={!!editProduct}
        product={editProduct}
        onClose={() => setEditProduct(null)}
        onSave={() => {
          setEditProduct(null);
          fetchProducts();
        }}
      />
      <StockAdjustDialog
        open={!!adjustProduct}
        product={adjustProduct}
        onClose={() => setAdjustProduct(null)}
        onSave={() => {
          setAdjustProduct(null);
          fetchProducts();
        }}
      />
    </div>
  );
}
