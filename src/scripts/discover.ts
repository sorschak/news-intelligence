/**
 * Discover candidate feeds for every active outlet and store them INACTIVE for
 * manual confirmation (SPEC.md 5.1, 11).
 *
 *   npm run discover
 *
 * Confirmation is manual: review the candidates and set `feed.active = true` on
 * the ones to poll. The Phase 1 ingest job reads only active feeds. Re-running
 * is idempotent (ON CONFLICT on the unique feed URL).
 */

import { closeSql, getSql } from "../lib/db.js";
import { discoverFeeds } from "../lib/feeds.js";
import { homepageFor } from "../lib/registry.js";

const sql = getSql();

const outlets = await sql<{ id: number; name: string }[]>`
  SELECT id, name FROM outlet WHERE active = true ORDER BY name
`;

if (outlets.length === 0) {
  console.log("No outlets in the database. Run 'npm run seed' first.");
  await closeSql();
  process.exit(1);
}

let totalFound = 0;
let totalNew = 0;

for (const outlet of outlets) {
  const homepage = homepageFor(outlet.name);
  if (!homepage) {
    console.log(`  ${outlet.name}: no homepage on record, skipped`);
    continue;
  }

  let candidates;
  try {
    candidates = await discoverFeeds(homepage);
  } catch (err) {
    console.log(`  ${outlet.name}: fetch failed (${(err as Error).message})`);
    continue;
  }

  let added = 0;
  for (const candidate of candidates) {
    const result = await sql`
      INSERT INTO feed (outlet_id, url, section, active)
      VALUES (${outlet.id}, ${candidate.url}, ${null}, false)
      ON CONFLICT (url) DO NOTHING
    `;
    added += result.count;
  }

  totalFound += candidates.length;
  totalNew += added;
  console.log(`  ${outlet.name}: ${candidates.length} found, ${added} new`);
}

console.log(
  `\nDiscovery complete: ${totalFound} candidates, ${totalNew} new. ` +
    `All stored inactive — confirm and activate manually before Phase 1.`,
);
await closeSql();
