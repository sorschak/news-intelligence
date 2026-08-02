// App-local Neon client (bundler-friendly, no .js-extension chain). Next loads
// .env.local locally and injects Vercel env in production, so no dotenv here.
import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

export function getSql() {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  sql = postgres(url, { prepare: false, ssl: "require", max: 5, idle_timeout: 20 });
  return sql;
}
