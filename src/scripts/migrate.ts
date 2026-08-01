/**
 * Apply (or roll back) numbered SQL migrations with node-pg-migrate.
 *
 *   npm run migrate         apply all pending migrations
 *   npm run migrate:down    roll back the most recent migration
 *
 * CLAUDE.md: SQL lives in `.sql` migration files; no schema changes in
 * application code. Applied migrations are tracked in the `pgmigrations` table.
 */

import runner from "node-pg-migrate";

import { requireEnv } from "../lib/env.js";

const direction = process.argv[2] === "down" ? "down" : "up";

await runner({
  databaseUrl: requireEnv("DATABASE_URL"),
  dir: "migrations",
  direction,
  migrationsTable: "pgmigrations",
  count: direction === "down" ? 1 : Infinity,
});

console.log(`Migrations ${direction} complete.`);
process.exit(0);
