import { getSql } from "../../../lib/db";
import { verifyToken } from "../../../lib/feedback";

// Phase 5a feedback endpoint (SPEC.md 9.5.4): a plain signed GET link, no login.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(message: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><body style="font:16px/1.5 Georgia,serif;max-width:32rem;margin:3rem auto;padding:0 1rem">${message}</body>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ verdict: string }> },
): Promise<Response> {
  const { verdict } = await params;
  if (verdict !== "valued" && verdict !== "indifferent") {
    return new Response("Bad verdict", { status: 400 });
  }

  const token = new URL(req.url).searchParams.get("t");
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return new Response("Invalid or expired link", { status: 403 });
  }

  const sql = getSql();
  await sql`
    INSERT INTO counter_feedback (digest_id, cluster_id, verdict)
    VALUES (${payload.digestId}, ${payload.clusterId}, ${verdict})
    ON CONFLICT (digest_id, cluster_id)
    DO UPDATE SET verdict = EXCLUDED.verdict, recorded_at = now()
  `;

  return page(`<p>Recorded: <strong>${verdict}</strong>. Thank you — this tunes nothing automatically; it is reported for your own review.</p>`);
}
