import { describe, expect, it } from "vitest";

import { divergence, type NumericClaim } from "../src/lib/divergence.js";

// The SPEC 8.3 acceptance case: the Ceuta crossing of 30-31 July 2026.
const CEUTA: NumericClaim[] = [
  { claimKey: "deaths|ceuta", value: 18, outlet: "AFP", asOf: new Date("2026-07-30T08:00:00Z") },
  { claimKey: "deaths|ceuta", value: 34, outlet: "Reuters", asOf: new Date("2026-07-30T20:00:00Z") },
  { claimKey: "deaths|ceuta", value: 57, outlet: "El País", asOf: new Date("2026-07-31T08:00:00Z") },
  { claimKey: "crossing|ceuta", value: 2000, outlet: "AFP", asOf: new Date("2026-07-30T08:00:00Z") },
  { claimKey: "crossing|ceuta", value: 50000, outlet: "El País", asOf: new Date("2026-07-31T09:00:00Z") },
  { claimKey: "responders|ceuta", value: 100, outlet: "AFP", asOf: new Date("2026-07-30T08:00:00Z") },
  { claimKey: "responders|ceuta", value: 110, outlet: "Reuters", asOf: new Date("2026-07-30T09:00:00Z") },
];

describe("divergence (SPEC 8.3)", () => {
  it("surfaces the diverging death toll in chronological order", () => {
    const deaths = divergence(CEUTA).find((d) => d.key === "deaths|ceuta");
    expect(deaths).toBeDefined();
    expect(deaths!.range).toEqual([18, 57]);
    expect(deaths!.spread).toBe(3.17);
    expect(deaths!.sources.map((s) => s.value)).toEqual([18, 34, 57]); // sorted by asOf
  });

  it("surfaces the crossing estimate spread", () => {
    const crossing = divergence(CEUTA).find((d) => d.key === "crossing|ceuta");
    expect(crossing!.range).toEqual([2000, 50000]);
    expect(crossing!.spread).toBe(25);
  });

  it("excludes figures that agree closely (spread < 1.5)", () => {
    expect(divergence(CEUTA).some((d) => d.key === "responders|ceuta")).toBe(false);
  });

  it("treats a zero low bound as divergent", () => {
    const claims: NumericClaim[] = [
      { claimKey: "x", value: 0, outlet: "A", asOf: new Date("2026-07-30T08:00:00Z") },
      { claimKey: "x", value: 5, outlet: "B", asOf: new Date("2026-07-30T09:00:00Z") },
    ];
    const [d] = divergence(claims);
    expect(d?.range).toEqual([0, 5]);
    expect(d?.spread).toBe(5);
  });

  it("ignores single-source keys", () => {
    const claims: NumericClaim[] = [
      { claimKey: "solo", value: 10, outlet: "A", asOf: new Date("2026-07-30T08:00:00Z") },
    ];
    expect(divergence(claims)).toEqual([]);
  });
});
