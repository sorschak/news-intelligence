// App-local token verifier — mirrors src/lib/feedback.ts signToken exactly
// (HMAC-SHA256 base64url over a JSON payload, formatted "<body>.<sig>").
import { createHmac, timingSafeEqual } from "node:crypto";

export type FeedbackPayload = { digestId: string; clusterId: string; exp: number };

function sign(body: string): string {
  const secret = process.env.FEEDBACK_SIGNING_SECRET;
  if (!secret) throw new Error("FEEDBACK_SIGNING_SECRET is not set");
  return createHmac("sha256", secret).update(body).digest("base64url");
}

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
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as FeedbackPayload;
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
