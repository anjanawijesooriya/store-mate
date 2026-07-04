# StoreMate — One-Time Payment & Branch Pricing Guide

> Prepared: July 2026  
> Purpose: Internal reference for pricing one-time license deals and multi-branch shop owners

---

## 1. The Risk With Pure Lifetime Deals

Before setting any price, understand that a one-time payment does **not** eliminate your ongoing costs. Even after a shop pays once, you still bear:

- **Hosting costs** — Vercel, Railway, or VPS server fees every month
- **Email sending** — SMTP/Gmail App Password has sending limits; paid SMTP at scale costs money
- **Maintenance time** — bug fixes, browser/OS updates, security patches
- **Support time** — answering shop owner questions, helping with issues

> **SMS is safe** — it is already pay-as-you-go (Rs. 0.59/SMS). The shop tops up their own balance. This does not need to be bundled into a one-time deal.

**Conclusion:** A "lifetime" deal must cover at least **2–3 years of your costs plus profit margin**. Never price below that threshold.

---

## 2. Pricing Framework — How to Calculate

The standard industry formula for one-time (lifetime) software pricing:

```
One-Time Price = Monthly Plan Price × 25
```

This represents roughly **2 years and 1 month** of monthly revenue — the break-even point where a lifetime customer becomes as valuable as a long-term subscriber.

### Reference Table (Adjust to Your Actual Monthly Prices)

| Plan | Devices | Est. Monthly (LKR) | One-Time Price (LKR) |
|---|---|---|---|
| Basic | 1 device | 1,500 | 37,500 |
| Standard | 3 devices | 2,500 | 62,500 |
| Premium | Unlimited devices | 4,000 | 100,000 |

> **Note:** Replace the monthly prices above with your actual plan prices before quoting any customer.

---

## 3. Branch Pricing — Same Owner, Multiple Locations

Each branch is a **separate shop** in the StoreMate system — separate products, sales data, devices, and staff. However, since the same owner controls all branches, a volume discount is fair and expected.

### Recommended Branch Discount Structure

| Number of Branches | Price Per Branch | Discount |
|---|---|---|
| 1 (single shop) | Full one-time price | — |
| 2nd and 3rd branch | 60% of full price | 40% off |
| 4th and 5th branch | 50% of full price | 50% off |
| 6 or more branches | Negotiable | ~60% off |

### Example — 3-Branch Owner on Standard Plan

| Branch | Calculation | Amount (LKR) |
|---|---|---|
| Branch 1 (main) | Full price | 62,500 |
| Branch 2 | 60% of 62,500 | 37,500 |
| Branch 3 | 60% of 62,500 | 37,500 |
| **Total** | | **137,500** |

> **Value comparison:** If this owner paid monthly at LKR 2,500 × 3 shops = LKR 7,500/month, the one-time deal pays back in **18 months**. They save money long-term — this is your selling point.

---

## 4. What the One-Time Price Includes

Be explicit with the customer about what they get:

### Included
- Full access to StoreMate for their plan tier (Basic / Standard / Premium)
- All current features: POS, inventory, sales reports, expenses, customer management, receipts
- Email notifications (low stock, daily summary, receipts)
- Bug fixes and security updates
- **3 years of free hosting and support** (see Section 5)

### Not Included
- SMS balance — topped up separately at Rs. 0.59/SMS
- Setup and onboarding fee (see Section 6)
- Major new feature upgrades after 3 years (optional paid upgrade)

---

## 5. "Lifetime v1" — Protect Yourself With a Time Clause

Do **not** offer a pure unconditional lifetime deal. Instead, offer **"Lifetime v1"**:

> *"Free updates and hosting included for 3 years from the date of purchase. After 3 years, a small annual renewal fee of LKR 6,000–10,000 applies to continue receiving updates and hosting. The software continues to work as-is even without renewal — only new updates are gated."*

### Why This Is Fair to Both Sides

| Benefit | For the Shop Owner | For You |
|---|---|---|
| No monthly commitment | ✅ They pay once and forget | — |
| Predictable cost | ✅ Know exactly what they pay | — |
| Sustainable revenue | — | ✅ Renewal income after year 3 |
| Filters serious buyers | — | ✅ Non-serious buyers drop off |

---

## 6. Setup Fee — Charge Separately

Always charge a **one-time setup and onboarding fee** on top of the license price. This covers:
- Initial installation and configuration
- Adding the shop's products, categories, staff accounts
- Training the owner and cashiers (1–2 hours)
- First-week support calls

### Recommended Setup Fees

| Setup Type | Fee (LKR) |
|---|---|
| Single shop setup + training | 5,000 – 15,000 |
| Each additional branch setup | 3,000 – 7,500 |
| Remote setup (online only) | 3,000 – 5,000 |
| On-site setup (travel included) | 8,000 – 15,000 |

> Setup fees also act as a **filter** — a shop owner willing to pay the setup fee is a serious, committed customer. It reduces time-wasters.

---

## 7. Payment Plans for Branch Owners

A 3-branch owner paying LKR 137,500 upfront may hesitate. Offer a split:

| Option | Structure |
|---|---|
| Full upfront | 100% on day 1 — offer 5% discount as incentive |
| 2-part payment | 60% on day 1, 40% after 30 days |
| 3-part payment | For 5+ branch deals only — 3 equal monthly instalments |

> Never offer more than 3 instalments. The risk of non-payment increases significantly beyond that.

---

## 8. Feature Locking — Lifetime by Tier, Not by Price

Lock the **plan tier** they paid for — not the price. This means:

- A customer who paid for **Basic** (1 device) gets lifetime Basic features
- If they want Standard (3 devices) later, they pay an **upgrade fee** (difference in tier price)
- If you add major new modules in the future (e.g., online ordering, loyalty programme, accounting), those can be offered as **paid add-ons** — even to lifetime customers

This is fair because they are getting exactly what they paid for, and new major features represent new value.

---

## 9. SMS — Keep It Separate Always

SMS is already correctly implemented as a pay-as-you-go top-up system in StoreMate:

- **Cost:** Rs. 0.59 per SMS (tax included, via smslenz.lk)
- **Top-up:** Admin adds LKR balance to each shop manually
- **Usage:** Low stock alerts, daily summaries, receipt links

**Never bundle SMS into any one-time or monthly deal.** SMS volume is unpredictable and directly costs you money per message. Keep it as a pure top-up — the shop owner buys what they use.

---

## 10. Quick Reference — Quoting a Customer

When a shop owner asks for a one-time price, use this checklist:

1. **Which plan do they need?** (how many devices, how many staff)
2. **How many branches?** (apply branch discount table from Section 3)
3. **Calculate license fee** (plan × 25, then apply branch discounts)
4. **Add setup fee** (per branch, on-site or remote)
5. **Confirm SMS is separate** (top-up as needed)
6. **Clarify the 3-year support clause** (renewal after year 3)
7. **Offer payment split if needed** (60/40 for large deals)

### Example Quote — 2-Branch Pharmacy, Standard Plan, On-Site Setup

| Item | Amount (LKR) |
|---|---|
| Branch 1 — Standard license | 62,500 |
| Branch 2 — Standard license (40% off) | 37,500 |
| On-site setup, Branch 1 | 12,000 |
| On-site setup, Branch 2 | 7,500 |
| **Total** | **119,500** |
| SMS balance (separate top-up) | As needed |

---

## 11. Summary

| Decision | Recommendation |
|---|---|
| One-time pricing formula | Monthly price × 25 |
| Branch discount | 40% off 2nd–3rd, 50% off 4th–5th |
| Support commitment | 3 years free, then LKR 6,000–10,000/year renewal |
| Setup fee | LKR 5,000–15,000 per location |
| SMS | Always separate, never bundled |
| Payment plan | 60/40 split for large branch deals |
| Feature upgrades | Major new modules are paid add-ons for all customers |

---

*StoreMate · Internal Business Document · Not for distribution*
