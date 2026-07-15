import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      phone: string;
      shopId: string;
      shopName: string;
      role: string;
      deviceId: string;
      planTier: string;
    };
  }
  interface User {
    id: string;
    name: string;
    phone: string;
    shopId: string;
    shopName: string;
    role: string;
    deviceId: string;
    planTier: string;
  }
}

const DEVICE_LIMITS: Record<string, number> = {
  BASIC:    1,
  STANDARD: 3,
  PREMIUM:  Infinity,
};

function parseDeviceName(ua: string): string {
  if (!ua) return "Unknown device";
  const os =
    ua.includes("Windows") ? "Windows" :
    ua.includes("Mac")     ? "macOS"   :
    ua.includes("Android") ? "Android" :
    ua.includes("iPhone") || ua.includes("iPad") ? "iOS" :
    ua.includes("Linux")   ? "Linux"   : "Unknown OS";
  const browser =
    ua.includes("Edg/")     ? "Edge"    :
    ua.includes("OPR/")     ? "Opera"   :
    ua.includes("Chrome/")  ? "Chrome"  :
    ua.includes("Firefox/") ? "Firefox" :
    ua.includes("Safari/")  ? "Safari"  : "Browser";
  return `${browser} on ${os}`;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        phone:       { label: "Phone",        type: "text"     },
        password:    { label: "Password",     type: "password" },
        deviceId:    { label: "Device ID",    type: "text"     },
        userAgent:   { label: "UA",           type: "text"     },
        forceDevice: { label: "Force Device", type: "text"     },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) return null;

        const deviceId   = (credentials.deviceId   as string | undefined)?.trim();
        const userAgent  = (credentials.userAgent   as string | undefined) ?? "";
        const forceDevice = (credentials.forceDevice as string | undefined) === "true";

        if (!deviceId) return null;

        const user = await db.user.findUnique({
          where: { phone: credentials.phone as string },
          include: {
            shop: {
              select: {
                id: true, name: true, planTier: true, billingStatus: true,
              },
            },
          },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        // Reject login for shops whose billing has been locked by admin
        if (user.shop.billingStatus === "LOCKED") return null;

        const shopId   = user.shopId;
        const planTier = user.shop.planTier as string;
        const limit    = DEVICE_LIMITS[planTier] ?? 1;

        const existing = await db.deviceSession.findUnique({
          where: { shopId_deviceId: { shopId, deviceId } },
        });

        if (existing) {
          // Known device — just refresh lastSeenAt
          await db.deviceSession.update({
            where: { shopId_deviceId: { shopId, deviceId } },
            data:  { lastSeenAt: new Date(), userId: user.id },
          });
        } else {
          // New device — enforce plan limit
          const count = await db.deviceSession.count({ where: { shopId } });
          if (count >= limit) {
            if (!forceDevice) return null;
            // Displace the oldest device session to make room
            const oldest = await db.deviceSession.findFirst({
              where:   { shopId },
              orderBy: { lastSeenAt: "asc" },
            });
            if (oldest) {
              await db.deviceSession.delete({ where: { id: oldest.id } });
            }
          }
          await db.deviceSession.create({
            data: {
              shopId,
              userId:     user.id,
              deviceId,
              deviceName: parseDeviceName(userAgent),
            },
          });
        }

        return {
          id:        user.id,
          name:      user.name,
          phone:     user.phone,
          shopId:    user.shopId,
          shopName:  user.shop.name,
          role:      user.role,
          deviceId,
          planTier:  user.shop.planTier as string,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id             = user.id;
        token.name           = user.name;
        token.phone          = user.phone;
        token.shopId         = user.shopId;
        token.shopName       = user.shopName;
        token.role           = user.role;
        token.deviceId       = user.deviceId;
        token.planTier       = user.planTier;
        token.planTierSyncAt = Date.now();
      }
      // Called when useSession().update() is triggered from the client
      if (trigger === "update" && session) {
        if (session.name)     token.name     = session.name;
        if (session.shopName) token.shopName = session.shopName;
      }
      // Re-read planTier from DB if the cached value is older than 2 minutes.
      // This ensures plan upgrades/downgrades by admin propagate without re-login.
      const syncAt = (token.planTierSyncAt as number | undefined) ?? 0;
      if (!user && token.shopId && Date.now() - syncAt > 2 * 60 * 1000) {
        const shop = await db.shop.findUnique({
          where:  { id: token.shopId as string },
          select: { planTier: true },
        });
        if (shop) token.planTier = shop.planTier;
        token.planTierSyncAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id       = token.id       as string;
      session.user.name     = token.name     as string;
      session.user.phone    = token.phone    as string;
      session.user.shopId   = token.shopId   as string;
      session.user.shopName = token.shopName as string;
      session.user.role     = token.role     as string;
      session.user.deviceId = token.deviceId as string;
      session.user.planTier = token.planTier as string;
      return session;
    },
  },
  session: { strategy: "jwt" },
});
