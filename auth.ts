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
    };
  }
  interface User {
    id: string;
    name: string;
    phone: string;
    shopId: string;
    shopName: string;
    role: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { phone: credentials.phone as string },
          include: { shop: { select: { id: true, name: true } } },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          shopId: user.shopId,
          shopName: user.shop.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.phone = user.phone;
        token.shopId = user.shopId;
        token.shopName = user.shopName;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.phone = token.phone as string;
      session.user.shopId = token.shopId as string;
      session.user.shopName = token.shopName as string;
      session.user.role = token.role as string;
      return session;
    },
  },
  session: { strategy: "jwt" },
});
