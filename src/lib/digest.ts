/**
 * Digest composition and rendering (SPEC.md 9.1–9.4) — Phase 5.
 *
 * Pure functions: section selection, bounds, and static HTML rendering, with two
 * compliance controls enforced here in the template rather than in a prompt
 * (SPEC 9.3, NFR-07): no emitted excerpt exceeds 25 words from a single source,
 * and every assertion carries outlet, timestamp, and a link. Assertions resting
 * on a single official statement are prefixed with the attributing outlet.
 */

export const HOLD_THRESHOLD = 0.55; // salience at/above which a cluster is held (SPEC 9.4)
export const EXCERPT_MAX_WORDS = 25; // NFR-07

export const BOUNDS = {
  structural: 5,
  corroborated: 12,
  contribution: 3,
  divergence: 4,
  thinlySourced: 5,
  heldReleased: 3,
  overviewPool: 12,
} as const;

export type ScoredCluster = {
  id: string;
  salience: number;
  structural: number;
  contribution: number;
  corroboration: number;
  originatorCount: number;
  rationale: string;
  singleSource: boolean;
  hasDivergence: boolean;
  // Representative item, for display + attribution.
  headline: string;
  outlet: string;
  outletTier: number;
  publishedAt: Date;
  url: string;
  standfirst: string | null;
};

const bySalienceDesc = (a: ScoredCluster, b: ScoredCluster): number => b.salience - a.salience;

/** Median of a numeric list (0 for an empty list). */
export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

export function selectStructural(cs: ScoredCluster[]): ScoredCluster[] {
  return cs.filter((c) => c.structural >= 3).sort(bySalienceDesc).slice(0, BOUNDS.structural);
}

export function selectCorroborated(cs: ScoredCluster[]): ScoredCluster[] {
  return cs.filter((c) => c.corroboration >= 0.55).sort(bySalienceDesc).slice(0, BOUNDS.corroborated);
}

export function selectContribution(cs: ScoredCluster[]): ScoredCluster[] {
  return cs.filter((c) => c.contribution >= 3).sort(bySalienceDesc).slice(0, BOUNDS.contribution);
}

export function selectDivergence(cs: ScoredCluster[]): ScoredCluster[] {
  return cs.filter((c) => c.hasDivergence).sort(bySalienceDesc).slice(0, BOUNDS.divergence);
}

/**
 * Thinly sourced (SPEC 9.2): the deliberate inversion of the system's logic.
 * originator_count ≤ 2 and salience above the median, ordered by outlet tier —
 * these carry no salience ranking.
 */
export function selectThinlySourced(cs: ScoredCluster[]): ScoredCluster[] {
  const med = median(cs.map((c) => c.salience));
  return cs
    .filter((c) => c.originatorCount <= 2 && c.salience > med)
    .sort((a, b) => a.outletTier - b.outletTier)
    .slice(0, BOUNDS.thinlySourced);
}

/** Cap text at {@link EXCERPT_MAX_WORDS} words (NFR-07). */
export function capWords(text: string, max: number = EXCERPT_MAX_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(" ");
  return words.slice(0, max).join(" ") + "…";
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** Render one item with mandatory outlet + timestamp + link (SPEC 9.3). */
export function renderItem(c: ScoredCluster): string {
  const excerpt = c.standfirst ? capWords(c.standfirst) : "";
  // Single-source assertions are prefixed with the attributing outlet.
  const attributed = excerpt
    ? c.singleSource
      ? `${esc(c.outlet)} reports: ${esc(excerpt)}`
      : esc(excerpt)
    : "";
  return [
    "<li>",
    `<a href="${esc(c.url)}">${esc(c.headline)}</a>`,
    ` — ${esc(c.outlet)}, ${fmtTime(c.publishedAt)}`,
    attributed ? `<div class="excerpt">${attributed}</div>` : "",
    `<div class="meta">salience ${c.salience.toFixed(3)} · corroboration ${c.corroboration.toFixed(2)} · ${c.originatorCount} originators</div>`,
    "</li>",
  ].join("");
}

function renderSection(title: string, items: ScoredCluster[]): string {
  if (items.length === 0) return "";
  return `<section><h2>${esc(title)}</h2><ul>${items.map(renderItem).join("")}</ul></section>`;
}

export type DigestSections = {
  structural: ScoredCluster[];
  corroborated: ScoredCluster[];
  contribution: ScoredCluster[];
  divergence: ScoredCluster[];
  thinlySourced: ScoredCluster[];
  heldReleased: ScoredCluster[];
};

export type DigestInput = {
  editionDate: string; // YYYY-MM-DD
  overview: string; // prose, no lists (SPEC 9.1)
  operations: string; // one line
  sections: DigestSections;
};

/** Compose all sections from the scored candidate pool (SPEC 9.1). */
export function composeSections(candidates: ScoredCluster[]): DigestSections {
  return {
    structural: selectStructural(candidates),
    corroborated: selectCorroborated(candidates),
    contribution: selectContribution(candidates),
    divergence: selectDivergence(candidates),
    thinlySourced: selectThinlySourced(candidates),
    heldReleased: [], // filled by the deliver job from released holds
  };
}

/** Distinct cluster ids appearing anywhere in the digest, for the archive row. */
export function digestClusterIds(sections: DigestSections): string[] {
  const seen = new Set<string>();
  for (const list of Object.values(sections)) {
    for (const c of list) seen.add(c.id);
  }
  return [...seen];
}

/** Render the digest to a static HTML string persisted to digest.html (SPEC 3.2). */
export function renderDigestHtml(input: DigestInput): string {
  const { sections } = input;
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    `<title>News Intelligence — ${esc(input.editionDate)}</title>`,
    "<style>body{font:16px/1.5 Georgia,serif;max-width:44rem;margin:2rem auto;padding:0 1rem}",
    "h1{font-size:1.4rem}h2{font-size:1.1rem;border-bottom:1px solid #ccc;padding-bottom:.2rem}",
    ".excerpt{color:#333;margin:.2rem 0}.meta{color:#777;font-size:.8rem}",
    "footer{color:#777;font-size:.8rem;border-top:1px solid #ccc;margin-top:2rem;padding-top:.5rem}</style>",
    "</head><body>",
    `<h1>News Intelligence — ${esc(input.editionDate)}</h1>`,
    `<section><h2>Overview</h2><p>${esc(input.overview)}</p></section>`,
    renderSection("Structural", sections.structural),
    renderSection("Corroborated events", sections.corroborated),
    renderSection("Contribution", sections.contribution),
    renderSection("Divergence watch", sections.divergence),
    renderSection("Thinly sourced", sections.thinlySourced),
    renderSection("Held and released", sections.heldReleased),
    `<footer>Operations: ${esc(input.operations)}</footer>`,
    "</body></html>",
  ].join("");
}

// ---------------------------------------------------------------------------
// Counter-bias edition (SPEC.md 9.5.5) — Phase 5a
// ---------------------------------------------------------------------------

/** A withheld item plus its two signed feedback links. `cluster.salience` holds salience_undomained here. */
export type CounterItem = {
  cluster: ScoredCluster;
  valuedUrl: string;
  indifferentUrl: string;
};

export type CounterDigestInput = {
  editionDate: string;
  suppressionRate: number;
  poolSize: number;
  comparison: string; // one line comparing with preceding editions
  withheld: CounterItem[];
  contribution: ScoredCluster[];
  coverageGaps: string[];
};

function renderCounterItem(item: CounterItem): string {
  const c = item.cluster;
  const excerpt = c.standfirst ? capWords(c.standfirst) : "";
  return [
    "<li>",
    `<a href="${esc(c.url)}">${esc(c.headline)}</a>`,
    ` — ${esc(c.outlet)}, ${fmtTime(c.publishedAt)}`,
    excerpt ? `<div class="excerpt">${esc(excerpt)}</div>` : "",
    `<div class="meta">undomained salience ${c.salience.toFixed(3)} · corroboration ${c.corroboration.toFixed(2)}</div>`,
    `<div class="feedback"><a href="${esc(item.valuedUrl)}">worth seeing</a> · <a href="${esc(item.indifferentUrl)}">indifferent</a></div>`,
    "</li>",
  ].join("");
}

/** Render the fortnightly counter-bias edition (SPEC 9.5.5). */
export function renderCounterHtml(input: CounterDigestInput): string {
  const gaps = input.coverageGaps.length ? input.coverageGaps.join(", ") : "none identified";
  return [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8">',
    `<title>Counter-bias edition — ${esc(input.editionDate)}</title>`,
    "<style>body{font:16px/1.5 Georgia,serif;max-width:44rem;margin:2rem auto;padding:0 1rem}",
    "h1{font-size:1.4rem}h2{font-size:1.1rem;border-bottom:1px solid #ccc;padding-bottom:.2rem}",
    ".excerpt{color:#333;margin:.2rem 0}.meta{color:#777;font-size:.8rem}.feedback{font-size:.85rem;margin:.2rem 0}",
    "footer{color:#777;font-size:.8rem;border-top:1px solid #ccc;margin-top:2rem;padding-top:.5rem}</style>",
    "</head><body>",
    `<h1>Counter-bias edition — ${esc(input.editionDate)}</h1>`,
    "<section><h2>Suppression report</h2>",
    `<p>Suppression rate: <strong>${input.suppressionRate.toFixed(3)}</strong> — the fraction of the top decile by unpersonalised salience that never reached you.<br>`,
    `Pool: ${input.poolSize} clusters scored in the trailing 14 days.<br>`,
    `${esc(input.comparison)}</p></section>`,
    input.withheld.length
      ? `<section><h2>Withheld items</h2><ul>${input.withheld.map(renderCounterItem).join("")}</ul></section>`
      : "",
    input.contribution.length
      ? `<section><h2>Contribution</h2><ul>${input.contribution.map(renderItem).join("")}</ul></section>`
      : "",
    `<section><h2>Coverage gaps</h2><p>${esc(gaps)}</p></section>`,
    "</body></html>",
  ].join("");
}
