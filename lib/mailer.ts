import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"StoreMate" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`;

export async function sendPasswordResetOTP(to: string, name: string, otp: string) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: "StoreMate — Password Reset OTP",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <div style="margin-bottom:24px">
          <span style="font-size:22px;font-weight:700;color:#2DA86B">StoreMate</span>
        </div>
        <h2 style="font-size:18px;font-weight:600;color:#111827;margin:0 0 8px">Password Reset</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px">Hi ${name}, use the code below to reset your password. It expires in 15 minutes.</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#111827;font-family:monospace">${otp}</span>
        </div>
        <p style="color:#9ca3af;font-size:12px;margin:0">If you did not request a password reset, you can safely ignore this email. Your password will not be changed.</p>
      </div>
    `,
  });
}
