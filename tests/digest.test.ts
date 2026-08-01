import { describe, expect, it } from "vitest";

import {
  capWords,
  composeSections,
  digestClusterIds,
  EXCERPT_MAX_WORDS,
  median,
  renderDigestHtml,
  renderItem,
  type ScoredCluster,
  selectThinlySourced,
} from "../src/lib/digest.js";

function cluster(overrides: Partial<ScoredCluster> = {}): ScoredCluster {
  return {
    id: "1",
    salience: 0.5,
    structural: 0,
    contribution: 0,
    corroboration: 0.3,
    originatorCount: 3,
    rationale: "r",
    singleSource: false,
    hasDivergence: false,
    headline: "A headline",
    outlet: "Reuters",
    outletTier: 2,
    publishedAt: new Date("2026-07-31T09:00:00Z"),
    url: "https://ex.com/a",
    standfirst: null,
    ...overrides,
  };
}

describe("median", () => {
  it("handles odd and even lengths and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe("capWords (NFR-07: 25-word ceiling)", () => {
  it("passes short text through", () => {
    expect(capWords("one two three")).toBe("one two three");
  });

  it("caps at the limit and marks truncation", () => {
    const long = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
    const out = capWords(long);
    // 25 space-separated tokens; the ellipsis is appended to the 25th word.
    expect(out.split(" ").length).toBe(EXCERPT_MAX_WORDS);
    expect(out.endsWith("w24…")).toBe(true);
  });
});

describe("section selection (SPEC 9.1)", () => {
  const pool = [
    cluster({ id: "s1", structural: 4, salience: 0.9 }),
    cluster({ id: "s2", structural: 3, salience: 0.7 }),
    cluster({ id: "c1", corroboration: 0.6, salience: 0.8 }),
    cluster({ id: "k1", contribution: 4, salience: 0.6 }),
    cluster({ id: "d1", hasDivergence: true, salience: 0.4 }),
  ];

  it("selects structural >= 3, ranked by salience", () => {
    const s = composeSections(pool).structural.map((c) => c.id);
    expect(s).toEqual(["s1", "s2"]);
  });

  it("selects corroborated >= 0.55", () => {
    expect(composeSections(pool).corroborated.map((c) => c.id)).toEqual(["c1"]);
  });

  it("selects contribution >= 3", () => {
    expect(composeSections(pool).contribution.map((c) => c.id)).toEqual(["k1"]);
  });

  it("selects clusters with a detected divergence", () => {
    expect(composeSections(pool).divergence.map((c) => c.id)).toEqual(["d1"]);
  });
});

describe("thinly sourced (SPEC 9.2)", () => {
  it("takes originator_count <= 2, salience above median, ordered by outlet tier", () => {
    const pool = [
      cluster({ id: "a", originatorCount: 1, salience: 0.9, outletTier: 2 }),
      cluster({ id: "b", originatorCount: 2, salience: 0.8, outletTier: 1 }),
      cluster({ id: "c", originatorCount: 5, salience: 0.1 }), // pulls median down
      cluster({ id: "d", originatorCount: 1, salience: 0.05 }), // below median
    ];
    // median salience = (0.8+0.1)/2 ... sorted [0.05,0.1,0.8,0.9] -> median 0.45
    const ids = selectThinlySourced(pool).map((c) => c.id);
    expect(ids).toEqual(["b", "a"]); // tier 1 before tier 2, no salience ranking
  });
});

describe("renderItem (SPEC 9.3 attribution)", () => {
  it("always includes outlet, timestamp, and link", () => {
    const html = renderItem(cluster({ url: "https://ex.com/x", outlet: "Le Monde" }));
    expect(html).toContain('href="https://ex.com/x"');
    expect(html).toContain("Le Monde");
    expect(html).toContain("2026-07-31 09:00 UTC");
  });

  it("prefixes a single-source assertion with the attributing outlet", () => {
    const html = renderItem(cluster({ singleSource: true, standfirst: "The ministry said prices fell." }));
    expect(html).toContain("Reuters reports:");
  });

  it("caps the excerpt at 25 words", () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const html = renderItem(cluster({ standfirst: long }));
    expect(html).toContain("word0");
    expect(html).not.toContain("word25"); // 26th word dropped
  });

  it("escapes HTML in untrusted fields", () => {
    const html = renderItem(cluster({ headline: "<script>x</script>" }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderDigestHtml", () => {
  it("renders a self-contained document with the overview and operations", () => {
    const html = renderDigestHtml({
      editionDate: "2026-08-01",
      overview: "Markets moved and rules changed.",
      operations: "0 feed(s) deactivated.",
      sections: composeSections([cluster({ id: "x", structural: 5, salience: 0.9 })]),
    });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Markets moved and rules changed.");
    expect(html).toContain("Operations: 0 feed(s) deactivated.");
  });
});

describe("digestClusterIds", () => {
  it("returns the distinct ids appearing across sections", () => {
    const sections = composeSections([
      cluster({ id: "1", structural: 4, corroboration: 0.6, salience: 0.9 }),
      cluster({ id: "2", contribution: 3, salience: 0.5 }),
    ]);
    expect(new Set(digestClusterIds(sections))).toEqual(new Set(["1", "2"]));
  });
});
