/**
 * Composite salience (SPEC.md 8.2) — Phase 4.
 *
 * Weights encode the editorial thesis. There is no recency, volume, or GDELT
 * term: a story from four days ago that changed a regulation outranks one from
 * this morning that did not. Every cluster is scored twice at analysis time
 * (`salience` and `salience_undomained`) and both persisted, so the counter-bias
 * edition (SPEC 9.5) is a query, not a rerun.
 */

// Version 1.1 weights, unchanged in 1.2. Positive weights sum to 0.90.
export const W = {
  structural: 0.26,
  irreversibility: 0.21,
  corroboration: 0.18,
  contribution: 0.13,
  domain: 0.12,
  ephemerality: -0.18, // penalty
} as const;

export type Score = {
  structural: number; // 0..5
  irreversibility: number; // 0..5
  corroboration: number; // 0..1 (the cluster's corroboration index)
  contribution: number; // 0..5
  domainRelevance: number; // 0..5
  ephemerality: number; // 0..5
};

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

/**
 * Composite salience. Pass `domainWeight = 0` for the counter-bias edition; the
 * freed weight is redistributed proportionally across the remaining positive
 * terms so the two editions stay on a comparable scale.
 */
export function salience(s: Score, domainWeight: number = W.domain): number {
  const freed = W.domain - domainWeight;
  const others = W.structural + W.irreversibility + W.corroboration + W.contribution;
  const k = 1 + freed / others;

  const v =
    W.structural * k * (s.structural / 5) +
    W.irreversibility * k * (s.irreversibility / 5) +
    W.corroboration * k * s.corroboration +
    W.contribution * k * (s.contribution / 5) +
    domainWeight * (s.domainRelevance / 5) +
    W.ephemerality * (s.ephemerality / 5);

  return round4(Math.max(0, v));
}

/** Both salience values persisted at analysis time. */
export function scoreBoth(s: Score): { salience: number; undomained: number } {
  return { salience: salience(s), undomained: salience(s, 0) };
}
