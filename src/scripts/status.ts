/**
 * Summarise registry and ingestion counts, and the Phase 0 exit gate.
 *
 *   npm run status
 */

import { closeSql, getSql } from "../lib/db.js";

const sql = getSql();

const rows = await sql<
  { outlets: number; feeds: number; active_feeds: number; items: number }[]
>`
  SELECT
    (SELECT count(*) FROM outlet)::int              AS outlets,
    (SELECT count(*) FROM feed)::int                AS feeds,
    (SELECT count(*) FROM feed WHERE active)::int   AS active_feeds,
    (SELECT count(*) FROM item)::int                AS items
`;

const r = rows[0];
if (!r) throw new Error("status query returned no row");

console.log(`outlets:       ${r.outlets}`);
console.log(`feeds:         ${r.feeds} (${r.active_feeds} active)`);
console.log(`items:         ${r.items}`);
console.log(
  `\nPhase 0 exit: 140+ active feeds returning valid items for 72h ` +
    `(currently ${r.active_feeds} active feeds).`,
);
await closeSql();
