/**
 * Seed the manually curated feed URLs (SPEC.md 5.1, 11) — Phase 0.
 *
 *   npm run seed-feeds
 *
 * Inserts CURATED_FEEDS active (they are hand-confirmed), matching each to its
 * outlet by name. Idempotent: ON CONFLICT on the unique feed URL. Run after
 * `seed` (outlets must exist) and alongside `discover`.
 */

import { CURATED_FEEDS } from "../lib/curated-feeds.js";
import { closeSql, getSql } from "../lib/db.js";

const sql = getSql();

const outlets = await sql<{ id: number; name: string }[]>`SELECT id, name FROM outlet`;
const idByName = new Map(outlets.map((o) => [o.name, o.id]));

let added = 0;
let skipped = 0;
for (const feed of CURATED_FEEDS) {
  const outletId = idByName.get(feed.outlet);
  if (outletId === undefined) {
    console.log(`  no outlet "${feed.outlet}" — skipped ${feed.url}`);
    skipped++;
    continue;
  }
  const result = await sql`
    INSERT INTO feed (outlet_id, url, section, active)
    VALUES (${outletId}, ${feed.url}, ${feed.section}, true)
    ON CONFLICT (url) DO NOTHING
  `;
  added += result.count;
}

console.log(
  `Curated feeds: ${added} added (${CURATED_FEEDS.length} in list, ${skipped} unmatched).`,
);
await closeSql();
