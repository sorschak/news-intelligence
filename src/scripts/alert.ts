/**
 * Failure alert (operations hardening).
 *
 *   npm run alert
 *
 * Invoked from a workflow's `if: failure()` step so a broken job reaches the
 * operator by email instead of dying as a red run nobody looks at. Best-effort:
 * it never throws and never exits non-zero, so it cannot compound the failure it
 * is reporting. Reuses the same Resend/Postmark path as the digest (lib/mail).
 */

import { optionalEnv } from "../lib/env.js";
import { sendDigest } from "../lib/mail.js";

const job = optionalEnv("JOB_NAME", "a pipeline job");
const runUrl = optionalEnv("GITHUB_RUN_URL", "");

const html = [
  `<p>The <strong>${job}</strong> job failed in the News Intelligence pipeline.</p>`,
  runUrl ? `<p><a href="${runUrl}">View the failed run</a></p>` : "",
  "<p>If several jobs fail together, check the database, the API keys, and the " +
    "GitHub Actions minute allowance.</p>",
].join("");

try {
  const res = await sendDigest(`⚠️ News Intelligence: ${job} failed`, html);
  console.log(
    res.ok ? `alert: sent (${res.status}).` : `alert: send failed (${res.status}): ${res.detail}`,
  );
} catch (err) {
  console.error("alert: could not send failure notification:", err);
}
