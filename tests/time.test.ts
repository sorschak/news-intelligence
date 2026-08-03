import { describe, expect, it } from "vitest";

import { localHour, shouldRunNow, withinHourWindow } from "../src/lib/time.js";

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

describe("withinHourWindow", () => {
  const summer = (h: number) => new Date(Date.UTC(2026, 6, 15, h, 0, 0)); // EDT = UTC-4

  it("accepts a run at the target hour", () => {
    expect(withinHourWindow(5, 5, TZ, summer(9))).toBe(true); // 05:00 ET
  });

  it("accepts a delayed run still inside the window", () => {
    expect(withinHourWindow(5, 5, TZ, summer(13))).toBe(true); // 09:00 ET, within [5,10)
  });

  it("rejects a run before the window opens", () => {
    expect(withinHourWindow(5, 5, TZ, summer(8))).toBe(false); // 04:00 ET
  });

  it("rejects a run past the window (upper bound exclusive)", () => {
    expect(withinHourWindow(5, 5, TZ, summer(14))).toBe(false); // 10:00 ET
  });
});
