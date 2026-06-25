import { auth } from "@/auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function getShopId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.shopId) throw new UnauthorizedError();
  return session.user.shopId;
}

export async function getSession() {
  const session = await auth();
  if (!session?.user?.shopId) throw new UnauthorizedError();
  return session;
}

export function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function apiUnauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
