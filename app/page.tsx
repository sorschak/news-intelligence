import Link from "next/link";

import { getSql } from "./lib/db";

// The archive reads live from Neon on each request (FR-13).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = { edition_date: string; kind: string; clusters: number | null };

export default async function Home() {
  const sql = getSql();
  const digests = await sql<Row[]>`
    SELECT to_char(edition_date, 'YYYY-MM-DD') AS edition_date,
           kind,
           array_length(cluster_ids, 1) AS clusters
    FROM digest
    ORDER BY generated_at DESC
    LIMIT 60
  `;

  return (
    <main>
      <h1>News Intelligence — Archive</h1>
      {digests.length === 0 ? (
        <p>No digests published yet.</p>
      ) : (
        <ul>
          {digests.map((d) => (
            <li key={`${d.edition_date}-${d.kind}`}>
              <Link href={`/digest/${d.edition_date}?kind=${d.kind}`}>
                {d.edition_date} — {d.kind}
              </Link>{" "}
              ({d.clusters ?? 0} clusters)
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
