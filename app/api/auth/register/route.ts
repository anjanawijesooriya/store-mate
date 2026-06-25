import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ShopCategory } from "@/lib/generated/prisma/enums";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopName, ownerName, phone, password, category, address } = body;

    if (!shopName || !ownerName || !phone || !password || !category) {
      return Response.json({ error: "All required fields must be filled" }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const phoneClean = phone.replace(/\D/g, "");
    if (phoneClean.length < 9) {
      return Response.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { phone: phoneClean } });
    if (existing) {
      return Response.json({ error: "This phone number is already registered" }, { status: 409 });
    }

    const validCategories = Object.values(ShopCategory);
    if (!validCategories.includes(category as ShopCategory)) {
      return Response.json({ error: "Invalid shop category" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const shop = await db.shop.create({
      data: {
        name: shopName,
        ownerName,
        phone: phoneClean,
        category: category as ShopCategory,
        address: address || null,
        trialEndsAt,
        users: {
          create: {
            name: ownerName,
            phone: phoneClean,
            passwordHash,
            role: "OWNER",
          },
        },
      },
      include: { users: true },
    });

    return Response.json({
      success: true,
      shopId: shop.id,
      message: "Shop registered successfully. Please log in.",
    });
  } catch (err) {
    console.error("Register error:", err);
    return Response.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
