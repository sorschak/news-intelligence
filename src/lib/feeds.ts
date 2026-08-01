/**
 * Feed discovery (SPEC.md 5.1).
 *
 * For an outlet homepage, find candidate RSS/Atom feeds by parsing
 * `<link rel="alternate">` advertisements and probing a short list of common
 * paths. Candidates are written for *manual confirmation* (see the discover
 * script); nothing here activates a feed.
 *
 * Node has no DOM, so link tags are extracted with a small regex parser rather
 * than pulling in a full HTML library (DECISIONS.md D-002). Fetching uses the
 * global `fetch` (undici, built into Node), injectable for tests.
 */

import { createHash } from "node:crypto";

import { userAgent } from "./env.js";

export type FeedCandidate = { url: string; title: string | null };

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

const FEED_TYPES = new Set(["application/rss+xml", "application/atom+xml"]);

export const COMMON_PATHS = [
  "/rss",
  "/feed",
  "/rss.xml",
  "/feeds/all.rss",
  "/arc/outboundfeeds/rss/",
  "/index.xml",
] as const;

type AlternateLink = { href: string; type: string; title: string | null };

const LINK_TAG = /<link\b[^>]*>/gi;
const ATTR = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(ATTR)) {
    const name = m[1]?.toLowerCase();
    if (name) out[name] = m[3] ?? m[4] ?? "";
  }
  return out;
}

/** Extract feed `<link rel="alternate">` advertisements from HTML. */
export function parseAlternateLinks(html: string): AlternateLink[] {
  const out: AlternateLink[] = [];
  for (const m of html.matchAll(LINK_TAG)) {
    const a = attributes(m[0]);
    const rel = (a["rel"] ?? "").toLowerCase().split(/\s+/);
    const type = (a["type"] ?? "").toLowerCase();
    if (!rel.includes("alternate") || !FEED_TYPES.has(type)) continue;
    const href = a["href"];
    if (href) out.push({ href, type, title: a["title"] ?? null });
  }
  return out;
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

/** Canonical form for de-duplication: lowercase origin, drop fragment. */
function canonical(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return rawUrl;
  }
}

async function fetchText(url: string, fetchImpl: FetchLike): Promise<string> {
  const res = await fetchImpl(url, { headers: { "user-agent": userAgent() } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

async function headOk(url: string, fetchImpl: FetchLike): Promise<boolean> {
  try {
    const res = await fetchImpl(url, {
      method: "HEAD",
      headers: { "user-agent": userAgent() },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Discover candidate feeds for one outlet homepage. `fetchImpl` defaults to the
 * global fetch and is injectable so tests avoid the network.
 */
export async function discoverFeeds(
  homepage: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<FeedCandidate[]> {
  const out: FeedCandidate[] = [];

  const html = await fetchText(homepage, fetchImpl);
  for (const link of parseAlternateLinks(html)) {
    out.push({ url: new URL(link.href, homepage).toString(), title: link.title });
  }

  for (const path of COMMON_PATHS) {
    const url = new URL(path, homepage).toString();
    if (await headOk(url, fetchImpl)) out.push({ url, title: null });
  }

  return dedupeBy(out, (c) => canonical(c.url));
}

// ---------------------------------------------------------------------------
// Normalisation (SPEC.md 5.3) — Phase 1
//
// Pure functions over a single raw feed item. The 300-char standfirst
// truncation and HTML stripping are compliance controls (never persist full
// bodies), applied here before any database write.
// ---------------------------------------------------------------------------

export const STANDFIRST_MAX = 300;
export const MIN_HEADLINE = 15;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, code: string) => {
    if (code.startsWith("#")) {
      const isHex = code[1]?.toLowerCase() === "x";
      const cp = isHex ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ");
}

function cleanText(input: string): string {
  return decodeEntities(stripHtml(input)).replace(/\s+/g, " ").trim();
}

/** Clean headline; null if under {@link MIN_HEADLINE} characters after cleaning. */
export function normaliseHeadline(raw: string): string | null {
  const clean = cleanText(raw);
  return clean.length >= MIN_HEADLINE ? clean : null;
}

/** Clean and truncate standfirst at {@link STANDFIRST_MAX} on a word boundary. */
export function normaliseStandfirst(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = cleanText(raw);
  if (!clean) return null;
  if (clean.length <= STANDFIRST_MAX) return clean;
  const truncated = clean.slice(0, STANDFIRST_MAX);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trimEnd();
}

const TRACKING_PARAM = /^(utm_.*|fbclid|ref|gclid|mc_cid|mc_eid)$/i;

/** Strip tracking parameters (utm_*, fbclid, ref, …). */
export function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const drop: string[] = [];
    u.searchParams.forEach((_value, key) => {
      if (TRACKING_PARAM.test(key)) drop.push(key);
    });
    for (const key of drop) u.searchParams.delete(key);
    return u.toString();
  } catch {
    return raw;
  }
}

/** Feed-declared GUID if present, else SHA-256 of the canonical URL. */
export function sourceGuid(
  declared: string | null | undefined,
  canonicalUrl: string,
): string {
  const d = declared?.trim();
  return d ? d : sha256(canonicalUrl);
}

/** SHA-256 of headline + standfirst; the embedding cache key. */
export function contentHash(headline: string, standfirst: string | null): string {
  return sha256(`${headline}\n${standfirst ?? ""}`);
}

/**
 * Parse a publication date to a Date. If absent, unparseable, or in the future,
 * substitute `now` and flag it (SPEC 5.3).
 */
export function parsePublished(
  raw: string | null | undefined,
  now: Date = new Date(),
): { publishedAt: Date; substituted: boolean } {
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime()) && d.getTime() <= now.getTime()) {
      return { publishedAt: d, substituted: false };
    }
  }
  return { publishedAt: now, substituted: true };
}

/**
 * Language: feed declaration if present, else the outlet's primary language.
 * Text-based detection (SPEC 5.3) is deferred — DECISIONS.md D-007.
 */
export function resolveLanguage(
  declared: string | null | undefined,
  outletLanguage: string,
): string {
  const d = declared?.trim().toLowerCase();
  return d ? d.slice(0, 2) : outletLanguage;
}

export type RawFeedItem = {
  title?: string | null;
  link?: string | null;
  guid?: string | null;
  isoDate?: string | null;
  pubDate?: string | null;
  contentSnippet?: string | null;
  summary?: string | null;
  content?: string | null;
  language?: string | null;
  creator?: string | null;
};

export type NormalisedItem = {
  sourceGuid: string;
  url: string;
  headline: string;
  standfirst: string | null;
  publishedAt: Date;
  publishedSubstituted: boolean;
  language: string;
  contentHash: string;
  creator: string | null;
};

/**
 * Normalise one raw feed item, or null if it lacks a usable headline or link.
 * Composes the field rules above (SPEC Table 5).
 */
export function normaliseItem(
  raw: RawFeedItem,
  outletLanguage: string,
  now: Date = new Date(),
): NormalisedItem | null {
  const headline = normaliseHeadline(raw.title ?? "");
  if (!headline) return null;

  const link = raw.link?.trim();
  if (!link) return null;
  const url = cleanUrl(link);

  const standfirst = normaliseStandfirst(
    raw.contentSnippet ?? raw.summary ?? raw.content ?? null,
  );
  const { publishedAt, substituted } = parsePublished(
    raw.isoDate ?? raw.pubDate ?? null,
    now,
  );

  return {
    sourceGuid: sourceGuid(raw.guid, url),
    url,
    headline,
    standfirst,
    publishedAt,
    publishedSubstituted: substituted,
    language: resolveLanguage(raw.language, outletLanguage),
    contentHash: contentHash(headline, standfirst),
    creator: raw.creator?.trim() || null,
  };
}
