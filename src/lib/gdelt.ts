/**
 * GDELT volume lookup (SPEC.md 7.4) — Phase 3, best-effort (FR-06 "Should").
 *
 * Supplies global publication volume across markets outside the registry. Stored
 * as context only and deliberately excluded from the salience function —
 * answering how much attention a story receives, which is useful to know and
 * actively misleading to optimise for.
 *
 * The spec queries with the cluster's three highest-weight entities; without an
 * entity extractor yet, we approximate with the most frequent salient headline
 * terms (DECISIONS.md D-013). The call is best-effort: any failure yields null.
 */

type JsonFetch = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "after", "over", "into",
  "amid", "says", "said", "will", "have", "has", "are", "was", "were", "his",
  "her", "its", "their", "they", "how", "why", "what", "when", "who", "new",
]);

/** Most frequent salient (≥4-char, non-stopword) tokens across headlines. */
export function topKeywords(headlines: string[], k = 3): string[] {
  const freq = new Map<string, number>();
  for (const headline of headlines) {
    for (const token of headline.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length < 4 || STOPWORDS.has(token)) continue;
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([token]) => token);
}

/** Total GDELT article volume for the keywords over the last 24h, or null. */
export async function gdeltVolume(
  keywords: string[],
  fetchImpl: JsonFetch = fetch as unknown as JsonFetch,
): Promise<number | null> {
  if (keywords.length === 0) return null;
  const query = encodeURIComponent(keywords.join(" "));
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}` +
    `&mode=timelinevolraw&timespan=24h&format=json`;

  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      timeline?: Array<{ data?: Array<{ value?: number }> }>;
    };
    const data = json.timeline?.[0]?.data;
    if (!data || data.length === 0) return null;
    return data.reduce((sum, point) => sum + (point.value ?? 0), 0);
  } catch {
    return null;
  }
}
