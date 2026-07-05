/**
 * Timezone-aware date boundary helpers.
 * All functions return JavaScript Date objects (UTC internally) that represent
 * the correct midnight or month-start in the given IANA timezone.
 *
 * Why this is needed: the server runs in UTC. `new Date(y, m, d)` uses the
 * server's local time (UTC), not the shop's local time. For Sri Lanka (UTC+5:30)
 * that means the day boundary is 5 h 30 m late — sales before 5:30 AM local
 * time get attributed to the previous day.
 */

/** @internal */
function localDayBoundaryUTC(tz: string, y: number, mo: number, d: number): Date {
  // Use noon UTC on that date to measure the timezone offset (noon avoids
  // any DST transitions that happen exactly at midnight).
  const noonUTC = new Date(Date.UTC(y, mo, d, 12, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(noonUTC);

  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  // tzOffsetMinutes: how many minutes the local timezone is ahead of UTC
  // e.g. Asia/Colombo (UTC+5:30) → h=17, m=30 at noonUTC → offset = 330
  const tzOffsetMinutes = h * 60 + m - 720; // 720 = 12 * 60

  // Local midnight in UTC = UTC midnight – tz offset
  return new Date(Date.UTC(y, mo, d, 0, 0, 0) - tzOffsetMinutes * 60_000);
}

/**
 * Returns the UTC timestamp that corresponds to midnight (00:00:00) of the
 * current local date in `tz`, shifted by `dayOffset` days.
 *
 * Examples for Asia/Colombo (UTC+5:30) when local date is 2026-07-05:
 *   localMidnightUTC("Asia/Colombo",  0) → 2026-07-04T18:30:00Z  (today local midnight)
 *   localMidnightUTC("Asia/Colombo", -1) → 2026-07-03T18:30:00Z  (yesterday)
 *   localMidnightUTC("Asia/Colombo",  1) → 2026-07-05T18:30:00Z  (tomorrow)
 */
export function localMidnightUTC(tz: string, dayOffset = 0): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y  = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const mo = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1; // 0-indexed
  const d  = parseInt(parts.find((p) => p.type === "day")!.value, 10);

  return localDayBoundaryUTC(tz, y, mo, d + dayOffset);
}

/**
 * Returns the UTC timestamp for the 1st of the current local month (or
 * `monthOffset` months earlier/later) at local midnight.
 */
export function localMonthStartUTC(tz: string, monthOffset = 0): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const y  = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const mo = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1; // 0-indexed

  return localDayBoundaryUTC(tz, y, mo + monthOffset, 1);
}
