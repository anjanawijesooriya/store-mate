import { db } from "@/lib/db";
import { getSession, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export type NotificationItem = {
  id: string;
  type: "low_stock" | "credit" | "billing" | "sms";
  severity: "error" | "warning" | "info";
  title: string;
  body: string;
  href: string;
};

export async function GET() {
  try {
    const session = await getSession();
    const shopId = session.user.shopId;

    const [shop, creditCustomers, lowStockRaw] = await Promise.all([
      db.shop.findUnique({
        where: { id: shopId },
        select: {
          billingStatus: true,
          isLifetime: true,
          trialEndsAt: true,
          gracePeriodEndsAt: true,
          smsBalance: true,
          smsAddonEnabled: true,
          smsLowStock: true,
          smsDailySummary: true,
          smsReceiptEnabled: true,
          planTier: true,
        },
      }),
      db.customer.findMany({
        where: { shopId, creditBalance: { gt: 0 } },
        select: { id: true, name: true, creditBalance: true },
        orderBy: { creditBalance: "desc" },
        take: 10,
      }),
      // Compare two columns — requires raw SQL
      db.$queryRaw<Array<{ id: string; name: string; stockQty: number; lowStockAt: number }>>`
        SELECT id, name, "stockQty"::float AS "stockQty", "lowStockAt"::float AS "lowStockAt"
        FROM "Product"
        WHERE "shopId" = ${shopId}
          AND "isActive" = true
          AND "stockQty" <= "lowStockAt"
        ORDER BY "stockQty" ASC
        LIMIT 10
      `,
    ]);

    if (!shop) return apiError("Shop not found", 404);

    const notifications: NotificationItem[] = [];
    const now = new Date();

    // ── Billing alerts (skipped for lifetime shops) ─────────────
    if (shop.isLifetime) {
      // no billing notifications ever
    } else if (shop.billingStatus === "LOCKED") {
      notifications.push({
        id: "billing-locked",
        type: "billing",
        severity: "error",
        title: "Account locked",
        body: "New sales are disabled. Contact us via WhatsApp to restore access.",
        href: "/settings",
      });
    } else if (shop.billingStatus === "GRACE") {
      const endsAt = shop.gracePeriodEndsAt;
      const daysLeft = endsAt
        ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000))
        : 0;
      notifications.push({
        id: "billing-grace",
        type: "billing",
        severity: "warning",
        title: "Payment overdue",
        body: endsAt
          ? `Grace period ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Please settle your subscription to avoid account lock.`
          : "Please settle your subscription payment to avoid account lock.",
        href: "/settings",
      });
    } else if (shop.billingStatus === "TRIAL" && shop.trialEndsAt) {
      const daysLeft = Math.ceil((shop.trialEndsAt.getTime() - now.getTime()) / 86_400_000);
      if (daysLeft <= 7) {
        notifications.push({
          id: "billing-trial",
          type: "billing",
          severity: daysLeft <= 2 ? "error" : "warning",
          title: daysLeft <= 0 ? "Trial expired" : `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
          body: "Upgrade your plan in Settings to keep access to all features.",
          href: "/settings",
        });
      }
    }

    // ── SMS balance ──────────────────────────────────────────────
    const smsEnabled = shop.smsAddonEnabled && (shop.smsLowStock || shop.smsDailySummary || shop.smsReceiptEnabled);
    if (smsEnabled) {
      const smsBalance = Number(shop.smsBalance);
      if (smsBalance <= 0) {
        notifications.push({
          id: "sms-empty",
          type: "sms",
          severity: "warning",
          title: "No SMS balance",
          body: "SMS notifications are paused. Ask admin to top up your balance.",
          href: "/settings",
        });
      } else if (smsBalance < 3) {
        notifications.push({
          id: "sms-low",
          type: "sms",
          severity: "info",
          title: `Rs. ${smsBalance.toFixed(2)} SMS balance remaining`,
          body: "Running low (less than 5 SMS). Ask admin to top up before it runs out.",
          href: "/settings",
        });
      }
    }

    // ── Low stock products ────────────────────────────────────────
    for (const p of lowStockRaw) {
      notifications.push({
        id: `low-stock-${p.id}`,
        type: "low_stock",
        severity: p.stockQty === 0 ? "error" : "warning",
        title: p.stockQty === 0 ? `${p.name} — out of stock` : `${p.name} — low stock`,
        body: p.stockQty === 0
          ? "This product has no stock remaining."
          : `Only ${p.stockQty} ${p.stockQty === 1 ? "unit" : "units"} left (threshold: ${p.lowStockAt}).`,
        href: "/inventory",
      });
    }

    // ── Credit customers ─────────────────────────────────────────
    for (const c of creditCustomers) {
      const balance = Number(c.creditBalance);
      notifications.push({
        id: `credit-${c.id}`,
        type: "credit",
        severity: "info",
        title: `${c.name} — outstanding credit`,
        body: `LKR ${balance.toLocaleString("en-LK", { maximumFractionDigits: 0 })} unpaid balance.`,
        href: "/customers",
      });
    }

    return Response.json(
      { notifications, total: notifications.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to load notifications", 500);
  }
}
