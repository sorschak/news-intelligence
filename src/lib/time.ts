/**
 * Timezone-aware scheduling guard (SPEC.md 10.2, FR-19).
 *
 * GitHub Actions cron is UTC-only. Every scheduled job fires at both candidate
 * UTC hours for its target local hour and calls `shouldRunNow` to exit unless
 * the Toronto hour actually matches, so the digest and the counter edition's
 * 14-day boundary do not drift across DST changes.
 */

const DEFAULT_TZ = "America/Toronto";

/**
 * True when the current local hour in `tz` equals `targetLocalHour`.
 *
 * `now` is injectable for testing. The `% 24` guards the en-CA quirk where
 * midnight can format as "24" rather than "0".
 */
export function shouldRunNow(
  targetLocalHour: number,
  tz: string = DEFAULT_TZ,
  now: Date = new Date(),
): boolean {
  return localHour(tz, now) === targetLocalHour;
}

/** The hour (0–23) in the given timezone for `now`. */
export function localHour(tz: string = DEFAULT_TZ, now: Date = new Date()): number {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).format(now);
  return Number(formatted) % 24;
}
