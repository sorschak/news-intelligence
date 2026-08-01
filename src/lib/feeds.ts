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
