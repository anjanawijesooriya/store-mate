# Add-On Module Feature Plan

> These features are gated behind admin-enabled add-ons. Not available by default on any plan.
> Each module is enabled per-shop from the admin panel.

---

## 1. Card Payment + Surcharge

### Background

When a customer pays by card, the bank charges the business a processing fee (currently ~3%, negotiable). This rate changes when the shop renegotiates with their bank. The system must:

- Support a configurable surcharge rate per shop
- Track which sales were paid by card and what fee was applied
- Feed card fees into P&L as a cost of doing business

### Who Pays the Surcharge?

The **bank always charges the business** — that is fixed. The shop decides whether to pass that cost to the customer or absorb it.

| Model | What happens at checkout | Business impact |
|---|---|---|
| **Customer pays (surcharge model)** | System adds 3% on top of cart total. Customer pays LKR 5,150 instead of LKR 5,000. | Business receives full LKR 5,000 after bank fee. Zero loss. |
| **Business absorbs** | Cart total unchanged. Customer pays LKR 5,000. | Bank deducts LKR 150. Business nets LKR 4,850. LKR 150 recorded as card fee expense. |

The system should support **both models** — controlled by a shop setting.

### How the Physical Card Machine Works

The bank's EDC terminal (card machine) is a **standalone physical device** — it does not connect to the software automatically. There is no API. The cashier manually enters the amount on the terminal, the customer taps/swipes, and the terminal shows "Approved."

**POS checkout flow (card payment):**

```
Cart confirmed
  ↓
Cashier selects payment method: [CASH]  [CARD]
  ↓ (CARD selected)
System displays:
  - Cart total:    LKR 5,000.00
  - Card fee (3%): LKR   150.00   ← only shown if surcharge model = customer pays
  - Charge on terminal: LKR 5,150.00
  ↓
Cashier manually enters LKR 5,150.00 on the physical EDC terminal
Customer taps card → terminal shows "Approved"
  ↓
Cashier clicks [Confirm Card Payment] in POS
  ↓
Sale is recorded:
  paymentMethod: CARD
  subtotal:      LKR 5,000.00
  cardFee:       LKR   150.00
  cardFeeRate:   0.03  ← snapshot of rate at time of sale
  total:         LKR 5,150.00  (or LKR 5,000 if business absorbs)
  ↓
Receipt / SMS / Email step
```

### Data Model Changes

**Shop model additions:**
```
cardPaymentEnabled    Boolean  @default(false)   // admin-enabled add-on
cardSurchargeRate     Decimal  @default(0.03)    // e.g. 0.03 = 3%, editable by shop owner
cardSurchargeModel    Enum     // CUSTOMER_PAYS | BUSINESS_ABSORBS
```

**Sale model additions:**
```
paymentMethod   Enum     // CASH | CARD  (default CASH)
cardFee         Decimal  @default(0)    // actual fee amount on this sale
cardFeeRate     Decimal  @default(0)    // snapshot of rate used
```

### Settings UI (Shop Settings → Payments tab)

- Toggle: Enable card payments
- Input: Surcharge rate (%) — editable when bank renegotiates
- Radio: Who pays surcharge — Customer / Business absorbs
- Info box: "The bank always deducts their fee from your settlement. This setting controls whether you recover that cost from the customer."

### Reporting

- Sales report: filter by payment method (Cash / Card)
- Card fee summary: total fees paid in period
- P&L: card fees appear as "Payment Processing" expense line

---

## 2. Payroll Module

### Background

For a multi-branch business, wages and salaries must be tracked per employee, per branch, per pay period. A simple expense entry is not enough. This module handles the full payroll lifecycle.

### Scope

- Employee management (per branch or shared across branches)
- Pay types: Monthly salary, Hourly wage, Daily wage
- Pay periods: Weekly, Bi-weekly, Monthly
- Payroll runs: Calculate, review, mark as paid
- Deductions: EPF, ETF, advances, custom deductions
- Payslip generation (PDF / SMS / email to employee)
- Payroll feeds into P&L as "Staff Costs"

### Data Model (New Tables)

**Employee**
```
id, shopId (or null = cross-branch), branchId
name, phone, email, NIC
role/position (e.g. "Cashier", "Manager")
payType: SALARY | HOURLY | DAILY
payRate: Decimal     // monthly salary, or hourly/daily rate
joinDate, isActive
```

**PayPeriod**
```
id, shopId
periodStart, periodEnd
type: WEEKLY | BIWEEKLY | MONTHLY
status: DRAFT | CONFIRMED | PAID
paidAt, paidBy
```

**PayrollEntry** (one per employee per pay period)
```
id, payPeriodId, employeeId
grossPay: Decimal
deductions: Decimal   // EPF/ETF/advances
netPay: Decimal
hoursWorked: Decimal  // for HOURLY employees
daysWorked: Int       // for DAILY employees
notes
```

**Deduction** (optional breakdown per entry)
```
id, payrollEntryId
type: EPF | ETF | ADVANCE | CUSTOM
label, amount
```

### Payroll Run Flow

```
Pay Period created (e.g. June 2026)
  ↓
System pre-fills each active employee's gross pay
  (salary employees: fixed amount, hourly: hours × rate)
Admin reviews and adjusts: add deductions, override amounts
  ↓
Confirm pay period → locked, cannot edit
  ↓
Mark as Paid → records paidAt date
  ↓
Optional: generate payslips → PDF download / email employee
```

### Admin Controls

- Enable Payroll module per shop (admin panel)
- Shop owner can manage their own employees
- Super-admin can view payroll across all branches for reporting

### P&L Integration

- Each confirmed pay period → sum of all net pay → "Staff Wages" expense in P&L for that period
- Deductions (EPF/ETF) tracked separately for compliance reporting

---

## 3. Expenses Module

### Background

Beyond payroll and card fees, shops have ongoing operating costs: rent, utilities, supplies, maintenance, etc. A simple expense log handles these.

### Scope

- Manual expense entries
- Categories: Rent, Utilities, Stock Purchase (non-system), Marketing, Maintenance, Other
- Attach receipt photo (optional)
- Feeds into P&L

### Data Model (New Table)

**Expense**
```
id, shopId, branchId (optional)
date
amount: Decimal
category: Enum  // RENT | UTILITIES | SUPPLIES | MARKETING | MAINTENANCE | OTHER
description
receiptUrl  // optional file upload
recordedBy (userId)
```

---

## 4. P&L Report

### Background

P&L (Profit & Loss) is the summary of revenue minus all costs over a period. It requires data from Sales, Payroll, Expenses, and Card Fees.

### P&L Structure

```
REVENUE
  + Product sales (COMPLETED + PENDING_PAYMENT)
  − Returns / refunds
  = Gross Revenue

COST OF GOODS SOLD (COGS)
  − Cost price × quantity sold per product
  = Gross Profit

OPERATING EXPENSES
  − Staff wages (from Payroll module)
  − Card processing fees (from Sale.cardFee)
  − Operating expenses (from Expenses module)
  = Total Expenses

NET PROFIT
  = Gross Profit − Total Expenses
```

### Report Controls

- Date range: Today / This Week / This Month / Custom
- Branch filter (for multi-branch)
- Export: PDF / Excel

---

## 5. Implementation Priority

| Module | Priority | Depends On |
|---|---|---|
| Card Payment + Surcharge | High | Nothing new — extends Sale + POS |
| Expenses Module | Medium | Nothing |
| P&L Report | Medium | Sales (exists) + Expenses |
| Payroll Module | Low-Medium | Expenses for P&L integration |

### Recommended Build Order

1. **Card Payment + Surcharge** — extends existing POS, high business value, medium effort
2. **Expenses Module** — simple CRUD, feeds P&L
3. **P&L Report** — uses existing sales + new expenses data
4. **Payroll Module** — most complex, build last

---

## 6. Admin Panel Add-On Controls

Each module is toggled per shop from the admin panel (similar to SMS add-on):

| Add-On | Admin Toggle | Shop Setting |
|---|---|---|
| Card Payments | Enable card payment add-on | Surcharge rate, model (customer/business) |
| Payroll | Enable payroll module | Pay period type, EPF/ETF rates |
| Expenses | Enable expenses module | Categories |
| P&L Report | Auto-enabled when Expenses + Sales exist | Date range preference |
