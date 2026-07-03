"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Wrench } from "lucide-react";

const DEFAULT_MESSAGE =
  "System maintenance in progress — some features may be temporarily unavailable.";

export function MaintenanceBanner() {
  const [message, setMessage] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => r.json())
      .then((d) => {
        if (d.billing?.maintenanceBanner) {
          setMessage(d.billing.maintenanceBannerMessage || DEFAULT_MESSAGE);
        } else {
          setMessage(null);
        }
      })
      .catch(() => {});
  }, [pathname]);

  if (!message) return null;

  return (
    <div className="flex items-center gap-3 border-b border-blue-400/40 bg-blue-500/10 px-4 py-2.5">
      <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
      <p className="text-sm font-medium text-blue-700 dark:text-blue-300 flex-1">
        {message}
      </p>
    </div>
  );
}
