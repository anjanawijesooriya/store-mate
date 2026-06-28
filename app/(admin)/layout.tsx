import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin-login");
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-3 flex items-center gap-3">
        <span className="text-sm font-bold text-primary">StoreMate Admin</span>
        <span className="text-xs text-muted-foreground flex-1">Internal billing console</span>
        <AdminLogoutButton />
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
