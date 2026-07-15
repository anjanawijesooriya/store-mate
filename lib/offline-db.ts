const DB_NAME = "storemate-offline";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("products")) {
        db.createObjectStore("products", { keyPath: "shopId" });
      }
      if (!db.objectStoreNames.contains("pendingSales")) {
        db.createObjectStore("pendingSales", { keyPath: "localId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function storeOp<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export interface CachedVariant {
  id: string;
  productId: string;
  size: string;
  color: string | null;
  sku: string | null;
  stockQty: number;
  lowStockAt: number;
  sellPrice: number | null;
}

export interface CachedProduct {
  id: string;
  name: string;
  itemCode: string | null;
  sku: string | null;
  unit: string;
  sellPrice: number;
  stockQty: number;
  variantCount: number;
  category: string | null;
  warrantyPeriod: string | null;
  isService: boolean;
  isWeighted: boolean;
  pluCode: string | null;
  variants?: CachedVariant[];
}

export interface PendingSale {
  localId: string;
  shopId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  discount: number;
  paymentMethod: string;
  amountPaid: number;
  createdAt: number;
  status: "pending" | "failed";
  error?: string;
}

export async function cacheProducts(
  shopId: string,
  products: CachedProduct[]
): Promise<void> {
  const db = await openDb();
  await storeOp(db, "products", "readwrite", (s) =>
    s.put({ shopId, products, cachedAt: Date.now() })
  );
}

export async function getCachedProducts(
  shopId: string
): Promise<CachedProduct[] | null> {
  const db = await openDb();
  const result = await storeOp<{ shopId: string; products: CachedProduct[] } | undefined>(
    db,
    "products",
    "readonly",
    (s) => s.get(shopId)
  );
  return result?.products ?? null;
}

export async function deductCachedStock(
  shopId: string,
  items: Array<{ productId: string; variantId?: string; quantity: number }>
): Promise<void> {
  const idb = await openDb();
  // Single IDB transaction for read+write prevents TOCTOU race between concurrent callers
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction("products", "readwrite");
    const store = tx.objectStore("products");
    const req = store.get(shopId);
    req.onsuccess = () => {
      const record = req.result as { shopId: string; products: CachedProduct[]; cachedAt: number } | undefined;
      if (!record) { resolve(); return; }
      const updated = record.products.map((p) => {
        const item = items.find((i) => i.productId === p.id);
        if (!item) return p;
        if (item.variantId && p.variants?.length) {
          // Deduct from the specific variant's stock, not the parent product
          return {
            ...p,
            variants: p.variants.map((v) =>
              v.id === item.variantId
                ? { ...v, stockQty: Math.max(0, v.stockQty - item.quantity) }
                : v
            ),
          };
        }
        // Regular or weighted product — deduct from parent stockQty
        return { ...p, stockQty: Math.max(0, p.stockQty - item.quantity) };
      });
      store.put({ ...record, products: updated });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function addPendingSale(
  sale: Omit<PendingSale, "localId" | "status" | "createdAt">
): Promise<string> {
  const db = await openDb();
  const localId = crypto.randomUUID();
  const record: PendingSale = {
    ...sale,
    localId,
    status: "pending",
    createdAt: Date.now(),
  };
  await storeOp(db, "pendingSales", "readwrite", (s) => s.add(record));
  return localId;
}

export async function getPendingSales(): Promise<PendingSale[]> {
  const db = await openDb();
  return storeOp<PendingSale[]>(db, "pendingSales", "readonly", (s) => s.getAll());
}

export async function removePendingSale(localId: string): Promise<void> {
  const db = await openDb();
  await storeOp(db, "pendingSales", "readwrite", (s) => s.delete(localId));
}

export async function markSaleFailed(localId: string, error: string): Promise<void> {
  const db = await openDb();
  const record = await storeOp<PendingSale | undefined>(
    db,
    "pendingSales",
    "readonly",
    (s) => s.get(localId)
  );
  if (!record) return;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("pendingSales", "readwrite");
    transaction.objectStore("pendingSales").put({ ...record, status: "failed", error });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
