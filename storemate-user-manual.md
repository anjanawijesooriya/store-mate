# StoreMate — Shop Owner User Manual

**Version:** Current  
**Language:** English  
**For:** Shop owners and cashiers using StoreMate

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [The Dashboard — Your Daily Overview](#2-the-dashboard)
3. [Inventory — Managing Your Products](#3-inventory)
4. [Point of Sale (POS) — Making a Sale](#4-point-of-sale-pos)
5. [Receipts — Print, Email & Share](#5-receipts)
6. [Sales History — View Past Transactions](#6-sales-history)
7. [Customers — Managing Your Customer List](#7-customers)
8. [Expenses — Tracking Your Costs](#8-expenses)
9. [Reports — Understanding Your Business](#9-reports)
10. [Settings — Configuring Your Shop](#10-settings)
11. [Common Questions](#11-common-questions)
12. [Tips for Getting the Most Out of StoreMate](#12-tips)

---

## 1. Getting Started

### Logging In

1. Open StoreMate in your browser (or tap the app icon on your phone/tablet)
2. Enter your registered **phone number** and **password**
3. Tap **Sign In**

If you forget your password, tap **Forgot Password** on the login screen. You will receive an OTP (one-time code) on your registered phone number to reset it.

### First-Time Setup Checklist

When you log in for the first time, you will see a checklist on the dashboard. Complete these steps to get your shop ready:

- [ ] **Add your shop address** — goes on your receipts
- [ ] **Add your first product** — so you can start making sales
- [ ] **Make your first sale** — to confirm everything is working

You can dismiss the checklist once you are comfortable. It will not appear again.

### Trial Period

New accounts start on a **free trial**. You can use all features during the trial. When the trial is about to end, you will see a reminder banner at the top of every page. Contact your StoreMate provider to continue your subscription before the trial ends.

---

## 2. The Dashboard

The Dashboard is the first screen you see after logging in. It gives you a quick summary of how your business is doing today.

### What You Can See

| Section | What it shows |
|---|---|
| **Today's Sales** | Total revenue and number of sales made today |
| **Compared to Yesterday** | Whether today is up or down (shown as a % arrow) |
| **This Week / This Month** | Running totals for the current week and month |
| **Low Stock Alert** | Number of products that are running low — tap to go to Inventory |
| **Total Products** | How many products are in your inventory |
| **Top Products** | The 5 best-selling products this week |
| **Sales Chart** | Bar chart of daily sales for the last 7 days |

### Reading the Sales Chart

Each bar represents one day. Hover (or tap) a bar to see the exact amount and number of transactions for that day. Use this to spot your busy days and slow days.

---

## 3. Inventory

Inventory is where you manage all your products — add new ones, update prices, adjust stock, and track what you have.

Go to **Inventory** from the left sidebar menu.

---

### 3.1 Adding a New Product

1. Tap the **+ Add Product** button (top right)
2. Fill in the product details:

| Field | Required? | What to enter |
|---|---|---|
| **Name** | Yes | Product name (e.g. "Milo 400g Tin") |
| **Item Code** | No | Your own internal code (e.g. "IC-001") |
| **SKU / Barcode** | No | The barcode number printed on the product |
| **Category** | No | Group products (e.g. "Beverages", "Dry Food") |
| **Unit** | Yes | How it is sold: pcs, kg, g, l, ml, box, etc. |
| **Cost Price** | Yes | What you paid for it (buying price) |
| **Sell Price** | Yes | What you charge customers |
| **Stock Qty** | Yes | How many you currently have |
| **Low Stock Alert** | Yes | Warn you when stock falls to this number |
| **Warranty Period** | No | e.g. "1 Year" — appears on receipt |
| **Service Item** | No | Tick this if it is a service (no stock tracking) |

3. Tap **Save**. The product appears in your inventory list, sorted alphabetically.

**Tip:** Set the Low Stock Alert to a realistic number. If you normally reorder when you have 5 left, set it to 5. You will get an alert before you run out.

---

### 3.2 Editing a Product

1. Find the product in the list (use the search bar to find it quickly)
2. Tap the **pencil (edit) icon** on the right side of the row
3. Change what you need
4. Tap **Save**

---

### 3.3 Adjusting Stock Manually

Use this when you receive new stock, do a stock count, or need to correct a number.

1. Find the product in the inventory list
2. Tap the **adjust icon** (looks like a stack of boxes) on that row
3. Choose the **type of adjustment**:
   - **Restock** — adding new stock received from supplier
   - **Adjustment** — correcting a count (stock take)
   - **Damage** — removing damaged/expired goods
   - **Return** — returned items going back to stock
4. Enter the **quantity** (for Restock and Return, enter a positive number; for Damage, enter the number being removed)
5. Enter a **reason/note** (required — e.g. "Received from supplier 9 July")
6. Tap **Save**

Every stock adjustment is logged with the date and reason, so you always know why a stock number changed.

---

### 3.4 Searching and Filtering Products

- Use the **search bar** at the top of the inventory list to find products by name, item code, or SKU
- Products are always listed in **alphabetical order**
- Look for the **stock badge** on each row:
  - **Green** — stock is fine
  - **Amber / Warning** — low stock (at or below your alert threshold)
  - **Red** — out of stock (0)

---

### 3.5 Deleting a Product

Tap the **trash icon** on a product row. You will be asked to confirm.

**Important:** You can only delete products that have never been sold. If a product has sales history, it will be deactivated instead of deleted — this protects your sales records.

---

### 3.6 Importing Products from Excel (Bulk Upload)

If you have many products, you can add them all at once using an Excel file instead of entering them one by one.

#### Step 1 — Download the sample template

1. Tap **Import Excel** (top right of Inventory)
2. In the dialog, tap **Download Sample Template**
3. Open the downloaded file in Excel or Google Sheets

#### Step 2 — Fill in your products

The template has these columns in order:

| Column | Example |
|---|---|
| Name | Milo 400g Tin |
| Item Code | IC-001 |
| SKU/Barcode | 4800724714055 |
| Category | Beverages |
| Unit | pcs |
| Cost Price | 450 |
| Sell Price | 550 |
| Stock Qty | 24 |
| Low Stock At | 5 |
| Warranty Period | (leave blank if none) |

**Rules:**
- **Name**, **Cost Price**, and **Sell Price** are required for every row
- All other columns are optional — leave them blank if you do not need them
- Do not change the column order or headers
- You can import up to 5,000 products at a time

#### Step 3 — Upload the file

1. Tap **Import Excel** in the inventory header
2. Make sure **Add New Products** is selected
3. Tap **Choose File** and select your filled-in Excel file
4. StoreMate will show a preview of what will be imported — check it looks correct
5. Tap **Import**
6. When finished, you will see how many products were added and if any rows had errors

**BASIC plan note:** BASIC plan shops are limited to 500 products. If you are already at the limit, the import will be blocked. Contact your provider to upgrade.

---

### 3.7 Updating Existing Products from Excel (Bulk Update)

Use this to update prices, stock quantities, or other details for many products at once — without affecting any other fields.

1. Tap **Import Excel**
2. Select **Update Existing** (the second option)
3. Prepare your Excel file — you only need to include columns you want to change, plus at least one identifier column (Item Code, SKU, or Name)
4. Upload the file and tap **Import**

**Example:** To update only selling prices, your file would have two columns: `Item Code` and `Sell Price`. Everything else on each product stays unchanged.

Products are matched by Item Code first, then SKU, then Name. If no match is found for a row, it is listed as an error.

---

### 3.8 Exporting Your Inventory to Excel

To download your full product list as an Excel file:

1. Tap **Export Excel** (next to the Import button)
2. The file downloads automatically
3. Open it in Excel or Google Sheets — it has the same columns as the import template

Useful for doing a stock count, sharing with a supplier, or keeping a backup record.

---

## 4. Point of Sale (POS)

The POS screen is where you process sales. It is designed to be fast — a typical sale should take under 30 seconds.

Go to **POS** from the left sidebar.

---

### 4.1 Finding and Adding Products

**Search by name:**
- Start typing the product name in the search bar at the top
- Results appear instantly
- Tap a product to add it to the cart

**Scan a barcode:**
- Tap the **barcode icon** next to the search bar
- Allow camera access when prompted
- Point the camera at the product barcode
- The product is added to the cart automatically

**Tip:** If you type a full barcode number or item code into the search bar, it will also find the matching product.

---

### 4.2 Managing the Cart

Once products are in the cart (right side of screen):

| Action | How to do it |
|---|---|
| Increase quantity | Tap the **+** button |
| Decrease quantity | Tap the **−** button |
| Remove an item | Tap the **trash icon** on the item |
| Change the price | Tap the price number — it becomes editable |
| Clear the cart | Tap the trash icon at the top of the cart |

The **running total** at the bottom of the cart updates automatically.

---

### 4.3 Applying a Discount

1. Tap the **% Discount** button below the cart
2. Choose **Flat Amount** (e.g. LKR 100 off) or **Percentage** (e.g. 10% off)
3. Enter the discount amount
4. Tap **Apply**

The discount is shown as a separate line, and the total is recalculated.

---

### 4.4 Attaching a Customer to the Sale

To link this sale to a customer (useful for credit sales or sending a receipt):

1. Tap the **Customer** icon (person icon) in the cart area
2. Search by name or phone number
3. Tap the customer to attach them

To add a new customer on the spot, tap **+ New Customer** in the search results.

---

### 4.5 Completing the Sale — Payment

When the cart is ready, tap the **Charge** button (the large button at the bottom of the cart).

A payment screen appears. Select the payment method:

| Method | When to use |
|---|---|
| **Cash** | Customer pays with notes/coins |
| **Card** | Credit or debit card (physical card terminal) |
| **Online** | Bank transfer, mobile payment |
| **Credit** | Customer pays later (recorded on their account) |

**For Cash payments:** Enter the amount the customer hands you. StoreMate calculates the **change** to give back automatically.

**For Card payments (if surcharge is enabled):** A card processing fee is added automatically and shown before you confirm. The total includes the fee.

Tap **Confirm Sale** to complete the transaction.

---

### 4.6 Holding a Sale

If a customer needs more time to decide, you can hold their cart and serve another customer:

1. Tap **Hold Sale** (the bookmark/hold icon at the top of the cart)
2. The cart is saved — the POS clears for a new sale
3. To resume a held sale, tap **Held Sales** and select it

You can hold multiple sales at the same time.

---

### 4.7 Offline Mode

StoreMate works even when your internet is down.

When the connection drops:
- A **"Offline"** banner appears at the top of the POS screen
- You can still search products and complete sales
- Sales are saved on your device

When the internet comes back:
- Held offline sales sync to the server automatically
- The banner disappears

**Always check that offline sales have synced before closing the browser/app for the day.**

---

## 5. Receipts

After every sale, StoreMate offers four ways to give the customer a receipt.

### 5.1 Print Receipt

On the on-screen receipt after completing a sale:

1. Tap **Print**
2. Your browser's print dialog opens
3. Select your receipt printer (thermal printer recommended — 80mm width)
4. Print

The receipt includes: shop name, date/time, item list (with item codes), quantities, prices, discount, total, and payment method.

### 5.2 Send Receipt by Email

1. On the receipt screen, tap **Email Receipt**
2. Enter (or confirm) the customer's email address
3. Tap **Send**

The customer receives a formatted receipt email with all sale details.

### 5.3 Send Receipt by SMS

1. On the receipt screen, tap **SMS Receipt**
2. Confirm the customer's phone number
3. Tap **Send**

The customer receives an SMS with a link to their receipt page. (SMS must be enabled in Settings.)

### 5.4 Shareable Receipt Link

Every receipt has a permanent web link. To share it:

1. Tap **Share / Download** on the receipt
2. Copy the link and send it via WhatsApp, Viber, or any messaging app

The customer can open the link on their phone to view the full receipt at any time.

---

## 6. Sales History

View all past sales, look up specific transactions, and manage refunds or exchanges.

Go to **Sales** from the left sidebar.

---

### 6.1 Finding a Sale

- Use the **date range picker** to filter by date
- Use the **search bar** to find by customer name
- Filter by **payment method** (Cash, Card, Online, Credit) using the dropdown
- Filter by **status** (Completed, Refunded, Voided, etc.)

Tap any row to see the full details of that sale.

---

### 6.2 Voiding a Sale

If a sale was entered by mistake and has not yet left the shop:

1. Open the sale detail
2. Tap **Void Sale**
3. Confirm

Stock is returned to inventory when a sale is voided.

### 6.3 Refunding a Sale

If a customer returns an item:

1. Open the original sale
2. Tap **Refund**
3. Select which items are being returned
4. Confirm

Stock for returned items is added back to inventory.

### 6.4 Exchange

If a customer wants to swap a product for another:

1. Open the original sale
2. Tap **Exchange**
3. Follow the prompts to remove old items and add new ones
4. Confirm — the difference is charged or refunded

---

## 7. Customers

Keep a record of your regular customers, track their purchase history, and manage credit accounts.

Go to **Customers** from the left sidebar.

---

### 7.1 Adding a Customer

1. Tap **+ Add Customer**
2. Enter:
   - **Name** (required)
   - **Phone number**
   - **Email address**
   - **Address**
3. Tap **Save**

### 7.2 Customer Profile

Tap any customer in the list to see:
- Contact details
- **Total spent** (lifetime)
- **Credit balance** (how much they owe you, if any)
- **Purchase history** — every sale linked to this customer

### 7.3 Credit Accounts

Some regular customers pay at the end of the month or when convenient ("on account"). StoreMate tracks this for you.

**To sell on credit:**
1. Attach the customer to the sale in POS
2. Select **Credit** as the payment method
3. Complete the sale — the amount is added to their credit balance

**To record a payment from the customer:**
1. Go to **Customers**
2. Open the customer profile
3. Tap **Record Payment**
4. Enter the amount paid
5. Save — the credit balance is reduced

**Always check a customer's credit balance** (shown in the customer list) before allowing more credit sales.

---

## 8. Expenses

Track money your shop spends so you can see your real profit, not just revenue.

Go to **Expenses** from the left sidebar.

---

### 8.1 Adding an Expense

1. Tap **+ Add Expense**
2. Fill in:

| Field | Example |
|---|---|
| **Category** | Rent, Utilities, Wages, Supplies, etc. |
| **Amount** | 25000 |
| **Date** | Select the date the expense occurred |
| **Note** | Optional description (e.g. "August rent to landlord") |

3. Tap **Save**

**Tip:** Log expenses on the day they happen. Waiting until the end of the month makes it hard to remember details.

### 8.2 Expense Categories

| Category | Use for |
|---|---|
| Rent | Monthly shop rent |
| Utilities | Electricity, water, internet bills |
| Wages | Staff salaries |
| Supplies | Packaging, bags, stationery |
| Transport | Delivery costs, vehicle fuel |
| Marketing | Flyers, advertising |
| Repairs | Equipment repairs, maintenance |
| Purchases / Stock | Money spent buying stock (if not tracked elsewhere) |
| Loan Payment | Bank loan or borrowed money repayments |
| Other | Anything else |

### 8.3 Editing or Deleting an Expense

- Tap the **pencil icon** to edit
- Tap the **trash icon** to delete
- You can only edit/delete expenses from the **current month**. Past months are locked to protect your records.

---

## 9. Reports

Reports help you understand how your business is performing over time.

Go to **Reports** from the left sidebar.

---

### 9.1 Date Range

At the top of the Reports screen, select a date range:
- **Today**
- **Yesterday**
- **This Week**
- **This Month**
- **Last Month**
- **Custom Range** — pick any start and end date

All report numbers change to match your selected range.

---

### 9.2 Sales Summary

Shows the headline numbers for your selected period:
- **Total Revenue** — all money collected
- **Total Transactions** — number of sales
- **Average Sale Value** — revenue ÷ transactions
- **Payment method breakdown** — how much was Cash vs Card vs Online vs Credit

---

### 9.3 Profit & Loss (P&L)

Shows your actual profit after subtracting costs:

| Line | What it means |
|---|---|
| **Revenue** | Total from sales |
| **Cost of Goods Sold (COGS)** | What you paid for the products you sold |
| **Gross Profit** | Revenue minus COGS |
| **Expenses** | Shop costs logged in Expenses |
| **Card Fees** | Surcharge collected (if enabled) |
| **Net Profit** | Gross Profit minus Expenses |

This is the most important number — it tells you if your shop is actually making money.

### 9.4 Top Products

A list of your best-selling products by quantity and revenue for the selected period. Use this to:
- Make sure you never run out of your top sellers
- Identify slow-moving products that are taking up shelf space

### 9.5 Sales by Payment Method

Useful for **end-of-day cash reconciliation**: compare the Cash total in this report with the actual cash in your drawer. If they do not match, there may be an error to investigate.

### 9.6 Sales by Hour

Shows which hours of the day are busiest. Useful for deciding when you need more staff on the counter.

---

## 10. Settings

Go to **Settings** from the left sidebar (gear icon at the bottom).

---

### 10.1 Shop Profile

Update your shop's basic information:
- Shop name
- Owner name
- Address (appears on receipts)
- Shop category

Tap **Save Changes** after editing.

---

### 10.2 Notifications

Control which alerts are sent and how. Notifications are split into **SMS** and **Email**.

| Notification | What it does |
|---|---|
| **Low Stock Alert** | Tells you when a product falls below its alert threshold |
| **Daily Summary** | Sends a summary of the day's sales (usually at 9 PM) |
| **Receipt to Customer** | Sends the customer a receipt after each sale |

**To enable SMS notifications:** SMS must be activated on your account (SMS add-on). Contact your StoreMate provider. Your SMS balance is shown in Settings.

**To enable email notifications:** Enter the email address where you want to receive alerts in your shop profile.

Toggle each notification type on or off using the switches.

---

### 10.3 Billing & Subscription

Shows your current plan and subscription status:

| Status | Meaning |
|---|---|
| **Free Trial** | Trial is active — all features available |
| **Active** | Subscription is paid and running normally |
| **Grace Period** | Payment is overdue but the shop still works — pay soon |
| **Locked** | Access is restricted due to unpaid subscription — contact your provider |

You can also see your payment history here.

**Plan tiers:**

| Plan | Product Limit | Features |
|---|---|---|
| **Basic** | 500 products | Core POS, inventory, reports |
| **Standard** | 5,000 products | All Basic features + SMS notifications |
| **Premium** | 5,000 products | All Standard features + priority support |

---

### 10.4 Change Password

1. Go to Settings
2. Scroll to **Change Password**
3. Enter your current password, then your new password (twice)
4. Tap **Update Password**

---

### 10.5 Devices

StoreMate tracks which devices are logged in to your account. If you log in from a phone and a tablet, both are listed here.

If you see a device you do not recognise, contact your StoreMate provider immediately.

---

## 11. Common Questions

**Q: I made a mistake on a sale. What do I do?**  
A: Go to **Sales**, find the sale, and tap **Void** if the customer is still there and nothing has been taken. If the customer already left with the goods, use **Refund** instead.

---

**Q: A product shows "Out of stock" but I know I have it. How do I fix it?**  
A: Go to **Inventory**, find the product, tap the adjust icon, select **Adjustment**, and enter the correct quantity. Add a note like "Stock count correction."

---

**Q: How do I add a product that has a warranty?**  
A: When adding or editing the product, fill in the **Warranty Period** field (e.g. "1 Year", "6 Months"). It will appear on receipts automatically.

---

**Q: A customer wants a receipt but I already closed the sale.**  
A: Go to **Sales**, find the sale, open it, and use **Email Receipt** or **Share Link** to send them a copy. Every sale's receipt is always available.

---

**Q: I have 300 products to add. Do I have to enter them one by one?**  
A: No. Use **Import Excel** in Inventory. Fill in the template and upload it — all products are added at once. See Section 3.6.

---

**Q: Prices changed for many products. How do I update them without re-entering everything?**  
A: Use **Import Excel → Update Existing** mode. Create an Excel file with just the Item Code column and the Sell Price column, fill in the new prices, and upload. Only the prices are updated — nothing else changes. See Section 3.7.

---

**Q: The internet went down in the middle of a busy period. What do I do?**  
A: Keep selling as normal. StoreMate continues to work offline. You will see an "Offline" banner. When the internet comes back, everything syncs automatically.

---

**Q: How do I know if the daily SMS was sent?**  
A: Go to **Reports** and check the day's summary. If SMS alerts are not arriving, check that SMS notifications are toggled on in **Settings → Notifications** and that your SMS balance is not zero.

---

**Q: How do I give a regular customer a discount every time?**  
A: Currently, discounts are applied per sale in the POS (tap % Discount before charging). You can also adjust the cart price directly for that customer's items.

---

**Q: Can two people use StoreMate at the same time (e.g. owner and cashier)?**  
A: Yes, as long as both are logged in under the same shop account on separate devices. The inventory and sales stay in sync across all devices.

---

**Q: My trial is ending. What happens if I do not pay?**  
A: After the trial ends, you get a short **grace period** (shown in Settings) where everything still works but you see a warning banner. After the grace period, the shop is **locked** — you can still view old sales and inventory but cannot process new sales. Contact your provider to unlock.

---

## 12. Tips for Getting the Most Out of StoreMate

**Set up your products properly from day one.**  
Take the time to enter correct cost prices and sell prices. Without accurate cost prices, the profit figures in Reports are meaningless.

**Use item codes for products without barcodes.**  
If a product does not have a barcode, assign your own item code (e.g. IC-001, IC-002). It helps with Excel imports/exports and searching.

**Set low stock alerts at sensible levels.**  
If you usually reorder when you have 5 units left, set the alert at 5 — not 0. By the time it hits 0 you may already have lost sales.

**Log expenses every week, not once a month.**  
Weekly expense logging takes 5 minutes and gives you much more useful P&L numbers. Month-end catch-up is always harder.

**Check your daily summary each evening.**  
The daily sales summary SMS/email is a quick health check. If today's number looks wrong, investigate while you can still remember what happened.

**Reconcile cash daily.**  
At end of day, go to Reports, filter for Today, and check the Cash total. Count your physical cash drawer. They should match.

**Use the shareable receipt link for WhatsApp receipts.**  
Instead of printing for every customer, offer the receipt link via WhatsApp. Customers appreciate a digital receipt and it saves paper.

**Keep a regular Excel export as a backup.**  
Once a month, go to Inventory → Export Excel. Save the file somewhere safe (your phone, Google Drive). It is a quick record of your entire product list and current prices.

---

*For technical support, contact your StoreMate provider via WhatsApp or phone. Have your shop name and the phone number registered with StoreMate ready when you call.*
