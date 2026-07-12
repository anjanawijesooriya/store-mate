import { db } from "@/lib/db";
import { SmsType } from "@/lib/generated/prisma/enums";

const SMS_COST_PER_PAGE = 0.59;

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function toSriLankaE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("94")) return digits;
  if (digits.startsWith("0")) return "94" + digits.slice(1);
  return "94" + digits;
}

async function attemptSend(formattedTo: string, message: string, userId: string, apiKey: string, senderId: string): Promise<SmsResult> {
  const res = await fetch("https://smslenz.lk/api/send-sms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      api_key: apiKey,
      sender_id: senderId,
      contact: formattedTo,
      message,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  const data = await res.json();
  console.log("smslenz.lk response:", JSON.stringify(data));
  if (data.status === "success" || data.success === true) {
    return { success: true, messageId: String(data.message_id ?? data.id ?? "") };
  }
  const errMsg = data.message || data.error || data.description || `smslenz error (status: ${data.status ?? res.status})`;
  return { success: false, error: errMsg };
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const userId = process.env.SMSLENZ_USER_ID;
  const apiKey = process.env.SMSLENZ_API_KEY;
  const senderId = process.env.SMSLENZ_SENDER_ID || "eStoreMate";

  if (!userId || !apiKey) {
    console.warn("SMS not configured — SMSLENZ_USER_ID or SMSLENZ_API_KEY missing");
    return { success: false, error: "SMS provider not configured" };
  }

  const formattedTo = toSriLankaE164(to);

  try {
    return await attemptSend(formattedTo, message, userId, apiKey, senderId);
  } catch (firstErr) {
    const isNetworkError = firstErr instanceof TypeError || (firstErr instanceof DOMException && firstErr.name === "TimeoutError");
    if (isNetworkError) {
      // One automatic retry after a short delay for transient network failures
      console.warn("SMS attempt 1 failed (network), retrying in 2s…", firstErr instanceof Error ? firstErr.message : firstErr);
      await new Promise((r) => setTimeout(r, 2000));
      try {
        return await attemptSend(formattedTo, message, userId, apiKey, senderId);
      } catch (retryErr) {
        const detail = retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.error("SMS send error (after retry):", detail);
        return { success: false, error: `Network error: ${detail}` };
      }
    }
    const detail = firstErr instanceof Error ? firstErr.message : String(firstErr);
    console.error("SMS send error:", detail);
    return { success: false, error: `Network error: ${detail}` };
  }
}

export async function sendSmsAndLog(
  shopId: string,
  to: string,
  message: string,
  type: SmsType,
  pages = 1
): Promise<SmsResult> {
  const shop = await db.shop.findUnique({ where: { id: shopId }, select: { smsBalance: true } });
  const balance = Number(shop?.smsBalance ?? 0);
  if (!shop || balance <= 0) {
    return { success: false, error: "Insufficient SMS balance" };
  }

  const result = await sendSms(to, message);

  try {
    await db.smsLog.create({
      data: { shopId, to, type, message, status: result.success ? "sent" : "failed", error: result.error ?? null },
    });
    if (result.success) {
      const cost = SMS_COST_PER_PAGE * pages;
      await db.shop.update({
        where: { id: shopId },
        data: { smsBalance: { decrement: cost } },
      });
    }
  } catch (logErr) {
    console.error("SMS log write failed:", logErr);
  }

  return result;
}

export function buildLowStockMessage(shopName: string, items: { name: string; qty: number }[]): string {
  const list = items.slice(0, 5).map((i) => `• ${i.name} (${i.qty} left)`).join("\n");
  return `eStoreMate Low Stock Alert - ${shopName}\n\n${list}${items.length > 5 ? `\n+${items.length - 5} more` : ""}\n\nVisit app to restock.`;
}

export function buildDailySummaryMessage(shopName: string, salesCount: number, revenue: number): string {
  return `eStoreMate Daily Summary - ${shopName}\n\nToday: ${salesCount} sales, LKR ${revenue.toLocaleString()} revenue.\n\nPowered by Nexora Technologies.`;
}

export function buildReceiptLinkMessage(shopName: string, saleId: string): string {
  const appUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return `Receipt - ${shopName}\n\nView your receipt:\n${appUrl}/r/${saleId}\n\nThank you!`;
}
