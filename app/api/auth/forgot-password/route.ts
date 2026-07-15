import { NextRequest } from "next/server";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { sendPasswordResetOTP } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone) return Response.json({ error: "Phone number required" }, { status: 400 });

    const phoneClean = String(phone).replace(/\D/g, "");
    const user = await db.user.findUnique({ where: { phone: phoneClean } });

    // Always return success to avoid revealing whether a phone/email exists
    if (!user?.email) {
      return Response.json({ success: true });
    }

    // Account-level rate limit: max 3 OTP requests per 15-minute window.
    // Prevents the brute-force cycle of: request new OTP → try 5 guesses → repeat.
    const recentCount = await db.passwordResetToken.count({
      where: {
        userId:    user.id,
        createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    if (recentCount >= 3) {
      return Response.json(
        { error: "Too many reset attempts. Please wait 15 minutes before trying again." },
        { status: 429 }
      );
    }

    // Invalidate any existing unused tokens for this user
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data:  { used: true },
    });

    const otp = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.passwordResetToken.create({
      data: { userId: user.id, otp, expiresAt },
    });

    await sendPasswordResetOTP(user.email, user.name, otp);

    return Response.json({ success: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    return Response.json({ error: "Failed to send OTP" }, { status: 500 });
  }
}
