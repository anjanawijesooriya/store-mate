import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ShopCategory } from "@/lib/generated/prisma/enums";

const registrationAttempts = new Map<string, { count: number; resetAt: number }>();
const RL_WINDOW = 15 * 60 * 1000;
const RL_MAX = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = registrationAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    registrationAttempts.set(ip, { count: 1, resetAt: now + RL_WINDOW });
    return true;
  }
  if (entry.count >= RL_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkRateLimit(ip)) {
      return Response.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const { shopName, ownerName, phone, email, password, category, address } = body;

    if (!shopName || !ownerName || !phone || !email || !password || !category) {
      return Response.json({ error: "All required fields must be filled" }, { status: 400 });
    }

    const emailClean = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      return Response.json({ error: "Invalid email address" }, { status: 400 });
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
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const shop = await db.shop.create({
      data: {
        name: shopName,
        ownerName,
        phone: phoneClean,
        category: category as ShopCategory,
        address: address || null,
        trialEndsAt,
        variantsEnabled: category === ShopCategory.CLOTHING,
        weightedProductsEnabled: category === ShopCategory.GROCERY || category === ShopCategory.SUPERMARKET,
        users: {
          create: {
            name: ownerName,
            phone: phoneClean,
            email: emailClean,
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
