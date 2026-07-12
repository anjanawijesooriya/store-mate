"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  Smartphone,
  BookOpen,
  Percent,
  Tag,
  X,
  Printer,
  Check,
  WifiOff,
  RefreshCw,
  User,
  MessageSquare,
  Mail,
  Download,
  ScanBarcode,
  TriangleAlert,
  Bookmark,
  BookmarkCheck,
  Share2,
  Shirt,
} from "lucide-react";
import { VariantPickerDialog, type PickerVariant } from "@/components/pos/variant-picker-dialog";
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
import {
  cacheProducts,
  getCachedProducts,
  deductCachedStock,
  addPendingSale,
  getPendingSales,
  removePendingSale,
  markSaleFailed,
  type CachedProduct,
} from "@/lib/offline-db";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  creditBalance: number;
}

interface Product {
  id: string;
  name: string;
  itemCode: string | null;
  sku: string | null;
  unit: string;
  sellPrice: number;
  stockQty: number;
  category: string | null;
  warrantyPeriod: string | null;
  isService: boolean;
  _count?: { variants: number };
}

interface CartItem {
  cartKey: string;
  productId: string;
  variantId?: string;
  variantLabel?: string;
  name: string;
  itemCode: string | null;
  unit: string;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  lineTotal: number;
  stockQty: number;
  warrantyPeriod: string | null;
  isService: boolean;
}

const FRACTIONAL_UNITS = new Set(["kg", "g", "l", "L", "ml", "mL", "liter", "litre", "gram", "kilo", "oz", "lb"]);

function isFractional(unit: string) {
  return FRACTIONAL_UNITS.has(unit) || FRACTIONAL_UNITS.has(unit.toLowerCase());
}

function qtyStep(unit: string) {
  const u = unit.toLowerCase();
  if (u === "g" || u === "ml") return 50;   // grams/ml → step 50
  if (u === "kg" || u === "l") return 0.25;  // kg/L → step 250g
  return 1;
}

interface HeldCart {
  id: string;
  savedAt: string;
  cart: CartItem[];
  discount: number;
  discountType: "amount" | "percent";
  customer: Customer | null;
}

interface CompletedSale {
  id: string;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  paymentMethod: string;
  items: Array<{
    name: string;
    itemCode?: string | null;
    unit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    warrantyPeriod?: string | null;
  }>;
  createdAt: string;
  isOffline?: boolean;
}

interface ShopInfo {
  name: string;
  phone: string | null;
  address: string | null;
  smsAddonEnabled: boolean;
  smsReceiptEnabled: boolean;
  emailReceiptEnabled: boolean;
  variantsEnabled: boolean;
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "CARD", label: "Card", icon: CreditCard },
  { value: "ONLINE", label: "Online", icon: Smartphone },
  { value: "CREDIT", label: "Credit", icon: BookOpen },
];

function formatLKR(n: number) {
  const [int, dec] = Number(n).toFixed(2).split(".");
  const thousands = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `LKR ${thousands}.${dec}`;
}

async function checkConnectivity(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    await fetch("/api/ping", {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return true;
  } catch {
    return false;
  }
}

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  const probe = useCallback(async () => {
    const reachable = await checkConnectivity();
    setIsOnline(reachable);
  }, []);

  useEffect(() => {
    probe();
    const handleOnline = () => probe();
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const interval = setInterval(probe, 10_000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [probe]);

  return isOnline;
}

function toProduct(p: CachedProduct): Product {
  return {
    id: p.id,
    name: p.name,
    itemCode: p.itemCode ?? null,
    sku: p.sku,
    unit: p.unit,
    sellPrice: p.sellPrice,
    stockQty: p.stockQty,
    category: p.category,
    warrantyPeriod: p.warrantyPeriod,
    isService: p.isService ?? false,
    _count: { variants: p.variantCount ?? 0 },
  };
}

export function POSClient({
  cardSurchargeEnabled = false,
  cardSurchargeRate = 0,
}: {
  cardSurchargeEnabled?: boolean;
  cardSurchargeRate?: number;
}) {
  const { data: session } = useSession();
  const shopId = session?.user?.shopId ?? "";
  const planTier = (session?.user?.planTier ?? "BASIC") as string;
  const offlinePOSAllowed = planTier !== "BASIC";
  const isOnline = useOnlineStatus();

  const [maintenanceMsg, setMaintenanceMsg] = useState<string | null>(null);
  const [maintenanceDismissed, setMaintenanceDismissed] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [allServices, setAllServices] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [allCached, setAllCached] = useState<CachedProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");

  // Poll maintenance status — show/hide card in real time
  useEffect(() => {
    let prevActive = false;

    function checkMaintenance() {
      fetch("/api/billing")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          const active = !!d?.billing?.maintenanceBanner;
          const msg = active
            ? (d.billing.maintenanceBannerMessage || "System maintenance in progress — transactions may be affected.")
            : null;

          // If maintenance just switched ON, reset dismissed so card reappears
          if (active && !prevActive) setMaintenanceDismissed(false);
          prevActive = active;
          setMaintenanceMsg(msg);
        })
        .catch(() => {});
    }

    checkMaintenance();

    const onVisible = () => { if (document.visibilityState === "visible") checkMaintenance(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", checkMaintenance);
    const interval = setInterval(checkMaintenance, 30_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", checkMaintenance);
      clearInterval(interval);
    };
  }, []);

  // Restore cart + held carts from localStorage after mount (persists across navigation)
  useEffect(() => {
    if (!shopId) return;
    try {
      const raw = localStorage.getItem(`pos-cart-${shopId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed) && parsed.length > 0) setCart(parsed);
      }
      const disc = localStorage.getItem(`pos-discount-${shopId}`);
      if (disc) setDiscount(parseFloat(disc) || 0);
      const held = localStorage.getItem(`pos-held-${shopId}`);
      if (held) {
        const parsed = JSON.parse(held) as HeldCart[];
        if (Array.isArray(parsed) && parsed.length > 0) setHeldCarts(parsed);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  // Persist cart to localStorage on every change
  useEffect(() => {
    if (!shopId) return;
    try {
      localStorage.setItem(`pos-cart-${shopId}`, JSON.stringify(cart));
    } catch {}
  }, [cart, shopId]);

  useEffect(() => {
    if (!shopId) return;
    try {
      localStorage.setItem(`pos-discount-${shopId}`, String(discount));
    } catch {}
  }, [discount, shopId]);

  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountTendered, setAmountTendered] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [sendingSms, setSendingSms] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [heldOpen, setHeldOpen] = useState(false);

  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);

  // Persist held carts to localStorage on every change
  useEffect(() => {
    if (!shopId) return;
    try {
      localStorage.setItem(`pos-held-${shopId}`, JSON.stringify(heldCarts));
    } catch {}
  }, [heldCarts, shopId]);

  // Barcode scanner — look up product by SKU from the in-memory cache and add to cart
  const handleBarcodeScan = useCallback((barcode: string) => {
    const barcodeLower = barcode.toLowerCase();
    const match = allCached.find(
      (p) => p.sku && p.sku.toLowerCase() === barcodeLower
    );
    if (!match) {
      toast.error(`No product found for barcode: ${barcode}`, { duration: 3000 });
      // Clear whatever the scanner typed into the search box
      setSearchQuery("");
      setSearchResults([]);
      return;
    }
    // Clear the search box first, then add — addToCart already handles stock checks
    setSearchQuery("");
    setSearchResults([]);
    addToCart({
      id: match.id,
      name: match.name,
      itemCode: match.itemCode ?? null,
      sku: match.sku,
      unit: match.unit,
      sellPrice: match.sellPrice,
      stockQty: match.stockQty,
      category: match.category,
      warrantyPeriod: match.warrantyPeriod ?? null,
      isService: match.isService ?? false,
      // _count not available in cached products — variant picker won't trigger for offline barcodes
    });
  // addToCart is defined below — stable because it only uses setCart + toast
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCached]);

  useBarcodeScan(handleBarcodeScan);

  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const discountAmt =
    discountType === "percent" ? (subtotal * discount) / 100 : discount;
  const total = Math.max(0, subtotal - discountAmt);
  const change = parseFloat(amountTendered || "0") - total;

  // Fetch shop contact details for receipt — wait for session so auth cookie is ready
  useEffect(() => {
    if (!session?.user?.shopId) return;
    fetch("/api/shop")
      .then((r) => r.ok ? r.json() : null)
      .then((s) => {
        if (s?.shop) setShopInfo({
          name: s.shop.name ?? "",
          phone: s.shop.phone ?? null,
          address: s.shop.address ?? null,
          smsAddonEnabled:     s.shop.smsAddonEnabled     ?? false,
          smsReceiptEnabled:   s.shop.smsReceiptEnabled   ?? false,
          emailReceiptEnabled: s.shop.emailReceiptEnabled ?? true,
          variantsEnabled:     s.shop.variantsEnabled     ?? false,
        });
      })
      .catch(() => {});
  }, [session?.user?.shopId]);

  // Fetch latest stock from the server and update state + IndexedDB cache
  const refreshProducts = useCallback(async (silent = false) => {
    if (!silent) setProductsLoading(true);
    try {
      const [displayRes, servicesRes, allRes] = await Promise.all([
        fetch("/api/products?type=product&limit=50&page=1"),
        fetch("/api/products?type=service&limit=100"),
        fetch("/api/products?limit=500&page=1"),
      ]);
      if (!displayRes.ok) throw new Error("offline");
      const display = await displayRes.json();
      setRecentProducts(display.products ?? []);

      if (servicesRes.ok) {
        const svc = await servicesRes.json();
        setAllServices(svc.products ?? []);
      }

      if (allRes.ok && shopId) {
        const all = await allRes.json();
        const products: CachedProduct[] = (all.products ?? []).map(
          (p: Product) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            unit: p.unit,
            sellPrice: Number(p.sellPrice),
            stockQty: p.stockQty,
            variantCount: p._count?.variants ?? 0,
            category: p.category,
            warrantyPeriod: p.warrantyPeriod ?? null,
            isService: p.isService ?? false,
          })
        );
        setAllCached(products);
        await cacheProducts(shopId, products);
      }
    } catch {
      // Offline — load from IndexedDB
      if (shopId) {
        const cached = await getCachedProducts(shopId);
        if (cached) {
          setAllCached(cached);
          setRecentProducts(cached.filter((p) => !p.isService).slice(0, 50).map(toProduct));
          setAllServices(cached.filter((p) => p.isService).map(toProduct));
        }
      }
    } finally {
      if (!silent) setProductsLoading(false);
    }
  }, [shopId]);

  // Load products on mount
  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  // Silently re-sync stock every 60 s while online (keeps multi-device stock accurate)
  useEffect(() => {
    if (!isOnline || !shopId) return;
    const interval = setInterval(() => refreshProducts(true), 60_000);
    return () => clearInterval(interval);
  }, [isOnline, shopId, refreshProducts]);

  // Track pending offline sales count
  useEffect(() => {
    getPendingSales()
      .then((sales) =>
        setPendingCount(sales.filter((s) => s.status === "pending").length)
      )
      .catch(() => {});
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncPendingSales();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  async function syncPendingSales() {
    const pending = (await getPendingSales()).filter((s) => s.status === "pending");
    if (pending.length === 0) return;

    let synced = 0;
    let failed = 0;
    for (const sale of pending) {
      try {
        const res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: sale.items,
            discount: sale.discount,
            paymentMethod: sale.paymentMethod,
            amountPaid: sale.amountPaid,
          }),
        });
        if (res.ok) {
          await removePendingSale(sale.localId);
          synced++;
        } else {
          const data = await res.json();
          await markSaleFailed(sale.localId, data.error ?? "Unknown error");
          failed++;
        }
      } catch {
        // Still offline — will retry next reconnect
      }
    }
    const remaining = (await getPendingSales()).filter(
      (s) => s.status === "pending"
    ).length;
    setPendingCount(remaining);
    if (synced > 0)
      toast.success(`${synced} offline sale${synced > 1 ? "s" : ""} synced`);
    if (failed > 0)
      toast.error(`${failed} sale${failed > 1 ? "s" : ""} failed to sync — check inventory`);
  }

  // Debounced product search (offline-aware)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    if (!isOnline) {
      const q = searchQuery.toLowerCase();
      setSearchResults(
        allCached
          .filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.sku?.toLowerCase().includes(q) ?? false)
          )
          .slice(0, 20)
          .map(toProduct)
      );
      return;
    }

    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products?search=${encodeURIComponent(searchQuery)}&limit=20`
        );
        const data = await res.json();
        setSearchResults(data.products ?? []);
      } catch {
        const q = searchQuery.toLowerCase();
        setSearchResults(
          allCached
            .filter((p) => p.name.toLowerCase().includes(q))
            .slice(0, 20)
            .map(toProduct)
        );
      }
    }, 150);
    return () => clearTimeout(t);
  }, [searchQuery, isOnline, allCached]);

  // Customer search — runs only while checkout dialog is open
  useEffect(() => {
    if (!checkoutOpen || !customerQuery.trim()) {
      setCustomerResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/customers?search=${encodeURIComponent(customerQuery)}&limit=5`
        );
        const data = await res.json();
        setCustomerResults(
          (data.customers ?? []).map((c: Customer & { creditBalance: string | number }) => ({
            ...c,
            creditBalance: Number(c.creditBalance),
          }))
        );
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [customerQuery, checkoutOpen]);

  async function sendSmsReceipt() {
    if (!completedSale || completedSale.isOffline) return;
    setSendingSms(true);
    try {
      const res = await fetch("/api/sms/send-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: completedSale.id,
          ...(walkInPhone.trim() && { phone: walkInPhone.trim() }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to send SMS");
        return;
      }
      toast.success("Receipt sent via SMS");
      setWalkInPhone("");
    } catch {
      toast.error("Failed to send SMS");
    } finally {
      setSendingSms(false);
    }
  }

  function handlePrint() {
    if (!completedSale) return;
    const shop  = shopInfo?.name     || session?.user?.shopName || "";
    const addr  = shopInfo?.address  || "";
    const phone = shopInfo?.phone    || (session?.user as { phone?: string })?.phone || "";
    const payLabel: Record<string, string> = { CASH: "Cash", CARD: "Card", ONLINE: "Online", CREDIT: "Credit" };

    const itemsHtml = completedSale.items.map((it) => `
      <div style="display:flex;justify-content:space-between;margin-top:6px;">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:6px;">${it.name}</span>
        <span style="flex-shrink:0;font-weight:600;">${formatLKR(it.lineTotal)}</span>
      </div>
      ${it.itemCode ? `<div style="font-size:11px;color:#555;">Code: ${it.itemCode}</div>` : ""}
      <div style="font-size:11px;color:#555;">${it.quantity} ${it.unit} × ${formatLKR(it.unitPrice)}</div>
      ${it.warrantyPeriod ? `<div style="font-size:11px;color:#555;">Warranty: ${it.warrantyPeriod}</div>` : ""}
    `).join("");

    const discountHtml = completedSale.discount > 0 ? `
      <div style="display:flex;justify-content:space-between;color:#555;font-size:12px;">
        <span>Subtotal</span><span>${formatLKR(completedSale.subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;color:#16a34a;font-size:12px;">
        <span>Discount</span><span>- ${formatLKR(completedSale.discount)}</span>
      </div>` : "";

    const cashHtml = completedSale.paymentMethod === "CASH" && completedSale.amountPaid >= completedSale.total ? `
      <div style="display:flex;justify-content:space-between;color:#555;font-size:12px;">
        <span>Tendered</span><span>${formatLKR(completedSale.amountPaid)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;color:#555;font-size:12px;">
        <span>Change</span><span>${formatLKR(completedSale.amountPaid - completedSale.total)}</span>
      </div>` : "";

    const creditHtml = completedSale.paymentMethod === "CREDIT" ? `
      <div style="display:flex;justify-content:space-between;color:#dc2626;font-weight:500;font-size:12px;">
        <span>Amount Due (on credit)</span><span>${formatLKR(completedSale.total)}</span>
      </div>` : "";

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>Receipt</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Courier New',monospace;font-size:12px;color:#111;background:white;padding:12px;max-width:320px;margin:0 auto;}
  .divider{border:none;border-top:1px dashed #999;margin:8px 0;}
  @media print{body{padding:0;}}
</style>
</head><body>
  <div style="text-align:center;">
    <div style="font-size:15px;font-weight:bold;margin-bottom:2px;">${shop}</div>
    ${addr  ? `<div style="font-size:11px;color:#555;">${addr}</div>` : ""}
    ${phone ? `<div style="font-size:11px;color:#555;">Tel: ${phone}</div>` : ""}
  </div>
  <hr class="divider">
  <div style="display:flex;justify-content:space-between;font-size:11px;color:#555;">
    <span>${new Date(completedSale.createdAt).toLocaleString("en-LK",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
    <span>#${completedSale.id.slice(-6).toUpperCase()}</span>
  </div>
  ${selectedCustomer ? `<div style="font-size:11px;color:#555;margin-top:4px;">Customer: ${selectedCustomer.name}</div>` : ""}
  <hr class="divider">
  ${itemsHtml}
  <hr class="divider">
  ${discountHtml}
  <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin:4px 0;">
    <span>Total</span><span style="color:#16a34a;">${formatLKR(completedSale.total)}</span>
  </div>
  <div style="display:flex;justify-content:space-between;color:#555;font-size:12px;">
    <span>Payment</span><span style="color:#111;font-weight:500;">${payLabel[completedSale.paymentMethod] ?? completedSale.paymentMethod}</span>
  </div>
  ${cashHtml}${creditHtml}
  <hr class="divider">
  <div style="text-align:center;font-weight:bold;margin-top:4px;">Thank you — Come again!</div>
  <div style="text-align:center;font-size:11px;color:#555;">Please keep this receipt for your records.</div>
</body></html>`;

    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  }

  async function sendEmailReceipt(overrideEmail?: string) {
    if (!completedSale || completedSale.isOffline) return;
    setSendingEmail(true);
    try {
      const res = await fetch("/api/email/send-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: completedSale.id,
          ...(overrideEmail?.trim() && { email: overrideEmail.trim() }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to send email");
        return;
      }
      toast.success("Receipt sent via email");
      setWalkInEmail("");
    } catch {
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  }

  function addToCart(product: Product) {
    // If this product has variants, open the picker instead
    if (shopInfo?.variantsEnabled && (product._count?.variants ?? 0) > 0) {
      setVariantPickerProduct(product);
      return;
    }
    const cartKey = product.id;
    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);
      if (existing) {
        const step = qtyStep(product.unit);
        const newQty = Math.round((existing.quantity + step) * 10000) / 10000;
        if (!product.isService && newQty > product.stockQty) {
          toast.warning(`Only ${product.stockQty} ${product.unit} in stock`);
          return prev;
        }
        return prev.map((i) =>
          i.cartKey === cartKey
            ? { ...i, quantity: newQty, lineTotal: newQty * i.unitPrice }
            : i
        );
      }
      if (!product.isService && product.stockQty <= 0) {
        toast.error(`${product.name} is out of stock`);
        return prev;
      }
      return [
        ...prev,
        {
          cartKey,
          productId: product.id,
          name: product.name,
          itemCode: product.itemCode ?? null,
          unit: product.unit,
          unitPrice: Number(product.sellPrice),
          originalPrice: Number(product.sellPrice),
          quantity: 1,
          lineTotal: Number(product.sellPrice),
          stockQty: product.stockQty,
          warrantyPeriod: product.warrantyPeriod ?? null,
          isService: product.isService,
        },
      ];
    });
    setSearchQuery("");
    setSearchResults([]);
    searchRef.current?.focus();
  }

  function addVariantToCart(product: Product, variant: PickerVariant) {
    const cartKey = `${product.id}:${variant.id}`;
    const label = variant.color ? `${variant.size} / ${variant.color}` : variant.size;
    const unitPrice = variant.sellPrice != null ? variant.sellPrice : Number(product.sellPrice);
    setCart((prev) => {
      const existing = prev.find((i) => i.cartKey === cartKey);
      if (existing) {
        const newQty = existing.quantity + 1;
        if (newQty > variant.stockQty) {
          toast.warning(`Only ${variant.stockQty} in stock`);
          return prev;
        }
        return prev.map((i) =>
          i.cartKey === cartKey
            ? { ...i, quantity: newQty, lineTotal: newQty * i.unitPrice }
            : i
        );
      }
      if (variant.stockQty <= 0) {
        toast.error(`${product.name} (${label}) is out of stock`);
        return prev;
      }
      return [
        ...prev,
        {
          cartKey,
          productId: product.id,
          variantId: variant.id,
          variantLabel: label,
          name: `${product.name} (${label})`,
          itemCode: product.itemCode ?? null,
          unit: product.unit,
          unitPrice,
          originalPrice: unitPrice,
          quantity: 1,
          lineTotal: unitPrice,
          stockQty: variant.stockQty,
          warrantyPeriod: product.warrantyPeriod ?? null,
          isService: false,
        },
      ];
    });
    setSearchQuery("");
    setSearchResults([]);
    searchRef.current?.focus();
  }

  function updateQty(cartKey: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.cartKey !== cartKey) return i;
          const step = qtyStep(i.unit);
          const newQty = Math.round((i.quantity + delta * step) * 10000) / 10000;
          if (newQty <= 0) return null as unknown as CartItem;
          if (!i.isService && newQty > i.stockQty) {
            toast.warning(`Only ${i.stockQty} ${i.unit} in stock`);
            return i;
          }
          return { ...i, quantity: newQty, lineTotal: newQty * i.unitPrice };
        })
        .filter(Boolean)
    );
  }

  function setExactQty(cartKey: string, qty: number) {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.cartKey !== cartKey) return i;
          if (isNaN(qty) || qty <= 0) return null as unknown as CartItem;
          if (!i.isService && qty > i.stockQty) {
            toast.warning(`Only ${i.stockQty} ${i.unit} in stock`);
            return { ...i, quantity: i.stockQty, lineTotal: i.stockQty * i.unitPrice };
          }
          return { ...i, quantity: qty, lineTotal: qty * i.unitPrice };
        })
        .filter(Boolean)
    );
  }

  function updateLinePrice(cartKey: string, newPrice: number) {
    setCart((prev) =>
      prev.map((i) =>
        i.cartKey === cartKey
          ? { ...i, unitPrice: newPrice, lineTotal: i.quantity * newPrice }
          : i
      )
    );
  }

  function removeFromCart(cartKey: string) {
    setCart((prev) => prev.filter((i) => i.cartKey !== cartKey));
  }

  function clearCart() {
    setCart([]);
    setDiscount(0);
    try {
      localStorage.removeItem(`pos-cart-${shopId}`);
      localStorage.removeItem(`pos-discount-${shopId}`);
    } catch {}
    setAmountTendered("");
    setCheckoutOpen(false);
    setCompletedSale(null);
    setSelectedCustomer(null);
    setCustomerQuery("");
    setCustomerResults([]);
  }

  async function completeSale() {
    if (cart.length === 0) return;
    if (
      paymentMethod === "CASH" &&
      parseFloat(amountTendered || "0") < total
    ) {
      toast.error("Amount tendered must be at least the total");
      return;
    }

    setLoading(true);

    // CREDIT = nothing paid yet; CASH = tendered; CARD/ONLINE = full amount settled
    const amountPaid =
      paymentMethod === "CASH"   ? parseFloat(amountTendered)
      : paymentMethod === "CREDIT" ? 0
      : total;
    const saleItems = cart.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }));
    const receiptItems = cart.map((i) => ({
      name: i.name,
      itemCode: i.itemCode ?? null,
      unit: i.unit,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      warrantyPeriod: i.warrantyPeriod ?? null,
    }));

    try {
      // Offline path
      if (!isOnline) {
        if (!offlinePOSAllowed) {
          toast.error("Offline POS requires Standard plan or higher. Connect to the internet to continue.");
          setLoading(false);
          return;
        }
        if (!shopId) {
          toast.error("Session lost — please reload");
          return;
        }
        const localId = await addPendingSale({
          shopId,
          items: saleItems,
          discount: discountAmt,
          paymentMethod,
          amountPaid,
        });
        await deductCachedStock(shopId, saleItems);
        const updated = await getCachedProducts(shopId);
        if (updated) {
          setAllCached(updated);
          setRecentProducts(updated.slice(0, 12).map(toProduct));
        }
        setPendingCount((c) => c + 1);
        setCompletedSale({
          id: localId,
          subtotal,
          discount: discountAmt,
          total,
          amountPaid,
          paymentMethod,
          items: receiptItems,
          createdAt: new Date().toISOString(),
          isOffline: true,
        });
        setShowReceipt(true);
        setCheckoutOpen(false);
        toast.success("Sale saved offline — will sync when reconnected");
        return;
      }

      // Online path
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: saleItems,
          discount: discountAmt,
          paymentMethod,
          amountPaid,
          customerId: selectedCustomer?.id ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sale failed");
        return;
      }

      const sale = data.sale;
      setCompletedSale({
        id: sale.id,
        subtotal,
        discount: discountAmt,
        total: Number(sale.total),
        amountPaid: Number(sale.amountPaid),
        paymentMethod: sale.paymentMethod,
        items: receiptItems,
        createdAt: sale.createdAt,
        isOffline: false,
      });
      // Optimistically deduct sold quantities from in-memory state + cache
      if (shopId) {
        await deductCachedStock(shopId, saleItems);
        const updated = await getCachedProducts(shopId);
        if (updated) {
          setAllCached(updated);
          setRecentProducts(updated.slice(0, 12).map(toProduct));
        }
      }

      setShowReceipt(true);
      setCheckoutOpen(false);
      toast.success("Sale completed!");
    } catch {
      // Unexpected network error — queue offline if plan allows it
      if (shopId && offlinePOSAllowed) {
        const localId = await addPendingSale({
          shopId,
          items: saleItems,
          discount: discountAmt,
          paymentMethod,
          amountPaid,
        });
        await deductCachedStock(shopId, saleItems);
        setPendingCount((c) => c + 1);
        setCompletedSale({
          id: localId,
          subtotal,
          discount: discountAmt,
          total,
          amountPaid,
          paymentMethod,
          items: receiptItems,
          createdAt: new Date().toISOString(),
          isOffline: true,
        });
        setShowReceipt(true);
        setCheckoutOpen(false);
        toast.warning("Network error — sale saved offline");
      } else {
        toast.error("Failed to complete sale");
      }
    } finally {
      setLoading(false);
    }
  }

  function holdSale() {
    if (cart.length === 0) return;
    const held: HeldCart = {
      id: Date.now().toString(),
      savedAt: new Date().toISOString(),
      cart,
      discount,
      discountType,
      customer: selectedCustomer,
    };
    setHeldCarts((prev) => [...prev, held]);
    setCart([]);
    setDiscount(0);
    setDiscountType("amount");
    setSelectedCustomer(null);
    setCustomerQuery("");
    setAmountTendered("");
    toast.success("Sale held — cart cleared for next customer");
  }

  function restoreHeld(held: HeldCart) {
    if (cart.length > 0) {
      toast.error("Clear or hold the current cart first");
      return;
    }
    setCart(held.cart);
    setDiscount(held.discount);
    setDiscountType(held.discountType);
    setSelectedCustomer(held.customer);
    setHeldCarts((prev) => prev.filter((h) => h.id !== held.id));
    setHeldOpen(false);
    toast.success("Cart restored");
  }

  function discardHeld(id: string) {
    setHeldCarts((prev) => prev.filter((h) => h.id !== id));
  }

  const displayProducts = searchQuery ? searchResults : recentProducts;

  function ProductCard({ product }: { product: Product }) {
    const hasVariants = shopInfo?.variantsEnabled && (product._count?.variants ?? 0) > 0;
    return (
      <button
        onClick={() => addToCart(product)}
        disabled={!product.isService && !hasVariants && product.stockQty <= 0}
        className={cn(
          "text-left rounded-xl border border-border bg-card p-3 hover:border-primary hover:shadow-sm transition-all active:scale-95",
          !product.isService && !hasVariants && product.stockQty <= 0 && "opacity-50 cursor-not-allowed"
        )}
      >
        <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
          {product.name}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{product.unit}</p>
        <p className="mt-1.5 text-base font-bold text-primary font-mono">
          {formatLKR(Number(product.sellPrice))}
        </p>
        {product.isService && (
          <p className="text-xs text-blue-500 font-medium mt-0.5">Service</p>
        )}
        {hasVariants && (
          <p className="text-xs text-primary/70 font-medium mt-0.5 flex items-center gap-1">
            <Shirt className="h-3 w-3" />
            {product._count!.variants} size{product._count!.variants !== 1 ? "s" : ""}
          </p>
        )}
        {!hasVariants && !product.isService && product.stockQty <= 0 && (
          <p className="text-xs text-destructive font-medium mt-0.5">Out of stock</p>
        )}
        {!hasVariants && !product.isService && product.stockQty > 0 && product.stockQty <= 5 && (
          <p className="text-xs text-[color:var(--brand-warning)] font-medium mt-0.5">
            Only {product.stockQty} left
          </p>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
    {maintenanceMsg && !maintenanceDismissed && (
      <div className="flex items-start gap-3 rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
        <TriangleAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            System Maintenance In Progress
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">{maintenanceMsg}</p>
          <p className="text-xs text-amber-600/80 dark:text-amber-500 mt-1">
            Proceed with caution — complete pending transactions and avoid starting new ones until maintenance is done.
          </p>
        </div>
        <button
          onClick={() => setMaintenanceDismissed(true)}
          className="p-1 rounded-lg text-amber-600 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 transition-colors flex-shrink-0"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )}
    <div className="flex flex-col md:flex-row gap-4 md:h-[calc(100vh-8rem)]">
      {/* Left — Product search */}
      <div className="h-[42vh] md:h-auto md:flex-1 min-h-0 flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Search or scan barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
              autoFocus
            />
            {searchQuery ? (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <div
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground/50 pointer-events-none"
                title="Barcode scanner ready"
              >
                <ScanBarcode className="h-4 w-4" />
              </div>
            )}
          </div>

          {/* Offline status + pending badge */}
          {!isOnline && (
            <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 flex-shrink-0 ${
              offlinePOSAllowed
                ? "border-amber-200 bg-amber-50"
                : "border-red-200 bg-red-50"
            }`}>
              <WifiOff className={`h-4 w-4 ${offlinePOSAllowed ? "text-amber-600" : "text-red-600"}`} />
              <span className={`text-xs font-semibold hidden sm:block ${offlinePOSAllowed ? "text-amber-700" : "text-red-700"}`}>
                {offlinePOSAllowed ? "Offline" : "Offline — upgrade to sell offline"}
              </span>
              {offlinePOSAllowed && pendingCount > 0 && (
                <Badge className="bg-amber-600 text-white text-xs px-1.5">
                  {pendingCount}
                </Badge>
              )}
            </div>
          )}

          {heldCarts.length > 0 && (
            <button
              onClick={() => setHeldOpen(true)}
              title={`${heldCarts.length} held sale${heldCarts.length > 1 ? "s" : ""}`}
              className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors flex-shrink-0"
            >
              <BookmarkCheck className="h-4 w-4" />
              <span className="hidden sm:block">Held ({heldCarts.length})</span>
              <span className="sm:hidden">{heldCarts.length}</span>
            </button>
          )}

          {isOnline && pendingCount > 0 && (
            <button
              onClick={syncPendingSales}
              title={`${pendingCount} sale${pendingCount > 1 ? "s" : ""} pending sync`}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
              Sync {pendingCount}
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 space-y-4">
          {productsLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 content-start">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3 animate-pulse space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-5 bg-muted rounded w-2/3 mt-1" />
                </div>
              ))}
            </div>
          )}

          {/* Services — pinned section (hidden while searching, search results include them) */}
          {!productsLoading && !searchQuery && allServices.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5">Services</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {allServices.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}

          {/* Products grid */}
          {!productsLoading && (
            <div className="space-y-2">
              {!searchQuery && allServices.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5">Products</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 content-start">
                {displayProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
                {displayProducts.length === 0 && searchQuery && (
                  <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                    No products found for &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right — Cart */}
      <div className="w-full md:w-80 lg:w-96 min-h-0 flex flex-col border border-border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Cart</span>
            {cart.length > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs">
                {cart.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {heldCarts.length > 0 && (
              <button
                onClick={() => setHeldOpen(true)}
                className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 transition-colors"
                title="View held sales"
              >
                <BookmarkCheck className="h-3.5 w-3.5" />
                {heldCarts.length} held
              </button>
            )}
            {cart.length > 0 && (
              <>
                <button
                  onClick={holdSale}
                  className="text-xs text-muted-foreground hover:text-amber-600 transition-colors"
                  title="Hold this sale"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={clearCart}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear
                </button>
              </>
            )}
          </div>
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
            <ScrollArea className="h-[28vh] md:flex-1 min-h-0">
              <div className="p-3 space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.cartKey}
                    className="flex items-start gap-2 rounded-lg border border-border bg-background p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground line-clamp-2">
                        {item.name}
                      </p>
                      {item.warrantyPeriod && (
                        <p className="text-xs text-muted-foreground mt-0.5">Warranty: {item.warrantyPeriod}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          value={item.unitPrice}
                          min={0}
                          step={0.01}
                          onChange={(e) =>
                            updateLinePrice(
                              item.cartKey,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-24 text-xs font-mono border border-border rounded px-1.5 py-0.5 bg-background text-foreground"
                          title="Unit price (editable)"
                        />
                        <span className="text-xs text-muted-foreground">
                          / {item.unit}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <p className="text-sm font-bold font-mono text-foreground">
                        {formatLKR(item.lineTotal)}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item.cartKey, -1)}
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min={isFractional(item.unit) ? 0.001 : 1}
                          step={qtyStep(item.unit)}
                          value={qtyInputs[item.cartKey] ?? String(item.quantity)}
                          onChange={(e) => setQtyInputs((prev) => ({ ...prev, [item.cartKey]: e.target.value }))}
                          onBlur={(e) => {
                            const qty = parseFloat(e.target.value);
                            if (!isNaN(qty) && qty > 0) setExactQty(item.cartKey, qty);
                            setQtyInputs((prev) => { const n = { ...prev }; delete n[item.cartKey]; return n; });
                          }}
                          className="w-16 text-sm font-mono text-center border border-border rounded px-1 py-0.5 bg-background text-foreground"
                        />
                        <span className="text-xs text-muted-foreground">{item.unit}</span>
                        <button
                          onClick={() => updateQty(item.cartKey, 1)}
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.cartKey)}
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

            <div className="border-t border-border p-4 space-y-3 flex-shrink-0">
              {/* Discount */}
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={discount || ""}
                  onChange={(e) =>
                    setDiscount(parseFloat(e.target.value) || 0)
                  }
                  placeholder="Discount"
                  className="flex-1 text-sm border border-border rounded-lg px-3 py-1.5 bg-background font-mono"
                />
                <button
                  onClick={() =>
                    setDiscountType(
                      discountType === "amount" ? "percent" : "amount"
                    )
                  }
                  className="flex items-center gap-1 text-xs font-medium border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted transition-colors"
                >
                  {discountType === "percent" ? (
                    <Percent className="h-3 w-3" />
                  ) : (
                    <span className="font-mono text-xs">LKR</span>
                  )}
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
                  <span className="font-mono text-primary">
                    {formatLKR(total)}
                  </span>
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
            {!isOnline && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <WifiOff className="h-3 w-3 flex-shrink-0" />
                Offline mode — sale will be saved and synced when connected
              </div>
            )}

            {/* Customer selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                Customer
                {paymentMethod === "CREDIT"
                  ? <span className="text-destructive ml-0.5">*</span>
                  : <span className="text-muted-foreground text-xs font-normal ml-1">(optional)</span>
                }
              </Label>

              {selectedCustomer ? (
                <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedCustomer.phone ?? "No phone saved"}
                      {selectedCustomer.creditBalance > 0 && (
                        <span className="ml-2 text-amber-600 font-medium">
                          · Owes {formatLKR(selectedCustomer.creditBalance)}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedCustomer(null); setCustomerQuery(""); setCustomerResults([]); }}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name or phone..."
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    className="w-full pl-9 pr-3 h-10 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {customerResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors text-sm border-b border-border last:border-0"
                          onClick={() => { setSelectedCustomer(c); setCustomerQuery(""); setCustomerResults([]); }}
                        >
                          <p className="font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.phone ?? "No phone"}
                            {c.creditBalance > 0 && (
                              <span className="ml-2 text-amber-600">Owes {formatLKR(c.creditBalance)}</span>
                            )}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === "CREDIT" && !selectedCustomer && (
                <p className="text-xs text-destructive">A customer must be selected for credit sales</p>
              )}
            </div>

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

            {paymentMethod === "CARD" && cardSurchargeEnabled && cardSurchargeRate > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Card Processing Fee (Business Absorbs)</p>
                <div className="flex justify-between text-sm text-amber-800 dark:text-amber-300">
                  <span>Rate</span>
                  <span className="font-mono">{(cardSurchargeRate * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-sm text-amber-800 dark:text-amber-300">
                  <span>Fee on this sale</span>
                  <span className="font-mono font-semibold">{formatLKR(total * cardSurchargeRate)}</span>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-500 pt-0.5">
                  Charge customer <span className="font-semibold">{formatLKR(total)}</span> on the card machine. Fee is recorded internally.
                </p>
              </div>
            )}

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
                    <span className="text-sm font-medium text-[color:var(--brand-success)]">
                      Change
                    </span>
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
              <span className="text-2xl font-bold font-mono text-primary">
                {formatLKR(total)}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCheckoutOpen(false)}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              onClick={completeSale}
              disabled={
                loading ||
                (paymentMethod === "CASH" && parseFloat(amountTendered || "0") < total) ||
                (paymentMethod === "CREDIT" && !selectedCustomer)
              }
              className="font-bold flex-1"
              style={{ backgroundColor: "var(--cta)", color: "white" }}
            >
              {loading
                ? "Processing..."
                : isOnline
                ? "Confirm Sale"
                : "Save Offline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Held Sales Dialog */}
      <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkCheck className="h-5 w-5 text-amber-600" />
              Held Sales
            </DialogTitle>
          </DialogHeader>
          {heldCarts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No held sales</p>
          ) : (
            <div className="space-y-2">
              {heldCarts.map((held) => {
                const heldTotal = held.cart.reduce((s, i) => s + i.lineTotal, 0);
                const discAmt = held.discountType === "percent" ? (heldTotal * held.discount) / 100 : held.discount;
                const net = Math.max(0, heldTotal - discAmt);
                return (
                  <div key={held.id} className="rounded-lg border border-border bg-background p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-foreground font-mono">{formatLKR(net)}</p>
                        {held.customer && (
                          <span className="text-xs text-muted-foreground">· {held.customer.name}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {held.cart.length} item{held.cart.length !== 1 ? "s" : ""} ·{" "}
                        {new Date(held.savedAt).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {held.cart.map((i) => i.name).join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <Button size="sm" className="h-7 text-xs" onClick={() => restoreHeld(held)}>
                        Restore
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => discardHeld(held.id)}>
                        Discard
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Variant Picker */}
      <VariantPickerDialog
        productId={variantPickerProduct?.id ?? null}
        productName={variantPickerProduct?.name ?? ""}
        baseSellPrice={Number(variantPickerProduct?.sellPrice ?? 0)}
        open={!!variantPickerProduct}
        onClose={() => setVariantPickerProduct(null)}
        onSelect={(variant) => {
          if (variantPickerProduct) addVariantToCart(variantPickerProduct, variant);
          setVariantPickerProduct(null);
        }}
      />

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={(o) => { setShowReceipt(o); if (!o) { setWalkInPhone(""); setWalkInEmail(""); } }}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle
              className={cn(
                "flex items-center gap-2",
                completedSale?.isOffline ? "text-amber-600" : "text-[color:var(--brand-success)]"
              )}
            >
              <Check className="h-5 w-5" />
              {completedSale?.isOffline ? "Sale Saved Offline" : "Sale Complete!"}
            </DialogTitle>
          </DialogHeader>

          {completedSale && (
            <div className="space-y-3">
              {completedSale.isOffline && (
                <div className="print:hidden flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <WifiOff className="h-3 w-3 flex-shrink-0" />
                  Will sync automatically when reconnected
                </div>
              )}

              {/* Receipt body — this is what prints */}
              <div id="receipt-print-area" className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm font-mono print:bg-white print:rounded-none print:shadow-none print:p-0">

                {/* Shop header */}
                <div className="text-center space-y-0.5 pb-3 border-b border-dashed border-border">
                  <p className="font-bold text-base text-foreground">
                    {shopInfo?.name || session?.user?.shopName || ""}
                  </p>
                  {shopInfo?.address && (
                    <p className="text-xs text-muted-foreground leading-snug">{shopInfo.address}</p>
                  )}
                  {(shopInfo?.phone || session?.user?.phone) && (
                    <p className="text-xs text-muted-foreground">
                      Tel: {shopInfo?.phone || session?.user?.phone}
                    </p>
                  )}
                </div>

                {/* Date & receipt number */}
                <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 gap-2">
                  <span className="shrink-0">{new Date(completedSale.createdAt).toLocaleString("en-LK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="shrink-0">#{completedSale.id.slice(-6).toUpperCase()}</span>
                </div>

                {selectedCustomer && (
                  <p className="text-xs text-muted-foreground">Customer: {selectedCustomer.name}</p>
                )}

                <Separator className="my-2 border-dashed" />

                {/* Line items */}
                {completedSale.items.map((item, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-foreground break-words min-w-0">{item.name}</span>
                      <span className="font-semibold shrink-0 tabular-nums">{formatLKR(item.lineTotal)}</span>
                    </div>
                    {item.itemCode && (
                      <p className="text-xs text-muted-foreground font-mono">Code: {item.itemCode}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} {item.unit} × {formatLKR(item.unitPrice)}
                    </p>
                    {item.warrantyPeriod && (
                      <p className="text-xs text-muted-foreground">Warranty: {item.warrantyPeriod}</p>
                    )}
                  </div>
                ))}

                <Separator className="my-2 border-dashed" />

                {/* Totals */}
                {completedSale.discount > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground text-sm">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatLKR(completedSale.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-[color:var(--brand-success)]">
                      <span>Discount</span>
                      <span className="font-mono">- {formatLKR(completedSale.discount)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary">{formatLKR(completedSale.total)}</span>
                </div>

                {/* Payment method */}
                <div className="flex justify-between text-muted-foreground">
                  <span>Payment</span>
                  <span className="font-medium text-foreground">
                    {{ CASH: "Cash", CARD: "Card", ONLINE: "Online", CREDIT: "Credit" }[completedSale.paymentMethod] ?? completedSale.paymentMethod}
                  </span>
                </div>

                {completedSale.paymentMethod === "CASH" && completedSale.amountPaid >= completedSale.total && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Tendered</span>
                      <span>{formatLKR(completedSale.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Change</span>
                      <span>{formatLKR(completedSale.amountPaid - completedSale.total)}</span>
                    </div>
                  </>
                )}

                {completedSale.paymentMethod === "CREDIT" && (
                  <div className="flex justify-between text-destructive font-medium">
                    <span>Amount Due (on credit)</span>
                    <span>{formatLKR(completedSale.total)}</span>
                  </div>
                )}

                {/* Thank-you footer */}
                <div className="text-center pt-3 mt-2 border-t border-dashed border-border space-y-0.5">
                  <p className="font-semibold text-foreground">Thank you — Come again!</p>
                  <p className="text-xs text-muted-foreground">Please keep this receipt for your records.</p>
                </div>
              </div>

              {/* Action buttons — hidden when printing */}
              <div className="print:hidden flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>

                {!completedSale?.isOffline && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(`/r/${completedSale!.id}`, "_blank")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                )}

                {!completedSale?.isOffline && (() => {
                  const receiptLink = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${completedSale!.id}`;
                  const waText = encodeURIComponent(`Here is your receipt: ${receiptLink}`);
                  const waPhone = selectedCustomer?.phone
                    ? selectedCustomer.phone.replace(/\D/g, "").replace(/^0/, "94")
                    : "";
                  const waUrl = `https://wa.me/${waPhone}?text=${waText}`;
                  return (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-green-300 bg-transparent px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
                    >
                      <Share2 className="h-4 w-4" />
                      WhatsApp
                    </a>
                  );
                })()}

                {!completedSale?.isOffline && shopInfo?.smsAddonEnabled && shopInfo?.smsReceiptEnabled && (
                  selectedCustomer?.phone ? (
                    <Button variant="outline" className="flex-1" onClick={sendSmsReceipt} disabled={sendingSms}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {sendingSms ? "Sending…" : "SMS Receipt"}
                    </Button>
                  ) : (
                    <div className="w-full flex gap-2">
                      <Input
                        placeholder="Walk-in phone (07X XXXXXXX)"
                        value={walkInPhone}
                        onChange={(e) => setWalkInPhone(e.target.value)}
                        className="flex-1 h-9 text-sm"
                        type="tel"
                      />
                      <Button variant="outline" className="h-9 px-3" onClick={sendSmsReceipt} disabled={sendingSms || !walkInPhone.trim()}>
                        <MessageSquare className="h-4 w-4" />
                        {sendingSms ? "…" : "Send"}
                      </Button>
                    </div>
                  )
                )}

                {!completedSale?.isOffline && shopInfo?.emailReceiptEnabled && (
                  selectedCustomer?.email ? (
                    <Button variant="outline" className="flex-1" onClick={() => sendEmailReceipt()} disabled={sendingEmail}>
                      <Mail className="h-4 w-4 mr-2" />
                      {sendingEmail ? "Sending…" : "Email Receipt"}
                    </Button>
                  ) : (
                    <div className="w-full flex gap-2">
                      <Input
                        placeholder="Walk-in email address"
                        value={walkInEmail}
                        onChange={(e) => setWalkInEmail(e.target.value)}
                        className="flex-1 h-9 text-sm"
                        type="email"
                      />
                      <Button variant="outline" className="h-9 px-3" onClick={() => sendEmailReceipt(walkInEmail)} disabled={sendingEmail || !walkInEmail.trim()}>
                        <Mail className="h-4 w-4" />
                        {sendingEmail ? "…" : "Send"}
                      </Button>
                    </div>
                  )
                )}

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
    </div>
  );
}
