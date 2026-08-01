import { describe, expect, it } from "vitest";

import { localHour, shouldRunNow } from "../src/lib/time.js";

const TZ = "America/Toronto";

describe("localHour / shouldRunNow", () => {
  it("resolves 06:00 Toronto in winter (UTC-5)", () => {
    const winter = new Date("2026-01-15T11:00:00Z");
    expect(localHour(TZ, winter)).toBe(6);
    expect(shouldRunNow(6, TZ, winter)).toBe(true);
  });

  it("resolves 06:00 Toronto in summer (UTC-4), proving no DST drift", () => {
    const summer = new Date("2026-07-15T10:00:00Z");
    expect(localHour(TZ, summer)).toBe(6);
    expect(shouldRunNow(6, TZ, summer)).toBe(true);
  });

  it("does not fire at the wrong local hour", () => {
    const winter = new Date("2026-01-15T11:00:00Z");
    expect(shouldRunNow(7, TZ, winter)).toBe(false);
  });

  it("reports midnight as 0, not 24", () => {
    const midnight = new Date("2026-01-15T05:00:00Z"); // 00:00 Toronto, winter
    expect(localHour(TZ, midnight)).toBe(0);
  });
});
