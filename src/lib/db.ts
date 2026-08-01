/**
 * Database access — a single `postgres` (porsager) client over Neon's POOLED
 * endpoint (SPEC.md 3.2, 4). No ORM; SQL stays visible.
 *
 * `prepare: false` is required: Neon's pooled endpoint runs PgBouncer in
 * transaction mode, which does not support prepared statements. Leaving prepare
 * on produces intermittent "prepared statement does not exist" errors under the
 * pooling the serverless surfaces depend on.
 */

import postgres from "postgres";

import { requireEnv } from "./env.js";

export type Sql = ReturnType<typeof postgres>;

let sql: Sql | null = null;

export function getSql(): Sql {
  if (sql) return sql;
  sql = postgres(requireEnv("DATABASE_URL"), {
    prepare: false,
    // Neon requires TLS; the connection string carries sslmode=require, and
    // this makes the intent explicit for clients that ignore the parameter.
    ssl: "require",
    max: 10,
    idle_timeout: 20,
  });
  return sql;
}

/** Close the pool. Call at the end of a short-lived job or script. */
export async function closeSql(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = null;
  }
}
