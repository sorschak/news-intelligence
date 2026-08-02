/**
 * Signed feedback tokens (SPEC.md 9.5.4) — Phase 5a.
 *
 * Counter-edition items carry two plain GET links (valued / indifferent). The
 * links need no login — the system has one reader — but must not be forgeable or
 * replayable indefinitely, so each carries an HMAC-signed, expiring token
 * encoding the digest and cluster. Signing (deliver/counter job) and verifying
 * (Vercel route) share FEEDBACK_SIGNING_SECRET.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { requireEnv } from "./env.js";

export type FeedbackPayload = { digestId: string; clusterId: string; exp: number };

const DEFAULT_TTL_MS = 30 * 24 * 3600 * 1000; // 30-day expiry (SPEC 9.5.4)

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

function b64urlDecode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

function sign(body: string): string {
  return createHmac("sha256", requireEnv("FEEDBACK_SIGNING_SECRET")).update(body).digest("base64url");
}

/** Create a signed token binding a cluster's feedback to a digest, expiring in ttlMs. */
export function signToken(
  digestId: string,
  clusterId: string,
  ttlMs: number = DEFAULT_TTL_MS,
  now: number = Date.now(),
): string {
  const body = b64urlEncode(JSON.stringify({ digestId, clusterId, exp: now + ttlMs }));
  return `${body}.${sign(body)}`;
}

/** Verify a token: valid signature and not expired. Returns the payload or null. */
export function verifyToken(token: string, now: number = Date.now()): FeedbackPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload: FeedbackPayload;
  try {
    payload = JSON.parse(b64urlDecode(body)) as FeedbackPayload;
  } catch {
    return null;
  }
  if (
    typeof payload.digestId !== "string" ||
    typeof payload.clusterId !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp < now
  ) {
    return null;
  }
  return payload;
}
