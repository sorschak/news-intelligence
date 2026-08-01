/**
 * Outlet registry seed (SPEC.md Section 11).
 *
 * Tier 1 = wire, tier 2 = originating newsroom, tier 3 = aggregator (none
 * seeded). `specialist` governs eligibility for the `primary_publication`
 * corroboration basis (SPEC.md 7.3.1).
 *
 * `homepage` (needed by discovery) and `country` (the schema's `outlet.country`
 * is NOT NULL) are added metadata not present in the spec table — DECISIONS.md
 * D-003. `language` is the primary edition; per-item language is detected at
 * ingestion.
 */

import { getSql } from "./db.js";

export type OutletSeed = {
  name: string;
  tier: 1 | 2 | 3;
  region: string;
  country: string; // ISO 3166-1 alpha-2
  language: string; // ISO 639-1, primary edition
  isWire: boolean;
  specialist: boolean;
  homepage: string;
};

const wire = (
  name: string,
  region: string,
  country: string,
  language: string,
  homepage: string,
): OutletSeed => ({
  name,
  tier: 1,
  region,
  country,
  language,
  isWire: true,
  specialist: false,
  homepage,
});

const paper = (
  name: string,
  region: string,
  country: string,
  language: string,
  homepage: string,
  specialist = false,
): OutletSeed => ({
  name,
  tier: 2,
  region,
  country,
  language,
  isWire: false,
  specialist,
  homepage,
});

// SPEC.md Section 11 — ~51 outlets.
export const OUTLETS: readonly OutletSeed[] = [
  wire("Reuters", "Global", "GB", "en", "https://www.reuters.com"),
  wire("Associated Press", "Global", "US", "en", "https://apnews.com"),
  wire("Agence France-Presse", "Global", "FR", "en", "https://www.afp.com/en"),
  wire("Bloomberg", "Global", "US", "en", "https://www.bloomberg.com"),
  paper("Financial Times", "UK", "GB", "en", "https://www.ft.com"),
  paper("The Economist", "UK", "GB", "en", "https://www.economist.com"),
  paper("BBC News", "UK", "GB", "en", "https://www.bbc.com/news"),
  paper("The Guardian", "UK", "GB", "en", "https://www.theguardian.com"),
  paper("The New York Times", "US", "US", "en", "https://www.nytimes.com"),
  paper("The Wall Street Journal", "US", "US", "en", "https://www.wsj.com"),
  paper("The Washington Post", "US", "US", "en", "https://www.washingtonpost.com"),
  paper("ProPublica", "US", "US", "en", "https://www.propublica.org"),
  paper("The Globe and Mail", "Canada", "CA", "en", "https://www.theglobeandmail.com"),
  paper("CBC / Radio-Canada", "Canada", "CA", "en", "https://www.cbc.ca"),
  paper("Le Devoir", "Canada", "CA", "fr", "https://www.ledevoir.com"),
  paper("La Presse", "Canada", "CA", "fr", "https://www.lapresse.ca"),
  paper("National Post", "Canada", "CA", "en", "https://nationalpost.com"),
  paper("The Logic", "Canada", "CA", "en", "https://thelogic.co", true),
  paper("Le Monde", "France", "FR", "fr", "https://www.lemonde.fr"),
  paper("Les Échos", "France", "FR", "fr", "https://www.lesechos.fr"),
  paper("Frankfurter Allgemeine Zeitung", "Germany", "DE", "de", "https://www.faz.net"),
  paper("Süddeutsche Zeitung", "Germany", "DE", "de", "https://www.sueddeutsche.de"),
  paper("Handelsblatt", "Germany", "DE", "de", "https://www.handelsblatt.com"),
  paper("Neue Zürcher Zeitung", "Switzerland", "CH", "de", "https://www.nzz.ch"),
  paper("Der Standard", "Austria", "AT", "de", "https://www.derstandard.at"),
  paper("Die Presse", "Austria", "AT", "de", "https://www.diepresse.com"),
  paper("El País", "Spain", "ES", "es", "https://elpais.com"),
  paper("Corriere della Sera", "Italy", "IT", "it", "https://www.corriere.it"),
  paper("Politico Europe", "EU", "BE", "en", "https://www.politico.eu"),
  paper("Nikkei Asia", "Japan", "JP", "en", "https://asia.nikkei.com"),
  paper("Asahi Shimbun", "Japan", "JP", "en", "https://www.asahi.com/ajw"),
  paper("Caixin", "China", "CN", "en", "https://www.caixinglobal.com"),
  paper("South China Morning Post", "Hong Kong", "HK", "en", "https://www.scmp.com"),
  paper("The Hindu", "India", "IN", "en", "https://www.thehindu.com"),
  paper("The Straits Times", "Singapore", "SG", "en", "https://www.straitstimes.com"),
  paper("Al Jazeera English", "Qatar", "QA", "en", "https://www.aljazeera.com"),
  paper("Haaretz", "Israel", "IL", "en", "https://www.haaretz.com"),
  paper("Daily Maverick", "South Africa", "ZA", "en", "https://www.dailymaverick.co.za"),
  paper("Premium Times", "Nigeria", "NG", "en", "https://www.premiumtimesng.com"),
  paper("Folha de S.Paulo", "Brazil", "BR", "pt", "https://www.folha.uol.com.br"),
  paper("Reforma", "Mexico", "MX", "es", "https://www.reforma.com"),
  paper("ABC Australia", "Australia", "AU", "en", "https://www.abc.net.au/news"),
  paper("Australian Financial Review", "Australia", "AU", "en", "https://www.afr.com"),
  paper("Meduza", "Latvia", "LV", "en", "https://meduza.io/en"),
  paper("The Kyiv Independent", "Ukraine", "UA", "en", "https://kyivindependent.com"),
  paper("Lawfare", "US", "US", "en", "https://www.lawfaremedia.org", true),
  paper("STAT News", "US", "US", "en", "https://www.statnews.com", true),
  paper("MIT Technology Review", "US", "US", "en", "https://www.technologyreview.com", true),
  paper("Nature news", "UK", "GB", "en", "https://www.nature.com/news", true),
  paper("Science news", "US", "US", "en", "https://www.science.org/news", true),
  paper("Bellingcat", "Netherlands", "NL", "en", "https://www.bellingcat.com", true),
];

/** Homepage for a seeded outlet name (used by discovery), or null. */
export function homepageFor(name: string): string | null {
  return OUTLETS.find((o) => o.name === name)?.homepage ?? null;
}

/**
 * Insert the registry, skipping outlets already present. Returns rows added.
 * Idempotent (SPEC.md 3.1): re-running inserts nothing new.
 */
export async function seedOutlets(): Promise<number> {
  const sql = getSql();
  let added = 0;
  for (const o of OUTLETS) {
    const result = await sql`
      INSERT INTO outlet (name, tier, region, country, language, is_wire, is_specialist)
      VALUES (${o.name}, ${o.tier}, ${o.region}, ${o.country},
              ${o.language}, ${o.isWire}, ${o.specialist})
      ON CONFLICT (name) DO NOTHING
    `;
    added += result.count;
  }
  return added;
}
