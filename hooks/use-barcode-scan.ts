"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Detects barcode scanner input by distinguishing it from human typing.
 *
 * Barcode scanners (USB/BT HID) type characters very fast (< 50 ms apart) and
 * terminate with Enter. Human typing is much slower (typically > 150 ms per key).
 *
 * Algorithm:
 *  - Accumulate characters in a buffer, resetting on any gap > GAP_RESET_MS.
 *  - When Enter fires, check that:
 *      (a) the buffer has at least MIN_CHARS characters, AND
 *      (b) the Enter arrived within MAX_ENTRY_INTERVAL_MS of the previous char.
 *  - If both hold, call onScan(barcode) and swallow the Enter.
 *  - Otherwise treat as normal keyboard input.
 */
const GAP_RESET_MS = 100;       // reset buffer if keys stop for this long
const MAX_ENTRY_INTERVAL_MS = 60; // Enter must follow last char within this window
const MIN_CHARS = 4;            // ignore accidental short sequences

export function useBarcodeScan(
  onScan: (barcode: string) => void,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable callback ref so the effect doesn't re-register on every render
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const now = Date.now();
    const gap = now - lastKeyTimeRef.current;
    lastKeyTimeRef.current = now;

    // Long pause between keys → reset buffer (it was human typing)
    if (gap > GAP_RESET_MS && bufferRef.current.length > 0) {
      bufferRef.current = "";
    }

    if (e.key === "Enter") {
      const barcode = bufferRef.current.trim();
      bufferRef.current = "";
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

      if (barcode.length >= MIN_CHARS && gap <= MAX_ENTRY_INTERVAL_MS) {
        // Looks like a scanner — prevent the Enter from submitting forms / adding newlines
        e.preventDefault();
        e.stopPropagation();
        onScanRef.current(barcode);
      }
      return;
    }

    // Accumulate only printable single characters (ignore Shift, Ctrl, F-keys, etc.)
    if (e.key.length === 1) {
      bufferRef.current += e.key;

      // Safety valve: auto-clear if Enter never arrives within 500 ms
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        bufferRef.current = "";
        timerRef.current = null;
      }, 500);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Capture phase so we run before any focused input's own keydown handler
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleKeyDown, enabled]);
}
