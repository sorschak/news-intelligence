/**
 * Ingestion job (SPEC.md Section 5) — Phase 1.
 *
 * Runs on GitHub Actions every 30 minutes. Polls active feeds with bounded
 * concurrency and conditional request headers, normalises and deduplicates
 * items, persists them, and tracks per-feed failures. A feed failing five
 * consecutive polls is deactivated (reported later in the operations footer).
 *
 * Idempotent (SPEC 3.1): a repeat poll returns 304 or inserts nothing new
 * (ON CONFLICT on the feed's unique source_guid). Not gated on local hour —
 * ingestion runs continuously, unlike deliver/counter.
 */

import Parser from "rss-parser";
import { request } from "undici";

import { closeSql, getSql, type Sql } from "../lib/db.js";
import { userAgent } from "../lib/env.js";
import { normaliseItem, type RawFeedItem } from "../lib/feeds.js";

const CONCURRENCY = 12;
const FAILURE_LIMIT = 5;

type FeedRow = {
  id: number;
  url: string;
  etag: string | null;
  last_modified: string | null;
  outlet_id: number;
  outlet_language: string;
};

type Totals = { polled: number; notModified: number; failed: number; newItems: number };

const parser = new Parser();

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      if (item !== undefined) await fn(item);
    }
  });
  await Promise.all(workers);
}

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function markPolled(
  sql: Sql,
  feed: FeedRow,
  next: { etag: string | null; lastModified: string | null },
): Promise<void> {
  await sql`
    UPDATE feed
    SET last_polled_at = now(), consecutive_failures = 0,
        etag = ${next.etag}, last_modified = ${next.lastModified}
    WHERE id = ${feed.id}
  `;
}

async function markNotModified(sql: Sql, feed: FeedRow): Promise<void> {
  await sql`
    UPDATE feed
    SET last_polled_at = now(), consecutive_failures = 0
    WHERE id = ${feed.id}
  `;
}

async function markFailure(sql: Sql, feed: FeedRow): Promise<void> {
  // Deactivate on reaching the failure limit (SPEC 5.2).
  await sql`
    UPDATE feed
    SET consecutive_failures = consecutive_failures + 1,
        active = (consecutive_failures + 1 < ${FAILURE_LIMIT}),
        last_polled_at = now()
    WHERE id = ${feed.id}
  `;
}

async function persistItems(sql: Sql, feed: FeedRow, xml: string): Promise<number> {
  const parsed = await parser.parseString(xml);
  let added = 0;

  for (const rawItem of parsed.items) {
    const item = normaliseItem(rawItem as RawFeedItem, feed.outlet_language);
    if (!item) continue;

    const result = await sql`
      INSERT INTO item (
        feed_id, outlet_id, source_guid, url, headline, standfirst,
        published_at, language, content_hash
      ) VALUES (
        ${feed.id}, ${feed.outlet_id}, ${item.sourceGuid}, ${item.url},
        ${item.headline}, ${item.standfirst}, ${item.publishedAt},
        ${item.language}, ${item.contentHash}
      )
      ON CONFLICT (feed_id, source_guid) DO NOTHING
    `;
    added += result.count;
  }
  return added;
}

async function pollFeed(sql: Sql, feed: FeedRow, totals: Totals): Promise<void> {
  const headers: Record<string, string> = { "user-agent": userAgent() };
  if (feed.etag) headers["if-none-match"] = feed.etag;
  if (feed.last_modified) headers["if-modified-since"] = feed.last_modified;

  try {
    const res = await request(feed.url, { method: "GET", headers, maxRedirections: 2 });

    if (res.statusCode === 304) {
      await markNotModified(sql, feed);
      totals.notModified++;
      return;
    }
    if (res.statusCode >= 400) {
      await res.body.dump();
      await markFailure(sql, feed);
      totals.failed++;
      return;
    }

    const xml = await res.body.text();
    const added = await persistItems(sql, feed, xml);
    await markPolled(sql, feed, {
      etag: headerValue(res.headers["etag"]),
      lastModified: headerValue(res.headers["last-modified"]),
    });
    totals.polled++;
    totals.newItems += added;
  } catch {
    await markFailure(sql, feed);
    totals.failed++;
  }
}

async function main(): Promise<void> {
  const sql = getSql();
  const feeds = await sql<FeedRow[]>`
    SELECT f.id, f.url, f.etag, f.last_modified, f.outlet_id,
           o.language AS outlet_language
    FROM feed f
    JOIN outlet o ON o.id = f.outlet_id
    WHERE f.active = true
  `;

  const totals: Totals = { polled: 0, notModified: 0, failed: 0, newItems: 0 };
  await mapWithConcurrency([...feeds], CONCURRENCY, (feed) => pollFeed(sql, feed, totals));

  console.log(
    `ingest: ${feeds.length} feeds — ${totals.polled} updated, ` +
      `${totals.notModified} unchanged, ${totals.failed} failed, ` +
      `${totals.newItems} new items.`,
  );
  await closeSql();
}

main().catch(async (err: unknown) => {
  console.error("ingest failed:", err);
  await closeSql();
  process.exit(1);
});
