import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { auth } from "@/auth";

export const ADMIN_COOKIE = "admin_auth";

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

// Verifies a session token of the form "<uuid>.<hmac-sha256(uuid, secret)>".
// Constant-time comparison on the HMAC portion prevents timing attacks.
function verifySessionToken(token: string, secret: string): boolean {
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const id = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(id).digest("hex");
  if (expected.length !== mac.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(mac));
}

export async function isAdmin(): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SECRET;

  // Primary: signed session-token cookie (value is NOT the raw secret)
  if (adminSecret) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(ADMIN_COOKIE)?.value;
    if (cookieValue && verifySessionToken(cookieValue, adminSecret)) return true;
  }

  // Fallback: phone-based check (for shop owners who are also the admin)
  const adminPhone = process.env.ADMIN_PHONE;
  if (adminPhone) {
    const session = await auth();
    if (session?.user?.phone) {
      return digitsOnly(session.user.phone) === digitsOnly(adminPhone);
    }
  }

  return false;
}
