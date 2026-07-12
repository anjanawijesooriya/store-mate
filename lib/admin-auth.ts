import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { auth } from "@/auth";

export const ADMIN_COOKIE = "admin_auth";

function digitsOnly(phone: string) {
  return phone.replace(/\D/g, "");
}

function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function isAdmin(): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SECRET;

  // Primary: cookie-based check (no shop account required)
  if (adminSecret) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(ADMIN_COOKIE)?.value;
    if (cookieValue && secureEqual(cookieValue, adminSecret)) return true;
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
