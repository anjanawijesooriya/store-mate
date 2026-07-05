"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { BillingBanner } from "@/components/dashboard/billing-banner";
import { MaintenanceBanner } from "@/components/dashboard/maintenance-banner";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { PwaRegister } from "@/components/shared/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "next-auth/react";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isNonPrimary, setIsNonPrimary] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    const checkAccess = () => {
      fetch("/api/shop/device-access")
        .then((r) => r.ok ? r.json() : { branchModeEnabled: false, isPrimary: true })
        .then(({ branchModeEnabled, isPrimary }) => {
          setIsNonPrimary(branchModeEnabled && !isPrimary);
        })
        .catch(() => {});
    };

    checkAccess();

    // Re-check when this device just set itself as primary
    window.addEventListener("branch-access-changed", checkAccess);
    // Poll every 60s to catch remote changes (admin or another device changing primary)
    const interval = setInterval(checkAccess, 60_000);

    return () => {
      window.removeEventListener("branch-access-changed", checkAccess);
      clearInterval(interval);
    };
  }, [status]);

  // Global interceptor: sign out immediately if any API returns device_revoked
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 401) {
        try {
          const clone = res.clone();
          const data = await clone.json();
          if (data?.reason === "device_revoked") {
            signOut({ callbackUrl: "/login?reason=device_revoked" });
          }
        } catch { /* ignore */ }
      }
      return res;
    };
    return () => { window.fetch = original; };
  }, []);

  // Only block on initial load — not on session refreshes (e.g. updateSession calls)
  if (!session && status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/login");
  }

  const shopName  = session?.user?.shopName ?? "My Shop";
  const userName  = session?.user?.name ?? "User";
  const planTier  = session?.user?.planTier;
  const adminPhone = process.env.NEXT_PUBLIC_ADMIN_PHONE;
  const isAdmin = !!adminPhone && !!session?.user?.phone &&
    session.user.phone.replace(/\D/g, "") === adminPhone.replace(/\D/g, "");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on desktop, slide-over on mobile */}
      <div
        className={`
          fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 lg:z-auto
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Sidebar
          shopName={shopName}
          planTier={planTier}
          isAdmin={isAdmin}
          isNonPrimary={isNonPrimary}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          userName={userName}
          shopName={shopName}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <MaintenanceBanner />
        <BillingBanner />
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>

      <Toaster richColors position="top-right" />
      <PwaRegister />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DashboardContent>{children}</DashboardContent>
    </SessionProvider>
  );
}
