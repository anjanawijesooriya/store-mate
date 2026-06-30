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
  Store,
  X,
  ShieldCheck,
  ClipboardList,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/pos", label: "Point of Sale", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/sales", label: "Sales History", icon: ClipboardList },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  shopName: string;
  isAdmin?: boolean;
  onClose?: () => void;
}

export function Sidebar({ shopName, isAdmin, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return (
    <aside className="flex flex-col h-full bg-sidebar text-sidebar-foreground overflow-hidden">
      {/* Logo / shop name */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Store className="h-[18px] w-[18px] text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-widest">StoreMate</p>
            <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">{shopName}</p>
          </div>
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent -mr-2 h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
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
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
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
            <p className="text-[10px] text-sidebar-foreground/30 font-medium">StoreMate v1.0</p>
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
