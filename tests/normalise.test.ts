import { describe, expect, it } from "vitest";

import {
  cleanUrl,
  contentHash,
  MIN_HEADLINE,
  normaliseHeadline,
  normaliseItem,
  normaliseStandfirst,
  parsePublished,
  resolveLanguage,
  sourceGuid,
  STANDFIRST_MAX,
} from "../src/lib/feeds.js";

describe("normaliseHeadline", () => {
  it("strips HTML, decodes entities, collapses whitespace", () => {
    expect(normaliseHeadline("<b>Rules   &amp;\nnorms shift</b>")).toBe(
      "Rules & norms shift",
    );
  });

  it("rejects headlines shorter than the minimum", () => {
    expect(normaliseHeadline("Too short")).toBeNull();
    expect("Too short".length).toBeLessThan(MIN_HEADLINE);
  });
});

describe("normaliseStandfirst", () => {
  it("truncates at the limit on a word boundary and never exceeds it", () => {
    const raw = "word ".repeat(100).trim(); // 499 chars
    const out = normaliseStandfirst(raw);
    expect(out).not.toBeNull();
    expect(out!.length).toBeLessThanOrEqual(STANDFIRST_MAX);
    expect(out!.endsWith("word")).toBe(true); // cut on a boundary, no partial word
  });

  it("returns null for empty or missing input", () => {
    expect(normaliseStandfirst(null)).toBeNull();
    expect(normaliseStandfirst("   ")).toBeNull();
  });

  it("strips a full HTML body down to text before truncating", () => {
    const out = normaliseStandfirst("<p>Lead <em>paragraph</em>.</p>");
    expect(out).toBe("Lead paragraph .");
  });
});

describe("cleanUrl", () => {
  it("removes tracking parameters but keeps real ones", () => {
    const out = cleanUrl("https://ex.com/a?utm_source=x&id=7&fbclid=abc&ref=nl");
    expect(out).toBe("https://ex.com/a?id=7");
  });
});

describe("sourceGuid", () => {
  it("prefers the declared GUID", () => {
    expect(sourceGuid("guid-123", "https://ex.com/a")).toBe("guid-123");
  });

  it("falls back to a stable hash of the URL", () => {
    const a = sourceGuid(null, "https://ex.com/a");
    const b = sourceGuid("  ", "https://ex.com/a");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe("contentHash", () => {
  it("is stable and sensitive to standfirst", () => {
    expect(contentHash("H", "S")).toBe(contentHash("H", "S"));
    expect(contentHash("H", "S")).not.toBe(contentHash("H", "T"));
  });
});

describe("parsePublished", () => {
  const now = new Date("2026-08-01T12:00:00Z");

  it("parses a valid past date", () => {
    const { publishedAt, substituted } = parsePublished("2026-07-30T09:00:00Z", now);
    expect(substituted).toBe(false);
    expect(publishedAt.toISOString()).toBe("2026-07-30T09:00:00.000Z");
  });

  it("substitutes now for missing, unparseable, or future dates", () => {
    expect(parsePublished(null, now)).toEqual({ publishedAt: now, substituted: true });
    expect(parsePublished("not a date", now).substituted).toBe(true);
    expect(parsePublished("2027-01-01T00:00:00Z", now).substituted).toBe(true);
  });
});

describe("resolveLanguage", () => {
  it("uses the feed declaration, normalised to 2 letters", () => {
    expect(resolveLanguage("en-GB", "fr")).toBe("en");
  });

  it("falls back to the outlet language", () => {
    expect(resolveLanguage(null, "de")).toBe("de");
  });
});

describe("normaliseItem", () => {
  it("composes a full record and truncates the standfirst", () => {
    const item = normaliseItem(
      {
        title: "A significant procedural amendment passes",
        link: "https://ex.com/a?utm_medium=rss",
        guid: "g1",
        isoDate: "2026-07-31T08:00:00Z",
        contentSnippet: "x".repeat(400),
        language: "fr-FR",
      },
      "en",
      new Date("2026-08-01T00:00:00Z"),
    );

    expect(item).not.toBeNull();
    expect(item!.url).toBe("https://ex.com/a");
    expect(item!.sourceGuid).toBe("g1");
    expect(item!.language).toBe("fr");
    expect(item!.standfirst!.length).toBeLessThanOrEqual(STANDFIRST_MAX);
  });

  it("returns null when the headline is unusable", () => {
    expect(normaliseItem({ title: "hi", link: "https://ex.com/a" }, "en")).toBeNull();
  });

  it("returns null when there is no link", () => {
    const raw = { title: "A perfectly long and usable headline here" };
    expect(normaliseItem(raw, "en")).toBeNull();
  });
});
