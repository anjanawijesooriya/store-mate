import { useEffect } from "react";

/**
 * Automatically re-fetches data when:
 *  - the browser tab becomes visible (user switches back to this tab)
 *  - the window regains focus (user returns from another app)
 *  - every `intervalMs` milliseconds (default 30 s)
 *
 * Pass a stable `useCallback` reference to avoid unnecessary re-subscriptions.
 * Visibility + focus events are debounced (300 ms) so they never double-fire.
 */
export function useAutoRefresh(refetch: () => void, intervalMs = 30_000) {
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const trigger = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        refetch();
      }, 300);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") trigger();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", trigger);
    const interval = setInterval(refetch, intervalMs);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", trigger);
      clearInterval(interval);
      if (debounce) clearTimeout(debounce);
    };
  }, [refetch, intervalMs]);
}
