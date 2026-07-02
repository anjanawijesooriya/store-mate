import { db } from "@/lib/db";
import { SmsType } from "@/lib/generated/prisma/enums";

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function toSriLankaE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("94")) return digits;        // already 94XXXXXXXXX
  if (digits.startsWith("0")) return "94" + digits.slice(1); // 07X → 94 7X
  return "94" + digits;                               // bare 7X → 94 7X
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const userId = process.env.NOTIFYLK_USER_ID;
  const apiKey = process.env.NOTIFYLK_API_KEY;
  const senderId = process.env.NOTIFYLK_SENDER_ID || "NotifyDEMO";

  if (!userId || !apiKey) {
    console.warn("SMS not configured — NOTIFYLK_USER_ID or NOTIFYLK_API_KEY missing");
    return { success: false, error: "SMS provider not configured" };
  }

  const formattedTo = toSriLankaE164(to);

  try {
    const res = await fetch("https://app.notify.lk/api/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        api_key: apiKey,
        sender_id: senderId,
        to: formattedTo,
        message,
      }),
    });
    const data = await res.json();
    console.log("notify.lk response:", JSON.stringify(data));
    if (data.status === "success") return { success: true, messageId: data.data };
    const errMsg = data.message || data.error || data.description || `notify.lk error (status: ${data.status ?? res.status})`;
    return { success: false, error: errMsg };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("SMS send error:", detail);
    return { success: false, error: `Network error: ${detail}` };
  }
}

export async function sendSmsAndLog(
  shopId: string,
  to: string,
  message: string,
  type: SmsType
): Promise<SmsResult> {
  // Check credits before sending
  const shop = await db.shop.findUnique({ where: { id: shopId }, select: { smsCredits: true } });
  if (!shop || shop.smsCredits <= 0) {
    return { success: false, error: "No SMS credits remaining" };
  }

  const result = await sendSms(to, message);

  try {
    await db.smsLog.create({
      data: { shopId, to, type, message, status: result.success ? "sent" : "failed", error: result.error ?? null },
    });
    if (result.success) {
      await db.shop.update({ where: { id: shopId }, data: { smsCredits: { decrement: 1 } } });
    }
  } catch (logErr) {
    console.error("SMS log write failed:", logErr);
  }

  return result;
}

export function buildLowStockMessage(shopName: string, items: { name: string; qty: number }[]): string {
  const list = items.slice(0, 5).map((i) => `• ${i.name} (${i.qty} left)`).join("\n");
  return `StoreMate Low Stock Alert - ${shopName}\n\n${list}${items.length > 5 ? `\n+${items.length - 5} more` : ""}\n\nVisit app to restock.`;
}

export function buildDailySummaryMessage(shopName: string, salesCount: number, revenue: number): string {
  return `StoreMate Daily Summary - ${shopName}\n\nToday: ${salesCount} sales, LKR ${revenue.toLocaleString()} revenue.\n\nPowered by StoreMate.`;
}

export function buildReceiptMessage(shopName: string, total: number, items: { name: string; qty: number }[]): string {
  const preview = items.slice(0, 3).map((i) => `${i.name} x${i.qty}`).join(", ");
  const more = items.length > 3 ? ` +${items.length - 3} more` : "";
  return `Receipt from ${shopName}\n\n${preview}${more}\n\nTotal: LKR ${total.toLocaleString()}\n\nThank you!`;
}
