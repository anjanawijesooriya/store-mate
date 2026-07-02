import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSession, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return apiError("All fields are required");
    }
    if (newPassword.length < 8) {
      return apiError("New password must be at least 8 characters");
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user) return apiError("User not found", 404);

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return apiError("Current password is incorrect", 400);

    if (currentPassword === newPassword) {
      return apiError("New password must be different from current password", 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.user.update({ where: { id: user.id }, data: { passwordHash } });

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    console.error("Change password error:", err);
    return apiError("Failed to change password", 500);
  }
}
