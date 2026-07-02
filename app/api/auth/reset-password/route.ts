import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { phone, otp, newPassword } = await req.json();

    if (!phone || !otp || !newPassword) {
      return Response.json({ error: "All fields are required" }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const phoneClean = String(phone).replace(/\D/g, "");
    const user = await db.user.findUnique({ where: { phone: phoneClean } });
    if (!user) return Response.json({ error: "Invalid or expired OTP" }, { status: 400 });

    const token = await db.passwordResetToken.findFirst({
      where: {
        userId:    user.id,
        otp:       String(otp),
        used:      false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!token) {
      return Response.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash } }),
      db.passwordResetToken.update({ where: { id: token.id }, data: { used: true } }),
      // Revoke all device sessions so old devices must re-login
      db.deviceSession.deleteMany({ where: { shopId: user.shopId } }),
    ]);

    return Response.json({ success: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return Response.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
