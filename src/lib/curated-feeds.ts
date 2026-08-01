/**
 * Manually curated feed URLs (SPEC.md 5.1, 11) — Phase 0 registry confirmation.
 *
 * Automated discovery (`discoverFeeds`) only finds feeds a homepage advertises.
 * Many major outlets serve RSS at stable, well-known endpoints they do not
 * advertise (and several block homepage requests outright), so those feeds are
 * curated here by hand — the "manual confirmation" the spec anticipates. `outlet`
 * must match an OUTLETS name in registry.ts; these are seeded active by
 * `seed-feeds`.
 */

export type CuratedFeed = { outlet: string; url: string; section: string | null };

export const CURATED_FEEDS: readonly CuratedFeed[] = [
  // BBC News
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", section: "world" },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml", section: "business" },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", section: "technology" },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", section: "science" },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/politics/rss.xml", section: "politics" },

  // The New York Times
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", section: "world" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", section: "business" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml", section: "economy" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml", section: "science" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", section: "technology" },

  // The Guardian
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/rss", section: "world" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/business/rss", section: "business" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/environment/rss", section: "environment" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/science/rss", section: "science" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/technology/rss", section: "technology" },

  // The Wall Street Journal
  { outlet: "The Wall Street Journal", url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", section: "world" },
  { outlet: "The Wall Street Journal", url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", section: "markets" },
  { outlet: "The Wall Street Journal", url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml", section: "business" },
  { outlet: "The Wall Street Journal", url: "https://feeds.a.dj.com/rss/RSSWSJD.xml", section: "technology" },

  // The Washington Post
  { outlet: "The Washington Post", url: "https://feeds.washingtonpost.com/rss/world", section: "world" },
  { outlet: "The Washington Post", url: "https://feeds.washingtonpost.com/rss/business", section: "business" },
  { outlet: "The Washington Post", url: "https://feeds.washingtonpost.com/rss/national", section: "national" },
  { outlet: "The Washington Post", url: "https://feeds.washingtonpost.com/rss/politics", section: "politics" },

  // CBC / Radio-Canada (feeds live at rss.cbc.ca/lineup/*.xml)
  { outlet: "CBC / Radio-Canada", url: "https://rss.cbc.ca/lineup/world.xml", section: "world" },
  { outlet: "CBC / Radio-Canada", url: "https://rss.cbc.ca/lineup/business.xml", section: "business" },
  { outlet: "CBC / Radio-Canada", url: "https://rss.cbc.ca/lineup/politics.xml", section: "politics" },
  { outlet: "CBC / Radio-Canada", url: "https://rss.cbc.ca/lineup/canada.xml", section: "canada" },
  { outlet: "CBC / Radio-Canada", url: "https://rss.cbc.ca/lineup/technology.xml", section: "technology" },

  // Le Monde
  { outlet: "Le Monde", url: "https://www.lemonde.fr/rss/une.xml", section: "une" },
  { outlet: "Le Monde", url: "https://www.lemonde.fr/international/rss_full.xml", section: "international" },
  { outlet: "Le Monde", url: "https://www.lemonde.fr/economie/rss_full.xml", section: "economie" },

  // Financial Times
  { outlet: "Financial Times", url: "https://www.ft.com/rss/home", section: "home" },
  { outlet: "Financial Times", url: "https://www.ft.com/world?format=rss", section: "world" },

  // The Economist
  { outlet: "The Economist", url: "https://www.economist.com/international/rss.xml", section: "international" },
  { outlet: "The Economist", url: "https://www.economist.com/finance-and-economics/rss.xml", section: "finance" },
  { outlet: "The Economist", url: "https://www.economist.com/business/rss.xml", section: "business" },
  { outlet: "The Economist", url: "https://www.economist.com/science-and-technology/rss.xml", section: "science" },

  // El País
  { outlet: "El País", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada", section: "internacional" },
  { outlet: "El País", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada", section: "economia" },

  // The Hindu
  { outlet: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss", section: "national" },
  { outlet: "The Hindu", url: "https://www.thehindu.com/news/international/feeder/default.rss", section: "world" },
  { outlet: "The Hindu", url: "https://www.thehindu.com/business/feeder/default.rss", section: "business" },

  // Al Jazeera English
  { outlet: "Al Jazeera English", url: "https://www.aljazeera.com/xml/rss/all.xml", section: "all" },

  // Nikkei Asia
  { outlet: "Nikkei Asia", url: "https://asia.nikkei.com/rss/feed/nar", section: "main" },

  // Le Devoir
  { outlet: "Le Devoir", url: "https://www.ledevoir.com/rss/manchettes.xml", section: "manchettes" },
  { outlet: "Le Devoir", url: "https://www.ledevoir.com/rss/section/economie.xml", section: "economie" },

  // ABC Australia
  { outlet: "ABC Australia", url: "https://www.abc.net.au/news/feed/51120/rss.xml", section: "just-in" },

  // Additional region/section subfeeds for high-yield outlets (reliable endpoints).
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml", section: "europe" },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml", section: "asia" },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml", section: "us-canada" },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", section: "africa" },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", section: "middle-east" },

  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml", section: "asia" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Europe.xml", section: "europe" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml", section: "middle-east" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml", section: "climate" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/EnergyEnvironment.xml", section: "energy" },

  { outlet: "The Guardian", url: "https://www.theguardian.com/uk-news/rss", section: "uk" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/us-news/rss", section: "us" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/global-development/rss", section: "global-development" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/politics/rss", section: "politics" },

];

// Note: CBC feeds use the canonical rss.cbc.ca/lineup/*.xml endpoints above, but
// CBC is unreachable from some networks (connection refused, not 404); it may
// still resolve from the GitHub Actions runner. Reuters and Bloomberg are
// intentionally absent — neither offers public RSS any longer.
