"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Menu, LogOut, Bell, Settings,
  Package, Users, CreditCard, MessageSquare, AlertTriangle, CheckCircle, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "@/components/theme-toggle";
import type { NotificationItem } from "@/app/api/notifications/route";

interface TopbarProps {
  userName: string;
  shopName: string;
  onMenuClick: () => void;
}

const TYPE_ICON: Record<NotificationItem["type"], React.ElementType> = {
  low_stock: Package,
  credit:    Users,
  billing:   CreditCard,
  sms:       MessageSquare,
};

const SEVERITY_STYLES: Record<NotificationItem["severity"], { icon: React.ElementType; iconClass: string; dotClass: string; bg: string }> = {
  error:   { icon: AlertTriangle, iconClass: "text-destructive",   dotClass: "bg-destructive",   bg: "bg-destructive/5 border-destructive/20" },
  warning: { icon: AlertTriangle, iconClass: "text-amber-500",     dotClass: "bg-amber-500",     bg: "bg-amber-50/60 border-amber-200/60 dark:bg-amber-500/5 dark:border-amber-500/20" },
  info:    { icon: Info,          iconClass: "text-muted-foreground", dotClass: "bg-primary",    bg: "bg-card border-border" },
};

export function Topbar({ userName, shopName, onMenuClick }: TopbarProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(userName);
  const [displayShopName, setDisplayShopName] = useState(shopName);

  // Sync if props change (e.g. session rehydration after refresh)
  useEffect(() => { setDisplayName(userName); }, [userName]);
  useEffect(() => { setDisplayShopName(shopName); }, [shopName]);

  // Instant update from settings save — no session round-trip flash
  useEffect(() => {
    function handler(e: Event) {
      const { name, shopName: sn } = (e as CustomEvent<{ name: string; shopName: string }>).detail;
      if (name) setDisplayName(name);
      if (sn)   setDisplayShopName(sn);
    }
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, []);

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hasUnseen, setHasUnseen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  function getSeenIds(): Set<string> {
    try {
      const raw = localStorage.getItem("notif-seen-ids");
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  }

  function markAllSeen(items: NotificationItem[]) {
    try {
      localStorage.setItem("notif-seen-ids", JSON.stringify(items.map((n) => n.id)));
    } catch { /* ignore — storage might be blocked */ }
    setHasUnseen(false);
  }

  const fetchNotifications = useCallback(async (markSeen = false) => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data: { notifications: NotificationItem[]; total: number } = await res.json();
      const items: NotificationItem[] = data.notifications ?? [];
      setNotifications(items);
      if (markSeen) {
        markAllSeen(items);
      } else {
        const seen = getSeenIds();
        setHasUnseen(items.some((n) => !seen.has(n.id)));
      }
    } catch { /* ignore */ }
  }, []);

  // Poll every 2 minutes — only checks for unseen, doesn't mark seen
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(() => fetchNotifications(), 120_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  async function handleBellOpen(open: boolean) {
    setNotifOpen(open);
    if (open) {
      setNotifLoading(true);
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data: { notifications: NotificationItem[]; total: number } = await res.json();
          const items: NotificationItem[] = data.notifications ?? [];
          setNotifications(items);
          markAllSeen(items);
        }
      } catch { /* keep existing list */ } finally {
        setNotifLoading(false);
      }
    }
  }

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center px-4 gap-2 sticky top-0 z-10">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden text-muted-foreground hover:text-foreground"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Shop name — left aligned */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate hidden sm:block">{displayShopName}</p>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1">
        <ThemeToggle />

        {/* Notification bell */}
        <DropdownMenu open={notifOpen} onOpenChange={handleBellOpen}>
          <DropdownMenuTrigger render={
            <button
              className="relative h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {hasUnseen && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
              )}
            </button>
          } />
          <DropdownMenuContent align="end" className="w-[360px] p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">Notifications</span>
              {notifications.length > 0 && (
                <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {notifications.length}
                </span>
              )}
            </div>

            {notifLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-2">
                <CheckCircle className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">All clear!</p>
                <p className="text-xs text-muted-foreground/60">No alerts right now.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[420px]">
                <div className="p-2 space-y-1.5">
                  {notifications.map((n) => {
                    const TypeIcon = TYPE_ICON[n.type];
                    const style = SEVERITY_STYLES[n.severity];
                    return (
                      <button
                        key={n.id}
                        onClick={() => { setNotifOpen(false); router.push(n.href); }}
                        className={`w-full text-left rounded-lg border px-3 py-2.5 flex items-start gap-3 transition-colors hover:brightness-95 active:scale-[0.99] ${style.bg}`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          <TypeIcon className={`h-4 w-4 ${style.iconClass}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground leading-snug">{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar menu */}
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <button
              className="h-9 w-9 rounded-full p-0 border-0 bg-transparent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ml-1"
              aria-label="User menu"
            >
              <Avatar className="h-9 w-9 pointer-events-none">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          } />
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5 py-1">
                <p className="text-sm font-semibold text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground">{displayShopName}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
