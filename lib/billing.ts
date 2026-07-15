import { BillingStatus } from "./generated/prisma/enums";

export function isLocked(status: BillingStatus): boolean {
  return status === BillingStatus.LOCKED;
}

export function billingStatusLabel(status: BillingStatus): string {
  const labels: Record<BillingStatus, string> = {
    TRIAL: "Free Trial",
    ACTIVE: "Active",
    GRACE: "Grace Period",
    LOCKED: "Locked",
  };
  return labels[status] ?? status;
}

export function billingStatusVariant(
  status: BillingStatus
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACTIVE") return "default";
  if (status === "LOCKED") return "destructive";
  if (status === "GRACE") return "outline";
  return "secondary"; // TRIAL
}

export function trialDaysLeft(trialEndsAt: Date | null): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
}
