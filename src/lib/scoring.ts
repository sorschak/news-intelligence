/**
 * Composite salience (SPEC.md 8.2) — Phase 4.
 *
 * Every cluster is scored twice at analysis time (`salience` and
 * `salience_undomained`) and both persisted, so the counter-bias edition is a
 * query rather than a rerun. No recency, volume, or attention term exists.
 */

export type Score = {
  structural: number;
  irreversibility: number;
  corroboration: number;
  contribution: number;
  domainRelevance: number;
  ephemerality: number;
};

export function salience(_s: Score, _domainWeight?: number): number {
  throw new Error("scoring: implemented in Phase 4");
}
