import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config — no database imports here.
// Used by middleware which runs on the Edge Runtime.
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const isAuthRoute =
        pathname.startsWith("/login") || pathname.startsWith("/register");
      const isApiAuthRoute = pathname.startsWith("/api/auth");
      const isPublicRoute = isAuthRoute || isApiAuthRoute || pathname === "/";

      if (isApiAuthRoute) return true;
      if (!isLoggedIn && !isPublicRoute) return false; // redirect to /login
      if (isLoggedIn && isAuthRoute) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
  },
};
