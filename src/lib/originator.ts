/**
 * Originator vs reprint classification cascade (SPEC.md 7.2) — Phase 3.
 *
 * The central technical problem of the system (SPEC 7.1): thirty outlets carrying
 * one AFP dispatch are one act of reporting, not thirty. Rules are applied in
 * precedence order; the first to fire determines the class and is recorded in
 * `origin_evidence` for auditability. Every rule has a labelled test
 * (CLAUDE.md).
 *
 * Rule 4 (temporal precedence) needs cluster context and is precomputed by the
 * enrich job — it uses cosine over the stored item embedding (headline +
 * standfirst) as a proxy for the spec's "headline cosine" — DECISIONS.md D-012.
 */

export type OriginClass = "originator" | "reprint" | "unknown";
export type Origin = { class: OriginClass; evidence: string };

// Canonicalised wire names, keyed by lowercase alias.
const WIRE_CANONICAL: Record<string, string> = {
  reuters: "Reuters",
  ap: "Associated Press",
  "associated press": "Associated Press",
  afp: "Agence France-Presse",
  "agence france-presse": "Agence France-Presse",
  bloomberg: "Bloomberg",
  dpa: "dpa",
  efe: "EFE",
  ansa: "ANSA",
  "pa media": "PA Media",
  "press association": "PA Media",
  kyodo: "Kyodo",
  xinhua: "Xinhua",
  yonhap: "Yonhap",
  tass: "TASS",
  anadolu: "Anadolu",
  interfax: "Interfax",
};

const WIRE_ALT =
  "reuters|associated press|\\bap\\b|agence france-presse|\\bafp\\b|bloomberg|" +
  "\\bdpa\\b|\\befe\\b|\\bansa\\b|pa media|press association|kyodo|xinhua|" +
  "yonhap|\\btass\\b|anadolu|interfax";

// Credit patterns: parenthesised agency, trailing/leading attribution, and
// "with files from / reporting by" phrasings.
const CREDIT_PATTERNS: RegExp[] = [
  new RegExp(`\\((?:[^)]*\\b)?(${WIRE_ALT})\\b[^)]*\\)`, "i"),
  new RegExp(`(?:with files from|additional reporting by|reporting by)\\s+(${WIRE_ALT})\\b`, "i"),
  new RegExp(`[—–-]\\s*(${WIRE_ALT})\\.?\\s*$`, "i"),
  new RegExp(`(?:^|\\|)\\s*(${WIRE_ALT})\\s*[:—–-]`, "i"),
];

/** Detect an explicit wire credit; returns the canonical wire name or null. */
export function detectWireCredit(text: string): string | null {
  for (const pattern of CREDIT_PATTERNS) {
    const m = pattern.exec(text);
    if (m?.[1]) {
      const key = m[1].toLowerCase();
      return WIRE_CANONICAL[key] ?? m[1];
    }
  }
  return null;
}

const ORG_HINT =
  /\b(staff|agency|agencies|reuters|associated press|\bap\b|afp|bloomberg|newsroom|editorial|desk|bureau|correspondent|reporters?|news service|wire|dpa)\b|\.com/i;

/** True if a byline field names a person rather than an organisation. */
export function isPersonByline(creator: string | null | undefined): boolean {
  const c = creator?.trim();
  if (!c) return false;
  if (ORG_HINT.test(c)) return false;
  const name = c.replace(/^by\s+/i, "").trim();
  return /\S\s+\S/.test(name); // at least two whitespace-separated tokens
}

export type ClassifyInput = {
  headline: string;
  standfirst: string | null;
  outletIsWire: boolean;
  outletTier: number;
  creator: string | null;
  /** Precomputed rule-4 match: an earlier near-identical item from another outlet. */
  precedent: { itemId: string } | null;
};

/** Apply the classification cascade in precedence order (SPEC 7.2). */
export function classify(input: ClassifyInput): Origin {
  const text = `${input.headline} ${input.standfirst ?? ""}`;

  const wire = detectWireCredit(text);
  if (wire) return { class: "reprint", evidence: `wire-credit:${wire}` };

  if (input.outletIsWire) return { class: "originator", evidence: "outlet-is-wire" };

  if (input.outletTier === 3) return { class: "reprint", evidence: "aggregator-tier" };

  if (input.precedent) {
    return { class: "reprint", evidence: `temporal-precedence:${input.precedent.itemId}` };
  }

  if (isPersonByline(input.creator)) return { class: "originator", evidence: "byline" };

  return { class: "unknown", evidence: "default" };
}
