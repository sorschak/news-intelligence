/**
 * Numeric claim divergence (SPEC.md 8.3) — Phase 4.
 *
 * Divergence is computed arithmetically, not by the model. The output surfaces
 * how a figure moved over time and which outlet reported what and when. The
 * Ceuta crossing of 30–31 July 2026 is the acceptance test: a death toll moving
 * 18 → 34 → 57 within ~24h, and a crossing estimate ~2,000 → ~50,000 — both
 * surfaced without averaging, without selecting a figure, without calling any
 * outlet wrong.
 */

export type NumericClaim = {
  claimKey: string;
  value: number;
  outlet: string;
  asOf: Date;
};

export type Divergence = {
  key: string;
  range: [number, number];
  spread: number;
  sources: Array<{ outlet: string; value: number; asOf: Date }>;
};

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function groupByKey(claims: NumericClaim[]): Map<string, NumericClaim[]> {
  const groups = new Map<string, NumericClaim[]>();
  for (const claim of claims) {
    const bucket = groups.get(claim.claimKey);
    if (bucket) bucket.push(claim);
    else groups.set(claim.claimKey, [claim]);
  }
  return groups;
}

/** Detect divergent numeric claims: same key, ≥2 sources, spread ≥ 1.5 (or a zero low). */
export function divergence(claims: NumericClaim[]): Divergence[] {
  const out: Divergence[] = [];

  for (const [key, group] of groupByKey(claims)) {
    if (group.length < 2) continue;

    const values = group.map((c) => c.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);

    if (lo === 0 || hi / lo >= 1.5) {
      out.push({
        key,
        range: [lo, hi],
        spread: round2(hi / Math.max(lo, 1)),
        sources: [...group]
          .sort((a, b) => a.asOf.getTime() - b.asOf.getTime())
          .map((c) => ({ outlet: c.outlet, value: c.value, asOf: c.asOf })),
      });
    }
  }
  return out;
}
