/**
 * Pure clustering helpers (SPEC.md 6.1) — Phase 2.
 *
 * Kept side-effect free (no DB, no network) so the assignment logic and vector
 * (de)serialisation are unit-testable. The nearest-cluster search and centroid
 * recomputation themselves run in Postgres via pgvector (see jobs/cluster.ts).
 *
 * Thresholds are the only tuning parameters that materially affect output and
 * MUST be calibrated empirically (SPEC 6.2) — the values here are the spec's
 * starting points, not settled operating points.
 */

export const WINDOW_HOURS = 72;
export const ASSIGN_THRESHOLD = 0.82; // cosine similarity, item -> centroid
export const MERGE_THRESHOLD = 0.88; // cosine similarity, centroid -> centroid

/** Cosine similarity of two equal-length vectors, in [-1, 1]. */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Serialise a vector to the pgvector text literal `[1,2,3]`. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

/** Parse a pgvector text literal `[1,2,3]` back to numbers. */
export function parseVectorLiteral(s: string): number[] {
  const inner = s.replace(/^\[/, "").replace(/\]$/, "").trim();
  if (!inner) return [];
  return inner.split(",").map((x) => Number(x));
}

export type Nearest = { clusterId: number; similarity: number };
export type Assignment = { kind: "attach"; clusterId: number } | { kind: "create" };

/** Attach to the nearest cluster if it clears the threshold, else start a new one. */
export function decideAssignment(
  nearest: Nearest | null,
  threshold: number = ASSIGN_THRESHOLD,
): Assignment {
  if (nearest && nearest.similarity >= threshold) {
    return { kind: "attach", clusterId: nearest.clusterId };
  }
  return { kind: "create" };
}
