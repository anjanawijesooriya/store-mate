"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2,
  XCircle, AlertCircle, RotateCcw, Loader2, X, PlusCircle, RefreshCw, Shirt, Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ImportRow, ImportError } from "@/app/api/products/import/route";
import type { UpdateRow, UpdateError } from "@/app/api/products/update/route";
import type { ImportVariantRow, ImportVariantError } from "@/app/api/products/import-variants/route";
import type { ImportWeightedRow, ImportWeightedError } from "@/app/api/products/import-weighted/route";

// ── Column header normalisation ────────────────────────────────────────────────

function normalizeHeader(h: unknown): string {
  if (typeof h !== "string") return "";
  return h.toLowerCase().trim().replace(/[\s_\-/\\]+/g, " ");
}

const COLUMN_ALIASES: Record<string, keyof ImportRow | "_ignore"> = {
  "name": "name", "product name": "name", "item name": "name",
  "product": "name", "item": "name",
  "item code": "itemCode", "itemcode": "itemCode", "product code": "itemCode",
  "code": "itemCode", "item no": "itemCode", "item number": "itemCode",
  "sku": "sku", "barcode": "sku", "sku code": "sku", "ean": "sku", "upc": "sku",
  "category": "category", "cat": "category", "group": "category",
  "unit": "unit", "unit of measure": "unit", "uom": "unit",
  "cost price": "costPrice", "cost": "costPrice",
  "purchase price": "costPrice", "buying price": "costPrice", "cp": "costPrice",
  "sell price": "sellPrice", "price": "sellPrice",
  "selling price": "sellPrice", "sale price": "sellPrice",
  "mrp": "sellPrice", "unit price": "sellPrice",
  "retail price": "sellPrice", "sp": "sellPrice",
  "stock": "stockQty", "stock qty": "stockQty", "stock quantity": "stockQty",
  "quantity": "stockQty", "qty": "stockQty",
  "opening stock": "stockQty", "initial stock": "stockQty", "on hand": "stockQty",
  "low stock": "lowStockAt", "low stock alert": "lowStockAt",
  "low stock at": "lowStockAt", "reorder level": "lowStockAt",
  "reorder point": "lowStockAt", "min stock": "lowStockAt",
  "minimum stock": "lowStockAt",
  "warranty": "warrantyPeriod", "warranty period": "warrantyPeriod",
};

type VariantColKey = keyof ImportVariantRow | "_ignore";
const VARIANT_ALIASES: Record<string, VariantColKey> = {
  "variant id": "variantId", "variantid": "variantId", "id": "variantId",
  "product": "product", "product name": "product", "name": "product",
  "item name": "product", "item code": "product", "itemcode": "product",
  "product code": "product", "sku": "product",
  "size": "size", "size code": "size",
  "colour": "color", "color": "color", "col": "color",
  "variant sku": "sku", "variant barcode": "sku", "variant code": "sku",
  "barcode": "sku",
  "stock": "stockQty", "stock qty": "stockQty", "quantity": "stockQty", "qty": "stockQty",
  "low stock": "lowStockAt", "low stock alert": "lowStockAt", "min stock": "lowStockAt",
  "price override": "sellPrice", "sell price": "sellPrice", "price": "sellPrice",
  "variant price": "sellPrice",
};

type WeightedColKey = keyof ImportWeightedRow | "_ignore";
const WEIGHTED_ALIASES: Record<string, WeightedColKey> = {
  "name": "name", "product name": "name", "item name": "name", "product": "name",
  "item code": "itemCode", "itemcode": "itemCode", "product code": "itemCode", "code": "itemCode",
  "unit": "unit", "uom": "unit", "unit of measure": "unit", "unit (kg g l ml)": "unit",
  "plu": "pluCode", "plu code": "pluCode", "plucode": "pluCode", "plu no": "pluCode",
  "plu number": "pluCode", "scale code": "pluCode",
  "category": "category", "cat": "category", "group": "category",
  "cost price": "costPrice", "cost": "costPrice", "buying price": "costPrice", "cp": "costPrice",
  "sell price": "sellPrice", "price": "sellPrice", "selling price": "sellPrice",
  "price per unit": "sellPrice", "rate per unit": "sellPrice", "rate": "sellPrice",
  "sell price unit": "sellPrice", "price unit": "sellPrice",
  "sell price kg": "sellPrice", "price per kg": "sellPrice", "rate per kg": "sellPrice",
  "sell price l": "sellPrice", "price per l": "sellPrice",
  "sell price ml": "sellPrice", "price per ml": "sellPrice",
  "sell price g": "sellPrice", "price per g": "sellPrice",
  "stock": "stockQty", "stock qty": "stockQty", "stock qty (set)": "stockQty",
  "stock quantity": "stockQty", "quantity": "stockQty", "qty": "stockQty",
  "opening stock": "stockQty", "initial stock": "stockQty", "on hand": "stockQty",
  "low stock": "lowStockAt", "low stock alert": "lowStockAt", "min stock": "lowStockAt",
  "low stock at": "lowStockAt", "low stock alert (kg)": "lowStockAt",
  "low stock (kg)": "lowStockAt", "min stock (kg)": "lowStockAt",
  "low stock alert (unit)": "lowStockAt", "low stock (unit)": "lowStockAt",
};

// ── Parsed row types ───────────────────────────────────────────────────────────

interface PreviewRow { rowNum: number; raw: ImportRow; errors: string[] }
interface UpdatePreviewRow { rowNum: number; raw: UpdateRow; errors: string[] }
interface VariantPreviewRow { rowNum: number; raw: ImportVariantRow; errors: string[] }
interface WeightedPreviewRow { rowNum: number; raw: ImportWeightedRow; errors: string[] }

function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function parseSheet(data: unknown[][]): PreviewRow[] {
  if (data.length < 2) return [];
  const headerRow = data[0];
  const colMap: Record<number, keyof ImportRow | "_ignore"> = {};
  headerRow.forEach((h, idx) => {
    const key = COLUMN_ALIASES[normalizeHeader(h)];
    if (key) colMap[idx] = key;
  });
  const rows: PreviewRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const cells = data[i] as unknown[];
    if (cells.every((c) => c === "" || c === null || c === undefined)) continue;
    const raw: Partial<ImportRow> = {};
    Object.entries(colMap).forEach(([idxStr, field]) => {
      const val = cells[Number(idxStr)];
      if (field === "_ignore") return;
      if (["name","itemCode","sku","category","unit","warrantyPeriod"].includes(field)) {
        (raw as Record<string, unknown>)[field] = val !== undefined && val !== "" ? String(val) : null;
      } else {
        (raw as Record<string, unknown>)[field] = toNum(val);
      }
    });
    const errors: string[] = [];
    if (!raw.name?.trim()) errors.push("Name is required");
    if (raw.sellPrice === undefined || raw.sellPrice === null) errors.push("Sell Price is required");
    else if ((raw.sellPrice as number) < 0) errors.push("Sell Price must be ≥ 0");
    if (raw.costPrice !== undefined && (raw.costPrice as number) < 0) errors.push("Cost Price must be ≥ 0");
    if (raw.costPrice === undefined) raw.costPrice = 0;
    if (raw.stockQty !== undefined && (raw.stockQty as number) < 0) errors.push("Stock Qty must be ≥ 0");
    if (raw.lowStockAt !== undefined && (raw.lowStockAt as number) < 0) errors.push("Low Stock Alert must be ≥ 0");
    rows.push({ rowNum: i + 1, raw: raw as ImportRow, errors });
  }
  return rows;
}

function parseSheetForUpdate(data: unknown[][]): UpdatePreviewRow[] {
  if (data.length < 2) return [];
  const headerRow = data[0];
  const colMap: Record<number, keyof ImportRow | "_ignore"> = {};
  headerRow.forEach((h, idx) => {
    const key = COLUMN_ALIASES[normalizeHeader(h)];
    if (key) colMap[idx] = key;
  });
  const rows: UpdatePreviewRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const cells = data[i] as unknown[];
    if (cells.every((c) => c === "" || c === null || c === undefined)) continue;
    const raw: Partial<UpdateRow> = {};
    Object.entries(colMap).forEach(([idxStr, field]) => {
      if (field === "_ignore") return;
      const val = cells[Number(idxStr)];
      if (["name","itemCode","sku","category","unit","warrantyPeriod"].includes(field)) {
        if (val !== undefined && val !== "") (raw as Record<string, unknown>)[field] = String(val);
      } else {
        const n = toNum(val);
        if (n !== undefined) (raw as Record<string, unknown>)[field] = n;
      }
    });
    const errors: string[] = [];
    const hasIdentifier = !!(raw.itemCode?.trim() || raw.sku?.trim() || raw.name?.trim());
    if (!hasIdentifier) errors.push("Item Code, SKU, or Name required to identify product");
    const hasUpdate = raw.sellPrice !== undefined || raw.costPrice !== undefined ||
      raw.stockQty !== undefined || raw.lowStockAt !== undefined ||
      raw.category !== undefined || raw.unit !== undefined || raw.warrantyPeriod !== undefined;
    if (!hasUpdate) errors.push("No fields to update in this row");
    if (raw.sellPrice !== undefined && (raw.sellPrice as number) < 0) errors.push("Sell Price must be ≥ 0");
    if (raw.costPrice !== undefined && (raw.costPrice as number) < 0) errors.push("Cost Price must be ≥ 0");
    if (raw.stockQty !== undefined && (raw.stockQty as number) < 0) errors.push("Stock Qty must be ≥ 0");
    if (raw.lowStockAt !== undefined && (raw.lowStockAt as number) < 0) errors.push("Low Stock Alert must be ≥ 0");
    rows.push({ rowNum: i + 1, raw: raw as UpdateRow, errors });
  }
  return rows;
}

function parseSheetForVariants(data: unknown[][]): VariantPreviewRow[] {
  if (data.length < 2) return [];
  const headerRow = data[0];
  const colMap: Record<number, VariantColKey> = {};
  headerRow.forEach((h, idx) => {
    const key = VARIANT_ALIASES[normalizeHeader(h)];
    if (key) colMap[idx] = key;
  });
  const rows: VariantPreviewRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const cells = data[i] as unknown[];
    if (cells.every((c) => c === "" || c === null || c === undefined)) continue;
    const raw: Partial<ImportVariantRow> = {};
    Object.entries(colMap).forEach(([idxStr, field]) => {
      if (field === "_ignore") return;
      const val = cells[Number(idxStr)];
      if (["variantId","product","size","color","sku"].includes(field as string)) {
        if (val !== undefined && val !== "") (raw as Record<string, unknown>)[field] = String(val).trim();
      } else {
        const n = toNum(val);
        if (n !== undefined) (raw as Record<string, unknown>)[field] = n;
      }
    });
    const errors: string[] = [];
    if (!raw.product?.trim()) errors.push("Product (name, item code, or SKU) is required");
    if (!raw.size?.trim()) errors.push("Size is required");
    if (raw.stockQty !== undefined && (raw.stockQty as number) < 0) errors.push("Stock Qty must be ≥ 0");
    if (raw.lowStockAt !== undefined && (raw.lowStockAt as number) < 0) errors.push("Low Stock Alert must be ≥ 0");
    if (raw.sellPrice !== undefined && (raw.sellPrice as number) < 0) errors.push("Price Override must be ≥ 0");
    rows.push({ rowNum: i + 1, raw: raw as ImportVariantRow, errors });
  }
  return rows;
}

function parseSheetForWeighted(data: unknown[][]): WeightedPreviewRow[] {
  if (data.length < 2) return [];
  const headerRow = data[0];
  const colMap: Record<number, WeightedColKey> = {};
  headerRow.forEach((h, idx) => {
    const key = WEIGHTED_ALIASES[normalizeHeader(h)];
    if (key) colMap[idx] = key;
  });
  const rows: WeightedPreviewRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const cells = data[i] as unknown[];
    if (cells.every((c) => c === "" || c === null || c === undefined)) continue;
    const raw: Partial<ImportWeightedRow> = {};
    Object.entries(colMap).forEach(([idxStr, field]) => {
      if (field === "_ignore") return;
      const val = cells[Number(idxStr)];
      if (["name", "itemCode", "unit", "pluCode", "category"].includes(field as string)) {
        if (val !== undefined && val !== "") (raw as Record<string, unknown>)[field] = String(val).trim();
      } else {
        const n = toNum(val);
        if (n !== undefined) (raw as Record<string, unknown>)[field] = n;
      }
    });
    const errors: string[] = [];
    if (!raw.name?.trim()) errors.push("Name is required");
    if (raw.sellPrice === undefined) errors.push("Sell Price (per kg) is required");
    else if ((raw.sellPrice as number) < 0) errors.push("Sell Price must be ≥ 0");
    if (raw.pluCode && !/^\d{1,5}$/.test(raw.pluCode.trim())) errors.push("PLU Code must be 1–5 digits");
    if (raw.stockQty !== undefined && (raw.stockQty as number) < 0) errors.push("Stock Qty must be ≥ 0");
    if (raw.lowStockAt !== undefined && (raw.lowStockAt as number) < 0) errors.push("Low Stock Alert must be ≥ 0");
    rows.push({ rowNum: i + 1, raw: raw as ImportWeightedRow, errors });
  }
  return rows;
}

// ── Template ───────────────────────────────────────────────────────────────────

async function downloadTemplate(includeVariants: boolean, weightedMode = false) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Products
  const headers = [
    "Name", "Item Code", "SKU", "Category", "Unit",
    "Cost Price", "Sell Price", "Stock Qty", "Low Stock Alert", "Warranty Period",
  ];
  const examples = [
    ["Widget A",      "IC-001", "WGT-001", "Electronics", "pcs",    500,  750, 100, 10, "1 year"],
    ["Widget B",      "IC-002", "WGT-002", "Electronics", "pcs",   1200, 1800,  50,  5, ""],
    ["Shampoo 200ml", "IC-003", "SHP-200", "Hair Care",   "bottle", 250,  380, 200, 20, ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  ws["!cols"] = [
    { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 8 },
    { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 17 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Products");

  // Sheet 2 — Variants (clothing shops)
  if (includeVariants) {
    const vHeaders = [
      "Variant ID", "Product", "Size", "Colour", "Variant SKU", "Stock Qty", "Low Stock Alert", "Price Override",
    ];

    // Try to fetch real variant data so IDs are populated
    type VRow = { variantId: string; productName: string; itemCode: string | null; size: string; color: string | null; sku: string | null; stockQty: number; lowStockAt: number; sellPrice: number | null };
    let vRows: unknown[][] = [];
    try {
      const res = await fetch("/api/products/variants");
      if (res.ok) {
        const data = await res.json();
        const live = data.variants as VRow[];
        if (live.length > 0) {
          vRows = live.map((v) => [
            v.variantId,
            v.productName,
            v.size,
            v.color ?? "",
            v.sku ?? "",
            v.stockQty,
            v.lowStockAt,
            v.sellPrice ?? "",
          ]);
        }
      }
    } catch { /* fall through to examples */ }

    // Fall back to static examples when no real variants exist yet
    if (vRows.length === 0) {
      vRows = [
        ["", "T-Shirt (Round Neck)", "S",   "White", "TSH-S-WHT",  50, 5, ""],
        ["", "T-Shirt (Round Neck)", "M",   "White", "TSH-M-WHT",  80, 5, ""],
        ["", "T-Shirt (Round Neck)", "L",   "White", "TSH-L-WHT",  60, 5, ""],
        ["", "T-Shirt (Round Neck)", "XL",  "White", "TSH-XL-WHT", 30, 5, ""],
        ["", "T-Shirt (Round Neck)", "S",   "Black", "TSH-S-BLK",  50, 5, ""],
        ["", "T-Shirt (Round Neck)", "M",   "Black", "TSH-M-BLK",  80, 5, ""],
        ["", "Slim Jeans",           "28",  "",      "JN-28",      20, 3, 2500],
        ["", "Slim Jeans",           "30",  "",      "JN-30",      25, 3, 2500],
        ["", "Slim Jeans",           "32",  "",      "JN-32",      30, 3, ""],
      ];
    }

    const ws2 = XLSX.utils.aoa_to_sheet([vHeaders, ...vRows]);
    ws2["!cols"] = [
      { wch: 28 }, { wch: 26 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 17 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, "Variants");
  }

  // Weighted products sheet — separate template when in weighted mode
  if (weightedMode) {
    // "Stock Qty (SET)" header makes clear this is an overwrite, not an increment.
    // Leave the cell blank when downloading to update prices — blank = keep current stock.
    const wHeaders = ["Name", "Item Code", "Unit (kg/g/L/ml)", "PLU Code", "Category", "Cost Price", "Price/unit", "Stock Qty (SET)", "Low Stock Alert"];

    type WRow = { name: string; itemCode: string | null; unit: string; pluCode: string | null; category: string | null; costPrice: unknown; sellPrice: unknown; stockQty: unknown; lowStockAt: unknown };
    let wRows: unknown[][] = [];
    try {
      const res = await fetch("/api/products/weighted");
      if (res.ok) {
        const d = await res.json();
        const live = d.products as WRow[];
        if (live.length > 0) {
          wRows = live.map((p) => [
            p.name,
            p.itemCode ?? "",
            p.unit ?? "kg",
            p.pluCode ?? "",
            p.category ?? "",
            // Use "" for null cost so re-import doesn't overwrite null with 0
            p.costPrice != null ? Number(p.costPrice) : "",
            Number(p.sellPrice) || 0,
            // Leave stock blank — blank cells are treated as "no change" on import.
            // Fill in a value only when doing a deliberate stock-take.
            "",
            Number(p.lowStockAt) || 0,
          ]);
        }
      }
    } catch { /* fall through */ }

    if (wRows.length === 0) {
      wRows = [
        ["Chicken Breast",    "WP-001", "kg", "00001", "Meat & Seafood", 600,   850,  0, 0],
        ["Beef",              "WP-002", "kg", "00002", "Meat & Seafood", 900,  1200,  0, 0],
        ["Red Rice",          "WP-003", "kg", "00003", "Groceries",      150,   220,  0, 0],
        ["Coconut Oil (bulk)","WP-004", "l",  "",      "Groceries",      400,   550,  0, 0],
        ["Vanilla Extract",   "WP-005", "ml", "",      "Groceries",      1200, 1800,  0, 0],
      ];
    }

    const wsW = XLSX.utils.aoa_to_sheet([wHeaders, ...wRows]);
    wsW["!cols"] = [
      { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 11 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsW, "Weighted Products");
    XLSX.writeFile(wb, "estoremate-weighted-products.xlsx");
    return;
  }

  XLSX.writeFile(wb, "estoremate-products-template.xlsx");
}

// ── Main component ─────────────────────────────────────────────────────────────

type Stage = "idle" | "preview" | "importing" | "done";
type Mode = "create" | "update" | "variants" | "weighted";

interface DoneResult {
  mode: Mode;
  count: number;
  apiErrors: Array<{ row: number; label: string; reason: string }>;
}

interface ImportDialogProps {
  open: boolean;
  variantsEnabled?: boolean;
  weightedProductsEnabled?: boolean;
  onClose: () => void;
  onImported: () => void;
}

function formatLKR(n: number) {
  return `LKR ${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function ImportDialog({ open, variantsEnabled = false, weightedProductsEnabled = false, onClose, onImported }: ImportDialogProps) {
  const [mode, setMode] = useState<Mode>("create");
  const [stage, setStage] = useState<Stage>("idle");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [updateRows, setUpdateRows] = useState<UpdatePreviewRow[]>([]);
  const [variantRows, setVariantRows] = useState<VariantPreviewRow[]>([]);
  const [weightedRows, setWeightedRows] = useState<WeightedPreviewRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [result, setResult] = useState<DoneResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeRows =
    mode === "create"   ? rows :
    mode === "update"   ? updateRows :
    mode === "variants" ? variantRows :
    weightedRows;
  const validRows = activeRows.filter((r) => r.errors.length === 0);
  const invalidRows = activeRows.filter((r) => r.errors.length > 0);

  function reset() {
    setStage("idle");
    setRows([]);
    setUpdateRows([]);
    setVariantRows([]);
    setWeightedRows([]);
    setFileName("");
    setProgress(0);
    setProgressTotal(0);
    setResult(null);
    setDragging(false);
  }

  function handleClose() { reset(); onClose(); }

  const parseFile = useCallback(async (file: File) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel", "text/csv", "application/csv",
    ];
    if (!allowed.includes(file.type) && !["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast.error("Please upload an .xlsx, .xls, or .csv file");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });

      // For variant/weighted mode, prefer the named sheet if uploading the multi-sheet template
      let sheetName = wb.SheetNames[0];
      if (mode === "variants" && wb.SheetNames.includes("Variants")) {
        sheetName = "Variants";
      } else if (mode === "weighted" && wb.SheetNames.includes("Weighted Products")) {
        sheetName = "Weighted Products";
      }

      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

      if (mode === "create") {
        const parsed = parseSheet(data);
        if (parsed.length === 0) { toast.error("No data rows found"); return; }
        setRows(parsed);
      } else if (mode === "update") {
        const parsed = parseSheetForUpdate(data);
        if (parsed.length === 0) { toast.error("No data rows found"); return; }
        setUpdateRows(parsed);
      } else if (mode === "weighted") {
        const parsed = parseSheetForWeighted(data);
        if (parsed.length === 0) { toast.error("No data rows found"); return; }
        setWeightedRows(parsed);
      } else {
        const parsed = parseSheetForVariants(data);
        if (parsed.length === 0) { toast.error("No data rows found"); return; }
        setVariantRows(parsed);
      }

      const sheetSuffix =
        mode === "variants" && wb.SheetNames.includes("Variants") ? " (Variants sheet)" :
        mode === "weighted" && wb.SheetNames.includes("Weighted Products") ? " (Weighted Products sheet)" :
        "";
      setFileName(file.name + sheetSuffix);
      setStage("preview");
    } catch {
      toast.error("Failed to parse file. Make sure it is a valid Excel or CSV file.");
    }
  }, [mode]);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    setStage("importing");
    setProgressTotal(validRows.length);
    setProgress(0);

    const BATCH = 100;
    let count = 0;
    const apiErrors: DoneResult["apiErrors"] = [];

    const endpoint =
      mode === "create"   ? "/api/products/import" :
      mode === "update"   ? "/api/products/update" :
      mode === "weighted" ? "/api/products/import-weighted" :
      "/api/products/import-variants";

    for (let offset = 0; offset < validRows.length; offset += BATCH) {
      const batch = validRows.slice(offset, offset + BATCH).map((r) => r.raw);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batch }),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg = data.error ?? "Operation failed";
          if (res.status === 403) {
            setResult({ mode, count: 0, apiErrors: [{ row: 0, label: "", reason: msg }] });
            setStage("done");
          } else {
            toast.error(msg);
            setStage("preview");
          }
          return;
        }
        if (mode === "create") {
          count += data.created as number;
          for (const e of (data.errors as ImportError[])) apiErrors.push({ row: e.row, label: e.name, reason: e.reason });
        } else if (mode === "update") {
          count += data.updated as number;
          for (const e of (data.errors as UpdateError[])) apiErrors.push({ row: e.row, label: e.identifier, reason: e.reason });
        } else if (mode === "weighted") {
          count += data.upserted as number;
          for (const e of (data.errors as ImportWeightedError[])) apiErrors.push({ row: e.row, label: e.name, reason: e.reason });
        } else {
          count += data.upserted as number;
          for (const e of (data.errors as ImportVariantError[])) apiErrors.push({ row: e.row, label: `${e.product} — ${e.size}`, reason: e.reason });
        }
      } catch {
        toast.error("Network error");
        setStage("preview");
        return;
      }
      setProgress(Math.min(offset + BATCH, validRows.length));
    }

    setResult({ mode, count, apiErrors });
    setStage("done");
    onImported();
  }

  const isUpdate   = mode === "update";
  const isVariants = mode === "variants";
  const isWeighted = mode === "weighted";

  const actionLabel =
    isVariants ? "Import Variants" :
    isWeighted ? "Import Weighted" :
    isUpdate   ? "Update" :
    "Import";

  const modeDescription = {
    create:   <>Upload an Excel (.xlsx, .xls) or CSV file to bulk-import new products. Required columns: <span className="font-semibold text-foreground">Name</span>, <span className="font-semibold text-foreground">Sell Price</span>.</>,
    update:   <>Upload a file to bulk-update existing products. Identify each product by <span className="font-semibold text-foreground">Item Code</span>, <span className="font-semibold text-foreground">SKU</span>, or <span className="font-semibold text-foreground">Name</span>. Only columns you include will be updated — blank cells are left unchanged.</>,
    variants: <>Upload a file to bulk-import or update variant stock. Identify the parent product by <span className="font-semibold text-foreground">Name</span>, <span className="font-semibold text-foreground">Item Code</span>, or <span className="font-semibold text-foreground">SKU</span>. Each row is one size/colour combination. Existing variants are updated; new ones are created.</>,
    weighted: <>Upload a file to bulk-import or update products sold by weight or volume. Required columns: <span className="font-semibold text-foreground">Name</span>, <span className="font-semibold text-foreground">Price/unit</span>. Use <span className="font-semibold text-foreground">Unit</span> to specify kg, g, L, or ml — defaults to kg. Include <span className="font-semibold text-foreground">PLU Code</span> for kg/g products linked to a label-printing scale.</>,
  };

  const successLabel = {
    create:   "products imported",
    update:   "products updated",
    variants: "variants imported / updated",
    weighted: "weighted products imported / updated",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 max-h-[90dvh]",
          stage === "preview" ? "max-w-4xl" : "max-w-lg",
        )}
      >
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {isVariants ? "Import Variants from Excel" : isWeighted ? "Import Weighted Products from Excel" : isUpdate ? "Update Products from Excel" : "Import Products from Excel"}
          </DialogTitle>
        </DialogHeader>

        {/* ── IDLE ─────────────────────────────────────────────────── */}
        {stage === "idle" && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Mode tabs */}
            <div className="flex border-b border-border flex-shrink-0">
              <button
                onClick={() => setMode("create")}
                className={cn(
                  "flex items-center justify-center gap-2 flex-1 px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                  mode === "create"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                <PlusCircle className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Add New</span>
                <span className="sm:hidden">New</span>
              </button>
              <button
                onClick={() => setMode("update")}
                className={cn(
                  "flex items-center justify-center gap-2 flex-1 px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                  mode === "update"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                <RefreshCw className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Update Existing</span>
                <span className="sm:hidden">Update</span>
              </button>
              {variantsEnabled && (
                <button
                  onClick={() => setMode("variants")}
                  className={cn(
                    "flex items-center justify-center gap-2 flex-1 px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                    mode === "variants"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                  )}
                >
                  <Shirt className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Import Variants</span>
                  <span className="sm:hidden">Variants</span>
                </button>
              )}
              {weightedProductsEnabled && (
                <button
                  onClick={() => setMode("weighted")}
                  className={cn(
                    "flex items-center justify-center gap-2 flex-1 px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                    mode === "weighted"
                      ? "border-sky-500 text-sky-600"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                  )}
                >
                  <Scale className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Weighted Products</span>
                  <span className="sm:hidden">Weighted</span>
                </button>
              )}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <p className="text-sm text-muted-foreground">{modeDescription[mode]}</p>

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => downloadTemplate(variantsEnabled, isWeighted)}
              >
                <Download className="h-4 w-4" />
                Download Template
              </Button>

              {isVariants && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-xs text-foreground space-y-1.5">
                  <p className="font-semibold text-sm">Required columns in your file:</p>
                  <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
                    <li><span className="font-medium text-foreground">Product</span> — match by name, item code, or SKU (must already exist)</li>
                    <li><span className="font-medium text-foreground">Size</span> — e.g. S, M, L, XL, 30, 32, Free Size</li>
                    <li>Colour, Variant SKU, Stock Qty, Low Stock Alert, Price Override — optional</li>
                  </ul>
                  <p className="text-muted-foreground mt-1">Tip: export your inventory first — the exported file already has a Variants sheet in the right format.</p>
                </div>
              )}
              {isWeighted && (
                <div className="rounded-lg bg-sky-50 border border-sky-200 px-4 py-3 text-xs text-foreground space-y-1.5 dark:bg-sky-950/30 dark:border-sky-800">
                  <p className="font-semibold text-sm">Required columns:</p>
                  <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
                    <li><span className="font-medium text-foreground">Name</span> — product name (used to match existing)</li>
                    <li><span className="font-medium text-foreground">Price/unit</span> — price per kg, g, L, or ml</li>
                    <li><span className="font-medium text-foreground">Unit</span> — kg, g, L, or ml (defaults to kg if omitted)</li>
                    <li>Item Code, PLU Code (kg/g only, 1–5 digits), Category, Cost Price, Low Stock Alert — optional</li>
                  </ul>
                  <p className="text-muted-foreground mt-1">Existing products matched by Item Code first, then Name. PLU Code links kg/g products to your label-printing scale.</p>
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 cursor-pointer transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
                )}
              >
                <Upload className={cn("h-10 w-10", dragging ? "text-primary" : "text-muted-foreground")} />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {dragging ? "Drop file here" : "Drop file here or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx · .xls · .csv</p>
                </div>
              </div>

              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />

              <div className="flex justify-end">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── PREVIEW ──────────────────────────────────────────────── */}
        {stage === "preview" && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-shrink-0 flex flex-wrap items-center gap-3 px-6 py-3 bg-muted/40 border-b border-border text-sm">
              <span className="text-muted-foreground truncate flex-1 min-w-0 font-mono text-xs">{fileName}</span>
              <span className="flex items-center gap-1.5 text-[color:var(--brand-success)] font-medium">
                <CheckCircle2 className="h-4 w-4" />{validRows.length} ready
              </span>
              {invalidRows.length > 0 && (
                <span className="flex items-center gap-1.5 text-destructive font-medium">
                  <XCircle className="h-4 w-4" />{invalidRows.length} invalid
                </span>
              )}
            </div>

            <div className="overflow-y-auto overflow-x-auto flex-1 min-h-0">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  {isVariants ? (
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-12">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">ID</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Product</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Size</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Colour</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Variant SKU</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Stock</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Low Stock</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Price Override</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                    </tr>
                  ) : isWeighted ? (
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-12">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Item Code</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Unit</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">PLU Code</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Category</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Cost</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Price/unit</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Stock</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Low Stock</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-12">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Item Code</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">SKU</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Category</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Unit</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Cost</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Price</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Stock</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {activeRows.map((row) => {
                    const isValid = row.errors.length === 0;
                    if (isVariants) {
                      const r = row.raw as ImportVariantRow;
                      return (
                        <tr key={row.rowNum} className={cn("border-t border-border", isValid ? "bg-background" : "bg-destructive/5")}>
                          <td className="px-3 py-1.5 text-muted-foreground">{row.rowNum}</td>
                          <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground max-w-[80px] truncate" title={r.variantId ?? undefined}>
                            {r.variantId ? r.variantId.slice(0, 8) + "…" : <span className="italic text-muted-foreground/50">new</span>}
                          </td>
                          <td className="px-3 py-1.5 font-medium max-w-[160px] truncate">
                            {r.product || <span className="text-destructive italic">missing</span>}
                          </td>
                          <td className="px-3 py-1.5 font-semibold">
                            {r.size || <span className="text-destructive italic">missing</span>}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.color || "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground font-mono">{r.sku || "—"}</td>
                          <td className="px-3 py-1.5 text-right">{r.stockQty ?? 0}</td>
                          <td className="px-3 py-1.5 text-right">{r.lowStockAt ?? 3}</td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {r.sellPrice !== undefined && r.sellPrice !== null ? formatLKR(r.sellPrice) : "—"}
                          </td>
                          <td className="px-3 py-1.5">
                            {isValid ? (
                              <span className="flex items-center gap-1 text-[color:var(--brand-success)]">
                                <CheckCircle2 className="h-3.5 w-3.5" />Upsert
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-destructive" title={row.errors.join("; ")}>
                                <XCircle className="h-3.5 w-3.5" />
                                <span className="truncate max-w-[140px]">{row.errors[0]}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }
                    if (isWeighted) {
                      const r = row.raw as ImportWeightedRow;
                      const resolvedUnit = ["kg","g","l","ml"].includes(r.unit?.toLowerCase() ?? "") ? r.unit! : "kg";
                      const isScaleUnit = ["kg","g"].includes(resolvedUnit.toLowerCase());
                      return (
                        <tr key={row.rowNum} className={cn("border-t border-border", isValid ? "bg-background" : "bg-destructive/5")}>
                          <td className="px-3 py-1.5 text-muted-foreground">{row.rowNum}</td>
                          <td className="px-3 py-1.5 font-medium max-w-[180px] truncate">
                            {r.name || <span className="text-destructive italic">missing</span>}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground font-mono">{r.itemCode || "—"}</td>
                          <td className="px-3 py-1.5 font-semibold text-sky-600 text-center">{resolvedUnit}</td>
                          <td className="px-3 py-1.5 text-center font-mono font-semibold text-sky-600">
                            {isScaleUnit && r.pluCode ? r.pluCode.trim().padStart(5, "0") : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.category || "—"}</td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {r.costPrice !== undefined ? formatLKR(r.costPrice) : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold">
                            {r.sellPrice !== undefined
                              ? formatLKR(r.sellPrice)
                              : <span className="text-destructive">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right">{r.stockQty ?? 0}</td>
                          <td className="px-3 py-1.5 text-right">{r.lowStockAt ?? 0}</td>
                          <td className="px-3 py-1.5">
                            {isValid ? (
                              <span className="flex items-center gap-1 text-[color:var(--brand-success)]">
                                <CheckCircle2 className="h-3.5 w-3.5" />Upsert
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-destructive" title={row.errors.join("; ")}>
                                <XCircle className="h-3.5 w-3.5" />
                                <span className="truncate max-w-[140px]">{row.errors[0]}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }
                    const r = row.raw as ImportRow & UpdateRow;
                    return (
                      <tr key={row.rowNum} className={cn("border-t border-border", isValid ? "bg-background" : "bg-destructive/5")}>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.rowNum}</td>
                        <td className="px-3 py-1.5 font-medium max-w-[180px] truncate">
                          {r.name || <span className={cn(isUpdate ? "text-muted-foreground italic" : "text-destructive italic")}>{isUpdate ? "—" : "missing"}</span>}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground font-mono">{r.itemCode || "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground font-mono">{r.sku || "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.category || "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.unit || (isUpdate ? "—" : "pcs")}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {r.costPrice !== undefined ? formatLKR(r.costPrice) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold">
                          {r.sellPrice !== undefined
                            ? formatLKR(r.sellPrice)
                            : <span className={cn(isUpdate ? "text-muted-foreground" : "text-destructive")}>—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right">{r.stockQty ?? (isUpdate ? "—" : 0)}</td>
                        <td className="px-3 py-1.5">
                          {isValid ? (
                            <span className="flex items-center gap-1 text-[color:var(--brand-success)]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {isUpdate ? "Will update" : "Ready"}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-destructive" title={row.errors.join("; ")}>
                              <XCircle className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[140px]">{row.errors[0]}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {invalidRows.length > 0 && (
              <div className="flex-shrink-0 flex items-start gap-2 px-6 py-3 bg-[color:var(--brand-warning)]/10 border-t border-[color:var(--brand-warning)]/20 text-xs text-[color:var(--brand-warning)]">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                Invalid rows will be skipped. Fix them in your file and re-upload if needed.
              </div>
            )}

            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
              <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Change File
              </Button>
              <Button onClick={handleImport} disabled={validRows.length === 0} className="gap-2">
                {`${actionLabel} ${validRows.length} ${isVariants ? "variant" : isWeighted ? "product" : isUpdate ? "product" : "product"}${validRows.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}

        {/* ── IMPORTING ────────────────────────────────────────────── */}
        {stage === "importing" && (
          <div className="flex flex-col items-center justify-center gap-5 py-16 px-6">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {isVariants ? "Importing variants…" : isWeighted ? "Importing weighted products…" : isUpdate ? "Updating products…" : "Importing products…"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{progress} of {progressTotal} processed</p>
            </div>
            <div className="w-full max-w-xs h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: progressTotal > 0 ? `${(progress / progressTotal) * 100}%` : "0%" }}
              />
            </div>
          </div>
        )}

        {/* ── DONE ─────────────────────────────────────────────────── */}
        {stage === "done" && result && (() => {
          const planBlock = result.apiErrors.length === 1 && result.apiErrors[0].row === 0;
          const rowErrors = result.apiErrors.filter((e) => e.row > 0);
          const skipped = invalidRows.length + rowErrors.length;
          return (
            <div className="p-6 space-y-5">
              {planBlock ? (
                <div className="flex items-start gap-3 rounded-xl p-4 border bg-destructive/8 border-destructive/25">
                  <XCircle className="h-6 w-6 flex-shrink-0 text-destructive mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-destructive">Import blocked</p>
                    <p className="text-xs text-muted-foreground mt-1">{result.apiErrors[0].reason}</p>
                  </div>
                </div>
              ) : (
                <div className={cn(
                  "flex items-center gap-3 rounded-xl p-4 border",
                  result.count > 0 ? "bg-[color:var(--brand-success)]/10 border-[color:var(--brand-success)]/25" : "bg-muted border-border",
                )}>
                  <CheckCircle2 className={cn("h-6 w-6 flex-shrink-0", result.count > 0 ? "text-[color:var(--brand-success)]" : "text-muted-foreground")} />
                  <div>
                    <p className="font-semibold text-sm">
                      {result.count} {successLabel[result.mode]} successfully
                    </p>
                    {skipped > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">{skipped} row{skipped !== 1 ? "s" : ""} skipped</p>
                    )}
                  </div>
                </div>
              )}

              {rowErrors.length > 0 && (
                <div className="rounded-xl border border-destructive/25 overflow-hidden">
                  <div className="bg-destructive/8 px-4 py-2 flex items-center gap-2 border-b border-destructive/15">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-xs font-semibold text-destructive">Skipped rows</span>
                  </div>
                  <div className="divide-y divide-border max-h-48 overflow-y-auto">
                    {rowErrors.map((e, idx) => (
                      <div key={idx} className="flex items-baseline gap-3 px-4 py-2 text-xs">
                        <span className="text-muted-foreground w-10 flex-shrink-0">Row {e.row}</span>
                        <span className="font-medium flex-1 truncate">{e.label}</span>
                        <span className="text-destructive flex-shrink-0">{e.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={reset} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  {isVariants ? "Import Another File" : isWeighted ? "Import Another File" : isUpdate ? "Update Another File" : "Import Another File"}
                </Button>
                <Button onClick={handleClose} className="gap-2">
                  <X className="h-4 w-4" />
                  Close
                </Button>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
