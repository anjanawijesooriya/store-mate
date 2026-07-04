import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShieldCheck, Database } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin-login");

  return (
    <div className="min-h-screen bg-background">
      {/* Topbar */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-sm px-6 py-3.5 flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#2DA86B] flex items-center justify-center shadow-sm">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">StoreMate</span>
            <span className="text-[11px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 rounded-full px-2 py-0.5 font-bold tracking-wide">
              ADMIN
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1 flex-1">
          <a href="/billing" className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors">
            Billing
          </a>
          <a href="/backup" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors">
            <Database className="h-3 w-3" />
            Backups
          </a>
        </nav>

        <ThemeToggle />
        <AdminLogoutButton />
      </header>

      {/* Content */}
      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
