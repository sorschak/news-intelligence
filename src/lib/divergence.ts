/**
 * Numeric claim divergence (SPEC.md 8.3) — Phase 4.
 *
 * Divergence is computed arithmetically, not by the model. The Ceuta crossing of
 * 30–31 July 2026 is the acceptance test: surface each sequence without
 * averaging, without picking a figure, without calling any outlet wrong.
 */

export type Divergence = {
  key: string;
  range: [number, number];
  spread: number;
  sources: Array<{ outlet: string; value: number; asOf: Date }>;
};

export function divergence(_claims: unknown[]): Divergence[] {
  throw new Error("divergence: implemented in Phase 4");
}
