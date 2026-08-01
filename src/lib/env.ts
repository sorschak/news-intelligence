/**
 * Environment loading and access.
 *
 * Locally, values come from `.env.local` (never committed; see CLAUDE.md). In
 * GitHub Actions and Vercel they come from the process environment (repository
 * secrets / project env vars), so a missing file is not an error.
 *
 * Accessors are functions rather than eagerly-read constants so a script that
 * needs only `DATABASE_URL` does not fail because `MAIL_API_KEY` is unset.
 */

import { config } from "dotenv";

let loaded = false;

/** Load `.env.local` (preferred) then `.env`, without overriding real env. */
export function loadDotenv(): void {
  if (loaded) return;
  config({ path: ".env.local" });
  config(); // .env fallback; dotenv never overrides already-set variables
  loaded = true;
}

export function requireEnv(name: string): string {
  loadDotenv();
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Required environment variable ${name} is unset. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function optionalEnv(name: string, fallback = ""): string {
  loadDotenv();
  return process.env[name]?.trim() || fallback;
}

/** Embedding vector dimensionality (SPEC.md 3.3); defaults to 1024. */
export function embeddingDims(): number {
  const raw = optionalEnv("EMBEDDING_DIMS", "1024");
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`EMBEDDING_DIMS must be a positive integer, got "${raw}"`);
  }
  return n;
}

/**
 * User-Agent for every outbound feed request (non-negotiable constraint #5):
 * identifies the system and gives a contact address.
 */
export function userAgent(): string {
  const contact = optionalEnv("FEED_CONTACT_EMAIL", "unknown");
  return `NewsIntel/1.2 (personal research; contact: ${contact})`;
}
