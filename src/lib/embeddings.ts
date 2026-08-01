/**
 * Hosted multilingual embeddings (SPEC.md 3.3, 6.1) — Phase 2.
 *
 * Batched (96–128 texts/request) and cached by `content_hash`. The provider must
 * be explicitly multilingual; cross-lingual clustering is verified at Phase 2
 * calibration, not assumed.
 */

export async function embedBatch(_texts: string[]): Promise<number[][]> {
  throw new Error("embeddings: implemented in Phase 2");
}
