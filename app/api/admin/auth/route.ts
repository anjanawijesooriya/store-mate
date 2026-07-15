import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual, createHmac, randomUUID } from "crypto";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

// 24-hour sessions — short window limits stolen-cookie exposure
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24,
};

function secureEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Cookie = "<uuid>.<hmac-sha256(uuid, ADMIN_SECRET)>"
// The cookie value is opaque — possessing it does not reveal the secret.
function makeSessionToken(secret: string): string {
  const id = randomUUID();
  const mac = createHmac("sha256", secret).update(id).digest("hex");
  return `${id}.${mac}`;
}

export async function POST(req: NextRequest) {
  const { secret } = await req.json();
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || !secret || !secureEqual(String(secret), adminSecret)) {
    return Response.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = makeSessionToken(adminSecret);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, token, COOKIE_OPTS);
  return Response.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
