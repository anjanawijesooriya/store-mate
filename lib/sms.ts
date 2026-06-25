import { db } from "@/lib/db";
import { SmsType } from "@/lib/generated/prisma/enums";

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const userId = process.env.NOTIFYLK_USER_ID;
  const apiKey = process.env.NOTIFYLK_API_KEY;
  const senderId = process.env.NOTIFYLK_SENDER_ID || "StoreMate";

  if (!userId || !apiKey) {
    console.warn("SMS not configured — NOTIFYLK_USER_ID or NOTIFYLK_API_KEY missing");
    return { success: false, error: "SMS provider not configured" };
  }

  try {
    const res = await fetch("https://app.notify.lk/api/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        api_key: apiKey,
        sender_id: senderId,
        to: to.replace(/\D/g, ""),
        message,
      }),
    });
    const data = await res.json();
    if (data.status === "success") return { success: true, messageId: data.data };
    return { success: false, error: data.message || "SMS send failed" };
  } catch (err) {
    console.error("SMS send error:", err);
    return { success: false, error: "Network error sending SMS" };
  }
}

export async function sendSmsAndLog(
  shopId: string,
  to: string,
  message: string,
  type: SmsType
): Promise<SmsResult> {
  const result = await sendSms(to, message);

  try {
    await db.smsLog.create({
      data: { shopId, to, type, message, status: result.success ? "sent" : "failed", error: result.error ?? null },
    });
    if (result.success) {
      await db.shop.update({ where: { id: shopId }, data: { smsMonthlyUsage: { increment: 1 } } });
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
