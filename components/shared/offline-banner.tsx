"use client";

import { useEffect, useState, useCallback } from "react";
import { WifiOff } from "lucide-react";

async function checkConnectivity(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    await fetch("/api/ping", {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    return true;
  } catch {
    return false;
  }
}

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  const probe = useCallback(async () => {
    const reachable = await checkConnectivity();
    setIsOnline(reachable);
  }, []);

  useEffect(() => {
    // Check immediately on mount
    probe();

    // Re-check when the browser fires online/offline events
    const handleOnline = () => probe();
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Poll every 10 s to catch cases where the server goes down
    // without the browser firing an offline event
    const interval = setInterval(probe, 10_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [probe]);

  if (isOnline) return null;

  return (
    <div className="flex items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2">
      <WifiOff className="h-4 w-4 flex-shrink-0 text-amber-700" />
      <p className="text-sm font-medium text-amber-800">
        You&apos;re offline — POS still works, sales will sync when reconnected
      </p>
    </div>
  );
}
