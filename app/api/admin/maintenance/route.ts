import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";
import { sendMaintenanceBulkEmails } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return apiError("Forbidden", 403);

  const { enabled, message } = await req.json();

  await db.shop.updateMany({
    data: {
      maintenanceBanner: !!enabled,
      maintenanceBannerMessage: enabled ? (message?.trim() || null) : null,
    },
  });

  const count = await db.shop.count();

  if (enabled) {
    // Collect all shops with an owner email
    const shops = await db.shop.findMany({
      select: {
        name: true,
        ownerName: true,
        users: {
          where: { role: "OWNER" },
          select: { email: true, name: true },
          take: 1,
        },
      },
    });

    const recipients = shops
      .map((s) => ({
        email: s.users[0]?.email ?? null,
        ownerName: s.users[0]?.name ?? s.ownerName,
        shopName: s.name,
      }))
      .filter((r): r is { email: string; ownerName: string; shopName: string } =>
        !!r.email
      );

    if (recipients.length > 0) {
      sendMaintenanceBulkEmails(recipients, message).catch(() => {});
    }
  }

  return Response.json({ success: true, count });
}
