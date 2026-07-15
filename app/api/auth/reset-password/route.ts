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

    // Find an active (not used, not expired, not locked) token for this user
    const token = await db.passwordResetToken.findFirst({
      where: {
        userId:   user.id,
        used:     false,
        expiresAt: { gt: new Date() },
        attempts: { lt: 5 },
      },
    });

    if (!token) {
      return Response.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    // Verify the OTP — increment attempts first so a crash after this point
    // still counts the attempt (prevents retry-on-timeout bypass)
    const updated = await db.passwordResetToken.update({
      where: { id: token.id },
      data:  { attempts: { increment: 1 } },
      select: { attempts: true },
    });

    if (token.otp !== String(otp)) {
      if (updated.attempts >= 5) {
        // Lock the token so it can't be retried even if not yet expired
        await db.passwordResetToken.update({ where: { id: token.id }, data: { used: true } });
        return Response.json({ error: "Too many incorrect attempts. Request a new OTP." }, { status: 400 });
      }
      return Response.json({ error: "Invalid or expired OTP" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash } }),
      db.passwordResetToken.update({ where: { id: token.id }, data: { used: true } }),
      // Revoke only this user's device sessions — other cashiers in the shop stay logged in
      db.deviceSession.deleteMany({ where: { userId: user.id } }),
    ]);

    return Response.json({ success: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return Response.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
