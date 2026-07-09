"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus, Loader2, Pencil, UserX, Briefcase, Users, Trash2, CheckCircle2, Clock, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type PayType = "SALARY" | "HOURLY" | "DAILY";
type RecordPeriod = "DAY" | "WEEK" | "MONTH";
type RecordStatus = "PENDING" | "PAID";
type DeductionType = "EPF" | "ETF" | "ADVANCE" | "CUSTOM";

interface Employee {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  nic: string | null;
  position: string | null;
  payType: PayType;
  payRate: number;
  joinDate: string | null;
  isActive: boolean;
}

interface PayrollDeduction {
  id: string;
  type: DeductionType;
  label: string;
  amount: number;
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  employee: { id: string; name: string; position: string | null; payType: PayType; payRate: number };
  periodType: RecordPeriod;
  periodStart: string;
  periodEnd: string;
  hoursWorked: number | null;
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  status: RecordStatus;
  paidAt: string | null;
  note: string | null;
  deductions: PayrollDeduction[];
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLKR(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  const [y, m, d] = localDateParts(iso);
  return new Date(y, m - 1, d).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" });
}

function periodLabel(r: PayrollRecord) {
  const [y, m] = localDateParts(r.periodStart);
  if (r.periodType === "MONTH") {
    return new Date(y, m - 1, 1).toLocaleDateString("en-LK", { month: "long", year: "numeric" });
  }
  if (r.periodType === "DAY") return formatDate(r.periodStart);
  return `${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}`;
}

function payRateLabel(payType: PayType) {
  if (payType === "SALARY") return "Monthly Salary (LKR)";
  if (payType === "HOURLY") return "Hourly Rate (LKR/hr)";
  return "Base Daily Rate (LKR) — optional reference";
}

function payRateDisplay(emp: Employee) {
  if (emp.payType === "SALARY") return `LKR ${Number(emp.payRate).toLocaleString("en-LK", { maximumFractionDigits: 0 })}/mo`;
  if (emp.payType === "HOURLY") return `LKR ${Number(emp.payRate).toLocaleString("en-LK", { maximumFractionDigits: 2 })}/hr`;
  return emp.payRate > 0 ? `LKR ${Number(emp.payRate).toLocaleString("en-LK", { maximumFractionDigits: 2 })}/day ref` : "Variable";
}

const PAY_TYPE_BADGE: Record<PayType, string> = {
  SALARY: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  HOURLY: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  DAILY:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const STATUS_BADGE: Record<RecordStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PAID:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function monthRange(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

// Extract local date parts from an ISO string stored as UTC midnight
function localDateParts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  return [y, m, d];
}

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Employee Form ─────────────────────────────────────────────────────────────

interface EmpForm {
  name: string; phone: string; email: string; nic: string;
  position: string; payType: PayType; payRate: string; joinDate: string;
}

const DEFAULT_EMP_FORM: EmpForm = {
  name: "", phone: "", email: "", nic: "", position: "",
  payType: "SALARY", payRate: "", joinDate: "",
};

function EmployeeDialog({
  open, onClose, employee, onSaved,
}: {
  open: boolean; onClose: () => void; employee: Employee | null; onSaved: () => void;
}) {
  const [form, setForm] = useState<EmpForm>(DEFAULT_EMP_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name, phone: employee.phone ?? "", email: employee.email ?? "",
        nic: employee.nic ?? "", position: employee.position ?? "",
        payType: employee.payType, payRate: String(employee.payRate),
        joinDate: employee.joinDate ? employee.joinDate.split("T")[0] : "",
      });
    } else {
      setForm(DEFAULT_EMP_FORM);
    }
  }, [employee, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url = employee ? `/api/employees/${employee.id}` : "/api/employees";
      const res = await fetch(url, {
        method: employee ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, phone: form.phone || null, email: form.email || null,
          nic: form.nic || null, position: form.position || null,
          payType: form.payType, payRate: parseFloat(form.payRate) || 0,
          joinDate: form.joinDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to save employee"); return; }
      toast.success(employee ? "Employee updated" : "Employee added");
      onSaved(); onClose();
    } catch { toast.error("Failed to save employee"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit Employee" : "Add Employee"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emp-name">Name *</Label>
            <Input id="emp-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Full name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="emp-phone">Phone</Label>
              <Input id="emp-phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+94..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-nic">NIC</Label>
              <Input id="emp-nic" value={form.nic} onChange={(e) => setForm((p) => ({ ...p, nic: e.target.value }))}
                placeholder="NIC number" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-position">Position</Label>
            <Input id="emp-position" value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
              placeholder="e.g. Cashier, Manager" />
          </div>
          <div className="space-y-2">
            <Label>Pay Type *</Label>
            <Select value={form.payType} onValueChange={(v) => v && setForm((p) => ({ ...p, payType: v as PayType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SALARY">Monthly Salary</SelectItem>
                <SelectItem value="HOURLY">Hourly</SelectItem>
                <SelectItem value="DAILY">Daily</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-rate">{payRateLabel(form.payType)}</Label>
            <Input id="emp-rate" type="number" min="0" step="0.01" value={form.payRate}
              onChange={(e) => setForm((p) => ({ ...p, payRate: e.target.value }))}
              placeholder="0.00" className="font-mono"
              required={form.payType !== "DAILY"} />
            {form.payType === "DAILY" && (
              <p className="text-xs text-muted-foreground">
                For daily workers, set a reference rate or leave 0. You&apos;ll enter the actual amount per record.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="emp-join">Join Date</Label>
            <Input id="emp-join" type="date" value={form.joinDate}
              onChange={(e) => setForm((p) => ({ ...p, joinDate: e.target.value }))} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="font-semibold">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {employee ? "Save Changes" : "Add Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── New / Edit Record Dialog ──────────────────────────────────────────────────

interface RecordForm {
  employeeId: string;
  periodType: RecordPeriod;
  date: string;         // for DAY
  weekStart: string;    // for WEEK
  weekEnd: string;
  yearMonth: string;    // for MONTH (YYYY-MM)
  hoursWorked: string;  // for HOURLY
  grossAmount: string;
  note: string;
  deductions: Array<{ type: DeductionType; label: string; amount: string }>;
}

function defaultRecordForm(employees: Employee[], editRecord: PayrollRecord | null): RecordForm {
  if (editRecord) {
    const emp = editRecord.employee;
    let date = todayStr(), weekStart = todayStr(), weekEnd = todayStr(), yearMonth = currentYearMonth();
    if (editRecord.periodType === "DAY") date = editRecord.periodStart.split("T")[0];
    if (editRecord.periodType === "WEEK") { weekStart = editRecord.periodStart.split("T")[0]; weekEnd = editRecord.periodEnd.split("T")[0]; }
    if (editRecord.periodType === "MONTH") {
      const [y, m] = localDateParts(editRecord.periodStart);
      yearMonth = `${y}-${String(m).padStart(2, "0")}`;
    }
    return {
      employeeId: editRecord.employeeId,
      periodType: editRecord.periodType,
      date, weekStart, weekEnd, yearMonth,
      hoursWorked: editRecord.hoursWorked !== null ? String(editRecord.hoursWorked) : "",
      grossAmount: String(editRecord.grossAmount),
      note: editRecord.note ?? "",
      deductions: editRecord.deductions.map((d) => ({ type: d.type, label: d.label, amount: String(d.amount) })),
    };
  }
  const firstEmp = employees.find((e) => e.isActive);
  const empPayType = firstEmp?.payType ?? "SALARY";
  return {
    employeeId: firstEmp?.id ?? "",
    periodType: empPayType === "SALARY" ? "MONTH" : empPayType === "DAILY" ? "DAY" : "DAY",
    date: todayStr(), weekStart: todayStr(), weekEnd: todayStr(), yearMonth: currentYearMonth(),
    hoursWorked: "", grossAmount: firstEmp?.payType === "SALARY" ? String(firstEmp.payRate) : "",
    note: "", deductions: [],
  };
}

function RecordDialog({
  open, onClose, employees, editRecord, onSaved,
}: {
  open: boolean; onClose: () => void; employees: Employee[];
  editRecord: PayrollRecord | null; onSaved: (r: PayrollRecord) => void;
}) {
  const [form, setForm] = useState<RecordForm>(() => defaultRecordForm(employees, null));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(defaultRecordForm(employees, editRecord));
  }, [open, editRecord, employees]);

  const selectedEmp = employees.find((e) => e.id === form.employeeId);

  // When employee changes, reset period type and prefill amount
  function handleEmployeeChange(empId: string) {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    const periodType: RecordPeriod = emp.payType === "SALARY" ? "MONTH" : "DAY";
    const grossAmount = emp.payType === "SALARY" ? String(emp.payRate) : "";
    setForm((p) => ({ ...p, employeeId: empId, periodType, grossAmount, hoursWorked: "" }));
  }

  // Auto-fill gross amount for SALARY when month changes
  function handleMonthChange(ym: string) {
    setForm((p) => ({
      ...p, yearMonth: ym,
      grossAmount: selectedEmp?.payType === "SALARY" ? String(selectedEmp.payRate) : p.grossAmount,
    }));
  }

  // Computed amount display for HOURLY
  const computedHourly =
    selectedEmp?.payType === "HOURLY" && form.hoursWorked
      ? parseFloat(form.hoursWorked) * selectedEmp.payRate
      : null;

  // Deduction helpers
  function addDeduction() {
    setForm((p) => ({ ...p, deductions: [...p.deductions, { type: "CUSTOM", label: "", amount: "" }] }));
  }
  function removeDeduction(i: number) {
    setForm((p) => ({ ...p, deductions: p.deductions.filter((_, idx) => idx !== i) }));
  }
  function updateDeduction(i: number, field: "type" | "label" | "amount", value: string) {
    setForm((p) => ({
      ...p,
      deductions: p.deductions.map((d, idx) => idx === i ? { ...d, [field]: value } : d),
    }));
  }

  const totalDed = form.deductions.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const gross = selectedEmp?.payType === "HOURLY" ? (computedHourly ?? 0) : (parseFloat(form.grossAmount) || 0);
  const net = gross - totalDed;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId || !selectedEmp) { toast.error("Select an employee"); return; }
    setSaving(true);
    try {
      let periodStart: string, periodEnd: string;
      if (form.periodType === "DAY") { periodStart = periodEnd = form.date; }
      else if (form.periodType === "WEEK") { periodStart = form.weekStart; periodEnd = form.weekEnd; }
      else { const r = monthRange(form.yearMonth); periodStart = r.start; periodEnd = r.end; }

      const body: Record<string, unknown> = {
        periodType: form.periodType, periodStart, periodEnd,
        grossAmount: gross, note: form.note || undefined,
        deductions: form.deductions.map((d) => ({
          type: d.type, label: d.label, amount: parseFloat(d.amount) || 0,
        })),
      };
      if (selectedEmp.payType === "HOURLY") body.hoursWorked = parseFloat(form.hoursWorked) || 0;

      let res: Response;
      if (editRecord) {
        res = await fetch(`/api/payroll/${editRecord.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
      } else {
        body.employeeId = form.employeeId;
        res = await fetch("/api/payroll", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to save record"); return; }
      toast.success(editRecord ? "Record updated" : "Record added");
      onSaved(editRecord ? data.record : data.record);
      onClose();
    } catch { toast.error("Failed to save record"); }
    finally { setSaving(false); }
  }

  const activeEmployees = employees.filter((e) => e.isActive);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editRecord ? "Edit Payroll Record" : "New Payroll Record"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee */}
          <div className="space-y-2">
            <Label>Employee *</Label>
            <Select value={form.employeeId} onValueChange={(v) => v && handleEmployeeChange(v)} disabled={!!editRecord}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {activeEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                    {emp.position ? ` · ${emp.position}` : ""}
                    {" "}
                    <span className="text-muted-foreground text-xs">({emp.payType})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEmp && (
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PAY_TYPE_BADGE[selectedEmp.payType]}`}>
                  {selectedEmp.payType}
                </span>
                <span className="text-xs text-muted-foreground">{payRateDisplay(selectedEmp)}</span>
              </div>
            )}
          </div>

          {/* Period — depends on pay type */}
          {selectedEmp?.payType === "DAILY" && (
            <div className="space-y-2">
              <Label htmlFor="rec-date">Date *</Label>
              <Input id="rec-date" type="date" value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required />
              <p className="text-xs text-muted-foreground">The day this employee worked.</p>
            </div>
          )}

          {selectedEmp?.payType === "HOURLY" && (
            <>
              <div className="space-y-2">
                <Label>Period Type *</Label>
                <Select value={form.periodType} onValueChange={(v) => v && setForm((p) => ({ ...p, periodType: v as RecordPeriod }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAY">Single Day</SelectItem>
                    <SelectItem value="WEEK">Week</SelectItem>
                    <SelectItem value="MONTH">Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.periodType === "DAY" && (
                <div className="space-y-2">
                  <Label htmlFor="rec-date-h">Date *</Label>
                  <Input id="rec-date-h" type="date" value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required />
                </div>
              )}
              {form.periodType === "WEEK" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="rec-wstart">Week Start *</Label>
                    <Input id="rec-wstart" type="date" value={form.weekStart}
                      onChange={(e) => setForm((p) => ({ ...p, weekStart: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rec-wend">Week End *</Label>
                    <Input id="rec-wend" type="date" value={form.weekEnd}
                      onChange={(e) => setForm((p) => ({ ...p, weekEnd: e.target.value }))} required />
                  </div>
                </div>
              )}
              {form.periodType === "MONTH" && (
                <div className="space-y-2">
                  <Label htmlFor="rec-month-h">Month *</Label>
                  <Input id="rec-month-h" type="month" value={form.yearMonth}
                    onChange={(e) => handleMonthChange(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="rec-hours">Hours Worked *</Label>
                <Input id="rec-hours" type="number" min="0" step="0.5" value={form.hoursWorked}
                  onChange={(e) => setForm((p) => ({ ...p, hoursWorked: e.target.value }))}
                  placeholder="0" className="font-mono" required />
                {computedHourly !== null && (
                  <p className="text-xs text-muted-foreground">
                    {form.hoursWorked} hrs × {formatLKR(selectedEmp.payRate)}/hr =
                    <span className="font-semibold text-foreground ml-1">{formatLKR(computedHourly)}</span>
                  </p>
                )}
              </div>
            </>
          )}

          {selectedEmp?.payType === "SALARY" && (
            <div className="space-y-2">
              <Label htmlFor="rec-month-s">Month *</Label>
              <Input id="rec-month-s" type="month" value={form.yearMonth}
                onChange={(e) => handleMonthChange(e.target.value)} required />
              <p className="text-xs text-muted-foreground">Covers the full calendar month.</p>
            </div>
          )}

          {/* Amount — for DAILY and SALARY (HOURLY is auto-calculated) */}
          {selectedEmp && selectedEmp.payType !== "HOURLY" && (
            <div className="space-y-2">
              <Label htmlFor="rec-amount">
                {selectedEmp.payType === "DAILY" ? "Amount Earned Today (LKR) *" : "Salary Amount (LKR) *"}
              </Label>
              <Input id="rec-amount" type="number" min="0" step="0.01" value={form.grossAmount}
                onChange={(e) => setForm((p) => ({ ...p, grossAmount: e.target.value }))}
                placeholder="0.00" className="font-mono" required />
            </div>
          )}

          {/* Deductions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Deductions <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Button type="button" variant="outline" size="sm" onClick={addDeduction}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
            {form.deductions.length > 0 && (
              <div className="space-y-2">
                {form.deductions.map((d, i) => (
                  <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center">
                    <Select value={d.type} onValueChange={(v) => v && updateDeduction(i, "type", v)}>
                      <SelectTrigger className="w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EPF">EPF</SelectItem>
                        <SelectItem value="ETF">ETF</SelectItem>
                        <SelectItem value="ADVANCE">Advance</SelectItem>
                        <SelectItem value="CUSTOM">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={d.label} onChange={(e) => updateDeduction(i, "label", e.target.value)}
                      placeholder="Label" className="text-xs" />
                    <Input type="number" min="0" step="0.01" value={d.amount}
                      onChange={(e) => updateDeduction(i, "amount", e.target.value)}
                      placeholder="0.00" className="w-24 font-mono text-xs" />
                    <button type="button" onClick={() => removeDeduction(i)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="rec-note">Note <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Input id="rec-note" value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              placeholder="Any remark about this payment" />
          </div>

          {/* Summary */}
          {selectedEmp && (gross > 0 || totalDed > 0) && (
            <div className="rounded-lg bg-muted/50 border p-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Gross</span>
                <span className="font-mono">{formatLKR(gross)}</span>
              </div>
              {totalDed > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Deductions</span>
                  <span className="font-mono">− {formatLKR(totalDed)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-1 text-primary">
                <span>Net Pay</span>
                <span className="font-mono">{formatLKR(net)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.employeeId} className="font-semibold">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editRecord ? "Save Changes" : "Add Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

type Tab = "employees" | "records";

export function PayrollClient() {
  const [tab, setTab] = useState<Tab>("records");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empDialogOpen, setEmpDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ emp: Employee; recordCount?: number } | null>(null);
  const [deletingEmp, setDeletingEmp] = useState(false);

  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null);

  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      setEmployees(data.employees ?? []);
    } catch { toast.error("Failed to load employees"); }
    finally { setEmpLoading(false); }
  }, []);

  const fetchRecords = useCallback(async () => {
    setRecLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterEmployee !== "all") params.set("employeeId", filterEmployee);
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`/api/payroll?${params.toString()}`);
      const data = await res.json();
      setRecords(data.records ?? []);
    } catch { toast.error("Failed to load records"); }
    finally { setRecLoading(false); }
  }, [filterEmployee, filterStatus]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { if (tab === "records") fetchRecords(); }, [fetchRecords, tab]);

  async function handleDeactivate(emp: Employee) {
    try {
      const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      toast.success("Employee deactivated");
      fetchEmployees();
    } catch { toast.error("Failed to deactivate"); }
  }

  async function handleReactivate(emp: Employee) {
    try {
      const res = await fetch(`/api/employees/${emp.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      toast.success("Employee reactivated");
      fetchEmployees();
    } catch { toast.error("Failed to reactivate"); }
  }

  async function initiateDeleteEmployee(emp: Employee) {
    const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.status === 409 && data.requiresForce) {
      setDeleteConfirm({ emp, recordCount: data.recordCount });
    } else if (res.ok) {
      toast.success("Employee deleted");
      fetchEmployees();
    } else {
      toast.error(data.error || "Failed to delete employee");
    }
  }

  async function confirmDeleteEmployee(force: boolean) {
    if (!deleteConfirm) return;
    setDeletingEmp(true);
    try {
      const url = `/api/employees/${deleteConfirm.emp.id}${force ? "?force=true" : ""}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to delete employee"); return; }
      toast.success("Employee deleted");
      fetchEmployees();
      fetchRecords();
      setDeleteConfirm(null);
    } catch { toast.error("Failed to delete employee"); }
    finally { setDeletingEmp(false); }
  }

  async function handleMarkPaid(record: PayrollRecord) {
    setMarkingPaid(record.id);
    try {
      const res = await fetch(`/api/payroll/${record.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to mark paid"); return; }
      toast.success("Marked as paid");
      setRecords((prev) => prev.map((r) => r.id === record.id ? data.record : r));
    } catch { toast.error("Failed to mark paid"); }
    finally { setMarkingPaid(null); }
  }

  async function handleDelete(record: PayrollRecord) {
    setDeletingId(record.id);
    try {
      const res = await fetch(`/api/payroll/${record.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to delete"); return; }
      toast.success("Record deleted");
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
    } catch { toast.error("Failed to delete"); }
    finally { setDeletingId(null); }
  }

  function onRecordSaved(r: PayrollRecord) {
    if (editingRecord) {
      setRecords((prev) => prev.map((x) => x.id === r.id ? r : x));
    } else {
      setRecords((prev) => [r, ...prev]);
    }
  }

  const activeCount = employees.filter((e) => e.isActive).length;
  const pendingCount = records.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll"
        description={`${activeCount} active employee${activeCount !== 1 ? "s" : ""} · ${pendingCount} pending payment${pendingCount !== 1 ? "s" : ""}`}
      />

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        {(["records", "employees"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "records" ? (
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" /> Pay Records
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Employees
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Records Tab ── */}
      {tab === "records" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Employee filter */}
            <Select value={filterEmployee} onValueChange={(v) => { if (v) setFilterEmployee(v); }}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue>
                  {filterEmployee === "all"
                    ? "All Employees"
                    : employees.find((e) => e.id === filterEmployee)?.name ?? "Employee"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={filterStatus} onValueChange={(v) => { if (v) setFilterStatus(v); }}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue>
                  {filterStatus === "all" ? "All Status" : filterStatus === "PENDING" ? "Pending" : "Paid"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <Button
              onClick={() => { setEditingRecord(null); setRecordDialogOpen(true); }}
              disabled={activeCount === 0}
              className="font-semibold"
            >
              <Plus className="h-4 w-4 mr-2" /> New Record
            </Button>
          </div>

          {activeCount === 0 && (
            <div className="rounded-xl border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">Add employees first before creating pay records.</p>
              <Button variant="outline" className="mt-3" onClick={() => setTab("employees")}>
                Go to Employees
              </Button>
            </div>
          )}

          {recLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No pay records yet"
              description="Add a new record to track an employee payment."
              action={activeCount > 0
                ? { label: "New Record", onClick: () => { setEditingRecord(null); setRecordDialogOpen(true); } }
                : undefined}
            />
          ) : (
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground text-xs">
                    <th className="text-left py-2.5 px-4 font-medium">Employee</th>
                    <th className="text-left py-2.5 px-4 font-medium hidden sm:table-cell">Period</th>
                    <th className="text-right py-2.5 px-4 font-medium hidden md:table-cell">Hrs</th>
                    <th className="text-right py-2.5 px-4 font-medium">Gross</th>
                    <th className="text-right py-2.5 px-4 font-medium hidden sm:table-cell">Ded.</th>
                    <th className="text-right py-2.5 px-4 font-medium">Net Pay</th>
                    <th className="text-left py-2.5 px-4 font-medium hidden md:table-cell">Status</th>
                    <th className="py-2.5 px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium">{r.employee.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {r.employee.position && (
                            <span className="text-xs text-muted-foreground">{r.employee.position}</span>
                          )}
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PAY_TYPE_BADGE[r.employee.payType]}`}>
                            {r.employee.payType}
                          </span>
                        </div>
                        {r.note && <p className="text-xs text-muted-foreground italic mt-0.5">{r.note}</p>}
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell text-muted-foreground text-xs">
                        {periodLabel(r)}
                        {r.deductions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.deductions.map((d) => (
                              <span key={d.id} className="bg-muted px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                                {d.label}: {formatLKR(d.amount)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono hidden md:table-cell">
                        {r.hoursWorked !== null ? `${r.hoursWorked}h` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{formatLKR(r.grossAmount)}</td>
                      <td className="py-3 px-4 text-right font-mono text-destructive hidden sm:table-cell">
                        {r.totalDeductions > 0 ? `− ${formatLKR(r.totalDeductions)}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-primary">
                        {formatLKR(r.netAmount)}
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status]}`}>
                          {r.status === "PAID" ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Paid
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </span>
                        {r.paidAt && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(r.paidAt)}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 justify-end">
                          {r.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleMarkPaid(r)}
                                disabled={markingPaid === r.id}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                title="Mark as Paid"
                              >
                                {markingPaid === r.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <CheckCircle2 className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                onClick={() => { setEditingRecord(r); setRecordDialogOpen(true); }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="Edit record"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(r)}
                                disabled={deletingId === r.id}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Delete record"
                              >
                                {deletingId === r.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick totals */}
          {records.length > 0 && (
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground px-1">
              <span>
                Total net (shown): <span className="font-mono font-semibold text-foreground">
                  {formatLKR(records.reduce((s, r) => s + r.netAmount, 0))}
                </span>
              </span>
              <span>
                Paid: <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                  {formatLKR(records.filter((r) => r.status === "PAID").reduce((s, r) => s + r.netAmount, 0))}
                </span>
              </span>
              <span>
                Pending: <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                  {formatLKR(records.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.netAmount, 0))}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Employees Tab ── */}
      {tab === "employees" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingEmployee(null); setEmpDialogOpen(true); }} className="font-semibold">
              <Plus className="h-4 w-4 mr-2" /> Add Employee
            </Button>
          </div>

          {empLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : employees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No employees yet"
              description="Add your first employee to start tracking payroll."
              action={{ label: "Add Employee", onClick: () => { setEditingEmployee(null); setEmpDialogOpen(true); } }}
            />
          ) : (
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground text-xs">
                    <th className="text-left py-2.5 px-4 font-medium">Name</th>
                    <th className="text-left py-2.5 px-4 font-medium hidden sm:table-cell">Position</th>
                    <th className="text-left py-2.5 px-4 font-medium">Pay Type</th>
                    <th className="text-right py-2.5 px-4 font-medium">Rate</th>
                    <th className="text-left py-2.5 px-4 font-medium hidden md:table-cell">Status</th>
                    <th className="py-2.5 px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium">{emp.name}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden sm:table-cell">{emp.position ?? "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PAY_TYPE_BADGE[emp.payType]}`}>
                          {emp.payType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm">{payRateDisplay(emp)}</td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <Badge variant={emp.isActive ? "default" : "secondary"} className="text-xs">
                          {emp.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => { setEditingEmployee(emp); setEmpDialogOpen(true); }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {emp.isActive ? (
                            <button
                              onClick={() => handleDeactivate(emp)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                              title="Deactivate"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(emp)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                              title="Reactivate"
                            >
                              <Users className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => initiateDeleteEmployee(emp)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete employee"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <EmployeeDialog
        open={empDialogOpen}
        onClose={() => { setEmpDialogOpen(false); setEditingEmployee(null); }}
        employee={editingEmployee}
        onSaved={fetchEmployees}
      />

      <RecordDialog
        open={recordDialogOpen}
        onClose={() => { setRecordDialogOpen(false); setEditingRecord(null); }}
        employees={employees}
        editRecord={editingRecord}
        onSaved={onRecordSaved}
      />

      {/* Delete employee confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Employee
            </DialogTitle>
          </DialogHeader>
          {deleteConfirm && (
            <div className="space-y-4">
              {deleteConfirm.recordCount ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{deleteConfirm.emp.name}</span> has{" "}
                  <span className="font-semibold text-destructive">{deleteConfirm.recordCount} payroll record{deleteConfirm.recordCount !== 1 ? "s" : ""}</span>.
                  Deleting this employee will permanently remove all their pay records too.
                  This cannot be undone.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Permanently delete <span className="font-semibold text-foreground">{deleteConfirm.emp.name}</span>?
                  This cannot be undone.
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deletingEmp}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => confirmDeleteEmployee(true)}
                  disabled={deletingEmp}
                  className="font-semibold"
                >
                  {deletingEmp && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Delete Permanently
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
