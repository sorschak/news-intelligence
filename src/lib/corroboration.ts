/**
 * Corroboration index (SPEC.md 7.3 and 7.3.1) — Phase 3.
 *
 * Two bases (SPEC 7.3.1): the outlet-count index tests whether an *event* is
 * independently attested; it is inapplicable to a cluster anchored to a primary
 * *publication*, which is itself the source. Applying the outlet index to a
 * significant paper carried by three specialist desks would score it near zero
 * and cancel the contribution dimension — the interaction that made the fifth
 * dimension pointless if unaddressed. Getting the basis right is load-bearing
 * (CLAUDE.md).
 */

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export type ClusterCounts = {
  originatorCount: number; // unknowns weigh 0.5
  wireCount: number;
  regionCount: number;
  languageCount: number;
};

/** Corroboration on the outlets basis (SPEC 7.3). Saturates at six originators. */
export function corroborationByOutlets(c: ClusterCounts): number {
  const base = Math.min(1, Math.log1p(c.originatorCount) / Math.log1p(6));

  let wire = 0;
  if (c.wireCount >= 1) wire += 0.2;
  if (c.wireCount >= 2) wire += 0.1;

  const geo = 0.1 * Math.min(1, (c.regionCount - 1) / 3);
  const lang = 0.05 * Math.min(1, (c.languageCount - 1) / 2);

  return round2(Math.min(1, 0.65 * base + wire + geo + lang));
}

// Curated and deliberately conservative (SPEC 7.3.1). A predatory venue admitted
// here would convert an unreviewed claim into a corroborated one by fiat. Seed
// set; expand toward ~200 (DECISIONS.md D-014). Names are lowercased.
const PREPRINT_HOSTS = new Set(["arxiv", "biorxiv", "medrxiv", "ssrn", "chemrxiv"]);

const PEER_REVIEWED_VENUES = new Set<string>([
  "nature",
  "science",
  "cell",
  "the lancet",
  "new england journal of medicine",
  "nejm",
  "pnas",
  "proceedings of the national academy of sciences",
  "jama",
  "bmj",
  "nature medicine",
  "nature energy",
  "nature climate change",
  "nature communications",
  "physical review letters",
  "journal of the american chemical society",
  "the astrophysical journal",
  "science advances",
  "the lancet oncology",
  "nature biotechnology",
]);

export type PublicationInputs = {
  primaryRef: string | null;
  hasIndependentExpertComment: boolean;
  mentionsReplication: boolean;
};

/** Normalise a primary_ref to a venue key. DOI→venue resolution is deferred (D-014). */
export function venueOf(ref: string): string {
  return ref.trim().toLowerCase();
}

/** Corroboration on the primary-publication basis (SPEC 7.3.1). */
export function corroborationByPublication(p: PublicationInputs): number {
  const ref = (p.primaryRef ?? "").toLowerCase();

  let base: number;
  if ([...PREPRINT_HOSTS].some((h) => ref.includes(h))) {
    base = 0.35; // not yet reviewed
  } else if (PEER_REVIEWED_VENUES.has(venueOf(ref))) {
    base = 0.75;
  } else {
    base = 0.5; // identifiable but unclassified
  }

  const independent = p.hasIndependentExpertComment ? 0.15 : 0;
  const replicated = p.mentionsReplication ? 0.1 : 0;

  return round2(Math.min(1, base + independent + replicated));
}

export type Basis = "outlets" | "primary_publication";

/**
 * A cluster takes the primary_publication basis when it has a non-null
 * primary_ref and at least one specialist originator; otherwise outlets (SPEC
 * 7.3.1).
 */
export function chooseBasis(
  primaryRef: string | null,
  hasSpecialistOriginator: boolean,
): Basis {
  return primaryRef && hasSpecialistOriginator ? "primary_publication" : "outlets";
}
