"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

const DEFAULT_MESSAGE =
  "System maintenance in progress — some features may be temporarily unavailable.";

export function MaintenanceBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function check() {
      fetch("/api/billing")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.billing?.maintenanceBanner) {
            setMessage(d.billing.maintenanceBannerMessage || DEFAULT_MESSAGE);
          } else {
            setMessage(null);
          }
        })
        .catch(() => {});
    }

    check();

    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    const interval = setInterval(check, 30_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      clearInterval(interval);
    };
  }, []);

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
