"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Lock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BillingInfo {
  billingStatus: "TRIAL" | "ACTIVE" | "GRACE" | "LOCKED";
  isLifetime: boolean;
  trialEndsAt: string | null;
  gracePeriodEndsAt: string | null;
}

function daysLeft(d: string | null) {
  if (!d) return null;
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((end.getTime() - today.getTime()) / 86_400_000));
}

export function BillingBanner() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const fetchBilling = () =>
      fetch("/api/billing")
        .then((r) => r.json())
        .then((d) => setBilling(d.billing))
        .catch(() => {});

    fetchBilling();
    // Poll every 5 minutes to catch grace/trial expiry while user is logged in
    const interval = setInterval(fetchBilling, 5 * 60 * 1000);
    // Also re-check when the tab regains focus (user returns after time away)
    window.addEventListener("focus", fetchBilling);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", fetchBilling);
    };
  }, []);

  if (!billing || billing.isLifetime || pathname === "/settings") return null;

  const { billingStatus, trialEndsAt, gracePeriodEndsAt } = billing;

  if (billingStatus === "ACTIVE") return null;

  if (billingStatus === "TRIAL") {
    const dl = daysLeft(trialEndsAt);
    if (dl === null || dl > 7) return null;
    return (
      <div className="flex items-center gap-3 border-b border-[color:var(--brand-warning)]/30 bg-[color:var(--brand-warning)]/10 px-4 py-2.5">
        <Clock className="h-4 w-4 text-[color:var(--brand-warning)] flex-shrink-0" />
        <p className="text-sm font-medium text-[color:var(--brand-warning)] flex-1">
          {dl > 0
            ? `Your free trial ends in ${dl} day${dl !== 1 ? "s" : ""}. Contact us to continue.`
            : "Your free trial has ended."}
        </p>
        <Link href="/settings">
          <Button size="sm" variant="outline" className="text-xs h-7">View Plan</Button>
        </Link>
      </div>
    );
  }

  if (billingStatus === "GRACE") {
    const dl = daysLeft(gracePeriodEndsAt);
    return (
      <div className="flex items-center gap-3 border-b border-[color:var(--brand-warning)]/40 bg-[color:var(--brand-warning)]/15 px-4 py-2.5">
        <AlertTriangle className="h-4 w-4 text-[color:var(--brand-warning)] flex-shrink-0" />
        <p className="text-sm font-medium text-[color:var(--brand-warning)] flex-1">
          Payment overdue.{" "}
          {dl !== null && dl > 0
            ? `Your account will be locked in ${dl} day${dl !== 1 ? "s" : ""}.`
            : "Account will be locked soon."}
          {" "}Please contact us to pay.
        </p>
        <Link href="/settings">
          <Button size="sm" variant="outline" className="text-xs h-7">Billing</Button>
        </Link>
      </div>
    );
  }

  if (billingStatus === "LOCKED") {
    return (
      <div className="flex items-center gap-3 border-b border-red-300 bg-red-50 px-4 py-2.5">
        <Lock className="h-4 w-4 text-red-600 flex-shrink-0" />
        <p className="text-sm font-medium text-red-700 flex-1">
          Your account is locked due to non-payment. New sales are disabled. Contact us to restore access.
        </p>
      </div>
    );
  }

  return null;
}
