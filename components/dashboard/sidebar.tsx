"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  Receipt,
  Settings,
  X,
  ShieldCheck,
  ClipboardList,
  Zap,
  Lock,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PRIMARY_ONLY = ["/dashboard", "/reports", "/expenses", "/payroll"];

const ALWAYS_VISIBLE = [
  { href: "/pos",       label: "Point of Sale",  icon: ShoppingCart },
  { href: "/sales",     label: "Sales History",  icon: ClipboardList},
  { href: "/inventory", label: "Inventory",      icon: Package      },
  { href: "/reports",   label: "Reports",        icon: BarChart3    },
  { href: "/settings",  label: "Settings",       icon: Settings     },
];

const PLAN_GATED = [
  { href: "/customers", label: "Customers", icon: Users    },
  { href: "/expenses",  label: "Expenses",  icon: Receipt  },
];

interface SidebarProps {
  shopName: string;
  planTier?: string;
  isAdmin?: boolean;
  isNonPrimary?: boolean;
  onClose?: () => void;
}

export function Sidebar({ shopName, planTier, isAdmin, isNonPrimary, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const [payrollEnabled, setPayrollEnabled] = useState(false);
  const isBasic = !planTier || planTier === "BASIC";

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const up   = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener("online",  up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online",  up);
      window.removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => {
    function checkFeatures() {
      fetch("/api/shop/features")
        .then((r) => r.ok ? r.json() : { payrollEnabled: false })
        .then((d) => setPayrollEnabled(d.payrollEnabled ?? false))
        .catch(() => {});
    }

    checkFeatures();

    const onVisible = () => { if (document.visibilityState === "visible") checkFeatures(); };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(checkFeatures, 30_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, []);

  return (
    <aside className="flex flex-col h-full bg-sidebar text-sidebar-foreground overflow-hidden">
      {/* Logo / shop name */}
      <div className="flex items-start justify-between pb-2 border-b border-sidebar-border">
        <Link
          href={isNonPrimary ? "/pos" : "/dashboard"}
          onClick={onClose}
          className="flex flex-col min-w-0 flex-1 px-2 hover:opacity-80 transition-opacity"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/eStoreMate.png"
            alt="eStoreMate"
            style={{
              width: "100%",
              maxWidth: 175,
              height: "auto",
              display: "block",
              filter: "drop-shadow(0 0 8px rgba(255,255,255,0.5))",
            }}
          />
          <p className="-mt-6 ml-4 text-sm font-semibold text-sidebar-foreground truncate leading-tight">{shopName}</p>
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent -mr-2 h-8 w-8 mt-1 shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {/* Always visible */}
        {ALWAYS_VISIBLE.map(({ href, label, icon: Icon }) => {
          const restricted = isNonPrimary && PRIMARY_ONLY.includes(href);
          if (restricted) {
            return (
              <div
                key={href}
                title="Primary device only"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/25 cursor-not-allowed select-none"
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                {label}
                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-500/70">
                  <Lock className="h-3 w-3" /> Primary
                </span>
              </div>
            );
          }
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px] flex-shrink-0", active ? "text-primary" : "")} />
              {label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}

        {/* Plan-gated items */}
        {PLAN_GATED.map((item) => {
          if (isNonPrimary && PRIMARY_ONLY.includes(item.href)) {
            return (
              <div
                key={item.href}
                title="Primary device only"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/25 cursor-not-allowed select-none"
              >
                <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                {item.label}
                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-500/70">
                  <Lock className="h-3 w-3" /> Primary
                </span>
              </div>
            );
          }
          if (isBasic) {
            return (
              <div
                key={item.href}
                title="Upgrade to Standard to unlock"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/25 cursor-not-allowed select-none"
              >
                <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                {item.label}
                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-500/70">
                  <Lock className="h-3 w-3" /> Standard+
                </span>
              </div>
            );
          }
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px] flex-shrink-0", active ? "text-primary" : "")} />
              {item.label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}

        {/* Payroll — admin-enabled add-on */}
        {payrollEnabled && (
          isNonPrimary ? (
            <div
              title="Primary device only"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/25 cursor-not-allowed select-none"
            >
              <Briefcase className="h-[18px] w-[18px] flex-shrink-0" />
              Payroll
              <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-500/70">
                <Lock className="h-3 w-3" /> Primary
              </span>
            </div>
          ) : (
            <Link
              href="/payroll"
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                pathname === "/payroll" || pathname.startsWith("/payroll/")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
              )}
            >
              <Briefcase className={cn("h-[18px] w-[18px] flex-shrink-0", pathname === "/payroll" || pathname.startsWith("/payroll/") ? "text-primary" : "")} />
              Payroll
              {(pathname === "/payroll" || pathname.startsWith("/payroll/")) && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
            </Link>
          )
        )}
      </nav>

      {/* Admin link */}
      {isAdmin && (
        <div className="px-3 pb-2">
          <Link
            href="/billing"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              pathname.startsWith("/billing")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/40 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
            )}
          >
            <ShieldCheck className="h-4 w-4 flex-shrink-0" />
            Admin Billing
          </Link>
        </div>
      )}

      {/* Bottom strip */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1">
            <Zap className="h-3 w-3 text-primary/60" />
            <p className="text-[10px] text-sidebar-foreground/30 font-medium">eStoreMate v1.0</p>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isOnline ? "bg-[color:var(--brand-success)] animate-pulse" : "bg-destructive"}`} />
            <span className="text-[10px] text-sidebar-foreground/30">{isOnline ? "Online" : "Offline"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
