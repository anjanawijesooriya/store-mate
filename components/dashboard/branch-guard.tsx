"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export function BranchGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    fetch("/api/shop/device-access")
      .then((r) => r.ok ? r.json() : { deviceLockEnabled: false, isPrimary: true })
      .then(({ deviceLockEnabled, isPrimary }) => {
        if (deviceLockEnabled && !isPrimary) {
          setAllowed(false);
          toast.error("This section is only accessible from the primary device.", { id: "device-lock-guard" });
          router.replace("/pos");
        } else {
          setAllowed(true);
        }
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [router]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">Primary device only</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          This section is restricted to the primary device. Redirecting to POS…
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
