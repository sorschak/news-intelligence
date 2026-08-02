import Link from "next/link";

import { getSql } from "../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DigestPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { date } = await params;
  const { kind = "daily" } = await searchParams;

  const sql = getSql();
  const rows = await sql<{ html: string }[]>`
    SELECT html FROM digest WHERE edition_date = ${date} AND kind = ${kind} LIMIT 1
  `;
  const html = rows[0]?.html;

  if (!html) {
    return (
      <main>
        <p>No {kind} digest found for {date}.</p>
        <p>
          <Link href="/">← Back to archive</Link>
        </p>
      </main>
    );
  }

  // The stored digest is a self-contained HTML document rendered by the deliver job.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
