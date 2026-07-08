"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2,
  XCircle, AlertCircle, RotateCcw, Loader2, X,
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

// ── Column header normalisation ────────────────────────────────────────────────

function normalizeHeader(h: unknown): string {
  if (typeof h !== "string") return "";
  return h.toLowerCase().trim().replace(/[\s_\-/\\]+/g, " ");
}

const COLUMN_ALIASES: Record<string, keyof ImportRow | "_ignore"> = {
  // name
  "name": "name", "product name": "name", "item name": "name",
  "product": "name", "item": "name",
  // item code
  "item code": "itemCode", "itemcode": "itemCode", "product code": "itemCode",
  "code": "itemCode", "item no": "itemCode", "item number": "itemCode",
  // sku / barcode
  "sku": "sku", "barcode": "sku", "sku code": "sku", "ean": "sku", "upc": "sku",
  // category
  "category": "category", "cat": "category", "group": "category",
  // unit
  "unit": "unit", "unit of measure": "unit", "uom": "unit",
  // cost price
  "cost price": "costPrice", "cost": "costPrice",
  "purchase price": "costPrice", "buying price": "costPrice", "cp": "costPrice",
  // sell price
  "sell price": "sellPrice", "price": "sellPrice",
  "selling price": "sellPrice", "sale price": "sellPrice",
  "mrp": "sellPrice", "unit price": "sellPrice",
  "retail price": "sellPrice", "sp": "sellPrice",
  // stock qty
  "stock": "stockQty", "stock qty": "stockQty", "stock quantity": "stockQty",
  "quantity": "stockQty", "qty": "stockQty",
  "opening stock": "stockQty", "initial stock": "stockQty", "on hand": "stockQty",
  // low stock alert
  "low stock": "lowStockAt", "low stock alert": "lowStockAt",
  "low stock at": "lowStockAt", "reorder level": "lowStockAt",
  "reorder point": "lowStockAt", "min stock": "lowStockAt",
  "minimum stock": "lowStockAt",
  // warranty
  "warranty": "warrantyPeriod", "warranty period": "warrantyPeriod",
};

// ── Parsed preview row ─────────────────────────────────────────────────────────

interface PreviewRow {
  rowNum: number;
  raw: ImportRow;
  errors: string[];
}

function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function parseSheet(data: unknown[][]): PreviewRow[] {
  if (data.length < 2) return [];

  const headerRow = data[0];
  // Map column index → field key
  const colMap: Record<number, keyof ImportRow | "_ignore"> = {};
  headerRow.forEach((h, idx) => {
    const key = COLUMN_ALIASES[normalizeHeader(h)];
    if (key) colMap[idx] = key;
  });

  const rows: PreviewRow[] = [];

  for (let i = 1; i < data.length; i++) {
    const cells = data[i] as unknown[];
    // Skip entirely blank rows
    if (cells.every((c) => c === "" || c === null || c === undefined)) continue;

    const raw: Partial<ImportRow> = {};
    Object.entries(colMap).forEach(([idxStr, field]) => {
      const val = cells[Number(idxStr)];
      if (field === "_ignore") return;
      if (field === "name" || field === "itemCode" || field === "sku" || field === "category" || field === "unit" || field === "warrantyPeriod") {
        (raw as Record<string, unknown>)[field] = val !== undefined && val !== "" ? String(val) : null;
      } else {
        (raw as Record<string, unknown>)[field] = toNum(val);
      }
    });

    const errors: string[] = [];
    if (!raw.name?.trim()) errors.push("Name is required");
    if (raw.sellPrice === undefined || raw.sellPrice === null) {
      errors.push("Sell Price is required");
    } else if ((raw.sellPrice as number) < 0) {
      errors.push("Sell Price must be ≥ 0");
    }
    if (raw.costPrice !== undefined && (raw.costPrice as number) < 0) {
      errors.push("Cost Price must be ≥ 0");
    }
    if (raw.costPrice === undefined) raw.costPrice = 0;
    if (raw.stockQty !== undefined && (raw.stockQty as number) < 0) {
      errors.push("Stock Qty must be ≥ 0");
    }
    if (raw.lowStockAt !== undefined && (raw.lowStockAt as number) < 0) {
      errors.push("Low Stock Alert must be ≥ 0");
    }

    rows.push({ rowNum: i + 1, raw: raw as ImportRow, errors });
  }

  return rows;
}

// ── Template generator ─────────────────────────────────────────────────────────

async function downloadTemplate() {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const headers = [
    "Name", "Item Code", "SKU", "Category", "Unit",
    "Cost Price", "Sell Price", "Stock Qty", "Low Stock Alert", "Warranty Period",
  ];
  const examples = [
    ["Widget A",     "IC-001", "WGT-001", "Electronics", "pcs",    500,  750,  100, 10, "1 year"],
    ["Widget B",     "IC-002", "WGT-002", "Electronics", "pcs",   1200, 1800,   50,  5, ""],
    ["Shampoo 200ml","IC-003", "SHP-200", "Hair Care",   "bottle", 250,  380,  200, 20, ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);

  // Column widths
  ws["!cols"] = [
    { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 8 },
    { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 17 }, { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Products");
  XLSX.writeFile(wb, "storemate-products-template.xlsx");
}

// ── Main component ─────────────────────────────────────────────────────────────

type Stage = "idle" | "preview" | "importing" | "done";

interface DoneResult {
  created: number;
  apiErrors: ImportError[];
}

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

function formatLKR(n: number) {
  return `LKR ${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function ImportDialog({ open, onClose, onImported }: ImportDialogProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [result, setResult] = useState<DoneResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  function reset() {
    setStage("idle");
    setRows([]);
    setFileName("");
    setProgress(0);
    setProgressTotal(0);
    setResult(null);
    setDragging(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  const parseFile = useCallback(async (file: File) => {
    if (!file) return;
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
    ];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(file.type) && !["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast.error("Please upload an .xlsx, .xls, or .csv file");
      return;
    }

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
      const parsed = parseSheet(data);

      if (parsed.length === 0) {
        toast.error("No data rows found in the file");
        return;
      }

      setFileName(file.name);
      setRows(parsed);
      setStage("preview");
    } catch {
      toast.error("Failed to parse file. Make sure it is a valid Excel or CSV file.");
    }
  }, []);

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
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

    // Send in batches of 100 so the progress bar actually moves for large imports
    const BATCH = 100;
    let created = 0;
    const apiErrors: ImportError[] = [];

    for (let offset = 0; offset < validRows.length; offset += BATCH) {
      const batch = validRows.slice(offset, offset + BATCH).map((r) => r.raw);
      try {
        const res = await fetch("/api/products/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batch }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Import failed");
          setStage("preview");
          return;
        }
        created += data.created as number;
        apiErrors.push(...(data.errors as ImportError[]));
      } catch {
        toast.error("Network error during import");
        setStage("preview");
        return;
      }
      setProgress(Math.min(offset + BATCH, validRows.length));
    }

    setResult({ created, apiErrors });
    setStage("done");
    if (created > 0) onImported();
  }

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
            Import Products from Excel
          </DialogTitle>
        </DialogHeader>

        {/* ── IDLE ─────────────────────────────────────────────────── */}
        {stage === "idle" && (
          <div className="p-6 space-y-5">
            <p className="text-sm text-muted-foreground">
              Upload an Excel (.xlsx, .xls) or CSV file to bulk-import products.
              Required columns: <span className="font-semibold text-foreground">Name</span>,{" "}
              <span className="font-semibold text-foreground">Sell Price</span>.
            </p>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={downloadTemplate}
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-12 cursor-pointer transition-colors",
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30",
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

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileInput}
            />

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}

        {/* ── PREVIEW ──────────────────────────────────────────────── */}
        {stage === "preview" && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Summary bar */}
            <div className="flex-shrink-0 flex flex-wrap items-center gap-3 px-6 py-3 bg-muted/40 border-b border-border text-sm">
              <span className="text-muted-foreground truncate flex-1 min-w-0 font-mono text-xs">{fileName}</span>
              <span className="flex items-center gap-1.5 text-[color:var(--brand-success)] font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {validRows.length} ready
              </span>
              {invalidRows.length > 0 && (
                <span className="flex items-center gap-1.5 text-destructive font-medium">
                  <XCircle className="h-4 w-4" />
                  {invalidRows.length} invalid
                </span>
              )}
            </div>

            {/* Table */}
            <div className="overflow-y-auto overflow-x-auto flex-1 min-h-0">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
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
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isValid = row.errors.length === 0;
                    return (
                      <tr
                        key={row.rowNum}
                        className={cn(
                          "border-t border-border",
                          isValid ? "bg-background" : "bg-destructive/5",
                        )}
                      >
                        <td className="px-3 py-1.5 text-muted-foreground">{row.rowNum}</td>
                        <td className="px-3 py-1.5 font-medium max-w-[180px] truncate">
                          {row.raw.name || <span className="text-destructive italic">missing</span>}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground font-mono">{row.raw.itemCode || "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground font-mono">{row.raw.sku || "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.raw.category || "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.raw.unit || "pcs"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {row.raw.costPrice !== undefined ? formatLKR(row.raw.costPrice) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold">
                          {row.raw.sellPrice !== undefined ? formatLKR(row.raw.sellPrice) : <span className="text-destructive">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right">{row.raw.stockQty ?? 0}</td>
                        <td className="px-3 py-1.5">
                          {isValid ? (
                            <span className="flex items-center gap-1 text-[color:var(--brand-success)]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Ready
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

            {/* Warning if any invalid */}
            {invalidRows.length > 0 && (
              <div className="flex-shrink-0 flex items-start gap-2 px-6 py-3 bg-[color:var(--brand-warning)]/10 border-t border-[color:var(--brand-warning)]/20 text-xs text-[color:var(--brand-warning)]">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                Invalid rows will be skipped. Fix them in your file and re-import if needed.
              </div>
            )}

            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
              <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Change File
              </Button>
              <Button
                onClick={handleImport}
                disabled={validRows.length === 0}
                className="gap-2"
              >
                Import {validRows.length} Product{validRows.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {/* ── IMPORTING ────────────────────────────────────────────── */}
        {stage === "importing" && (
          <div className="flex flex-col items-center justify-center gap-5 py-16 px-6">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium">Importing products…</p>
              <p className="text-xs text-muted-foreground mt-1">
                {progress} of {progressTotal} processed
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-full max-w-xs h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: progressTotal > 0 ? `${(progress / progressTotal) * 100}%` : "0%" }}
              />
            </div>
          </div>
        )}

        {/* ── DONE ─────────────────────────────────────────────────── */}
        {stage === "done" && result && (
          <div className="p-6 space-y-5">
            {/* Success summary */}
            <div className={cn(
              "flex items-center gap-3 rounded-xl p-4 border",
              result.created > 0
                ? "bg-[color:var(--brand-success)]/10 border-[color:var(--brand-success)]/25"
                : "bg-muted border-border",
            )}>
              <CheckCircle2 className={cn("h-6 w-6 flex-shrink-0", result.created > 0 ? "text-[color:var(--brand-success)]" : "text-muted-foreground")} />
              <div>
                <p className="font-semibold text-sm">
                  {result.created} product{result.created !== 1 ? "s" : ""} imported successfully
                </p>
                {invalidRows.length + result.apiErrors.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {invalidRows.length + result.apiErrors.length} row{(invalidRows.length + result.apiErrors.length) !== 1 ? "s" : ""} skipped
                  </p>
                )}
              </div>
            </div>

            {/* API-level errors (SKU conflicts, plan limits etc.) */}
            {result.apiErrors.length > 0 && (
              <div className="rounded-xl border border-destructive/25 overflow-hidden">
                <div className="bg-destructive/8 px-4 py-2 flex items-center gap-2 border-b border-destructive/15">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-xs font-semibold text-destructive">Skipped rows</span>
                </div>
                <div className="divide-y divide-border max-h-48 overflow-y-auto">
                  {result.apiErrors.map((e) => (
                    <div key={e.row} className="flex items-baseline gap-3 px-4 py-2 text-xs">
                      <span className="text-muted-foreground w-10 flex-shrink-0">Row {e.row}</span>
                      <span className="font-medium flex-1 truncate">{e.name}</span>
                      <span className="text-destructive flex-shrink-0">{e.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={reset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Import Another File
              </Button>
              <Button onClick={handleClose} className="gap-2">
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
