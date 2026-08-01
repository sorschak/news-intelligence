/**
 * Transactional mail (SPEC.md 3.2, FR-12) — Phase 5.
 *
 * One recipient, one message a day. Provider-configurable (default Resend;
 * Postmark also supported) via `MAIL_PROVIDER` — DECISIONS.md D-019. Delivery is
 * best-effort per NFR-03 (a missed digest is acceptable; a wrong one is not).
 */

import { optionalEnv, requireEnv } from "./env.js";

export type MailFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

const defaultFetch = fetch as unknown as MailFetch;

export type SendResult = { ok: boolean; status: number; detail: string };

async function sendResend(
  subject: string,
  html: string,
  fetchImpl: MailFetch,
): Promise<SendResult> {
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${requireEnv("MAIL_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: requireEnv("MAIL_FROM"),
      to: [requireEnv("DIGEST_RECIPIENT")],
      subject,
      html,
    }),
  });
  return { ok: res.ok, status: res.status, detail: await res.text() };
}

async function sendPostmark(
  subject: string,
  html: string,
  fetchImpl: MailFetch,
): Promise<SendResult> {
  const res = await fetchImpl("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "x-postmark-server-token": requireEnv("MAIL_API_KEY"),
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      From: requireEnv("MAIL_FROM"),
      To: requireEnv("DIGEST_RECIPIENT"),
      Subject: subject,
      HtmlBody: html,
      MessageStream: "outbound",
    }),
  });
  return { ok: res.ok, status: res.status, detail: await res.text() };
}

/** Send the rendered digest to the single configured recipient. */
export async function sendDigest(
  subject: string,
  html: string,
  fetchImpl: MailFetch = defaultFetch,
): Promise<SendResult> {
  const provider = optionalEnv("MAIL_PROVIDER", "resend").toLowerCase();
  switch (provider) {
    case "resend":
      return sendResend(subject, html, fetchImpl);
    case "postmark":
      return sendPostmark(subject, html, fetchImpl);
    default:
      throw new Error(`Unknown MAIL_PROVIDER "${provider}" (expected resend | postmark)`);
  }
}
