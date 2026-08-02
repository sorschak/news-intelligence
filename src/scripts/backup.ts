/**
 * Logical backup of the irreplaceable data (operations hardening).
 *
 *   npm run backup
 *
 * Dumps the digest archive and reader feedback to JSON under BACKUP_DIR
 * (default ./backup); in CI these files are uploaded as a workflow artifact.
 * The feed registry is re-seedable from src/lib/registry.ts, and scores/claims
 * are re-derivable, so neither is included — everything dumped here is data that
 * cannot be regenerated if the Neon project is lost.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { closeSql, getSql } from "../lib/db.js";
import { optionalEnv } from "../lib/env.js";

const dir = optionalEnv("BACKUP_DIR", "backup");
mkdirSync(dir, { recursive: true });

const sql = getSql();

const digests = await sql`SELECT * FROM digest ORDER BY id`;
writeFileSync(join(dir, "digest.json"), JSON.stringify(digests, null, 2), "utf8");

const feedback = await sql`SELECT * FROM counter_feedback ORDER BY id`;
writeFileSync(join(dir, "counter_feedback.json"), JSON.stringify(feedback, null, 2), "utf8");

console.log(
  `backup: ${digests.length} digest(s), ${feedback.length} feedback row(s) -> ${dir}/`,
);
await closeSql();
