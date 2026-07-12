import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(req: NextRequest) {
  const { secret } = await req.json();
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || !secret || !secureEqual(String(secret), adminSecret)) {
    return Response.json({ error: "Invalid password" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, adminSecret, COOKIE_OPTS);
  return Response.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
