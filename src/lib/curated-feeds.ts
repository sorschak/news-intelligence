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

  // CBC / Radio-Canada (canonical webfeed endpoints; see cbc.ca/rss)
  { outlet: "CBC / Radio-Canada", url: "https://www.cbc.ca/webfeed/rss/rss-topstories", section: "topstories" },
  { outlet: "CBC / Radio-Canada", url: "https://www.cbc.ca/webfeed/rss/rss-world", section: "world" },
  { outlet: "CBC / Radio-Canada", url: "https://www.cbc.ca/webfeed/rss/rss-canada", section: "canada" },
  { outlet: "CBC / Radio-Canada", url: "https://www.cbc.ca/webfeed/rss/rss-politics", section: "politics" },
  { outlet: "CBC / Radio-Canada", url: "https://www.cbc.ca/webfeed/rss/rss-business", section: "business" },
  { outlet: "CBC / Radio-Canada", url: "https://www.cbc.ca/webfeed/rss/rss-technology", section: "technology" },

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

  // Second curation pass — more section feeds to reach the 140-feed target (SPEC 13).
  { outlet: "The Guardian", url: "https://www.theguardian.com/australia-news/rss", section: "australia" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/society/rss", section: "society" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/money/rss", section: "money" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/law/rss", section: "law" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/education/rss", section: "education" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/europe-news/rss", section: "europe" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/middleeast/rss", section: "middle-east" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/asia-pacific/rss", section: "asia" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/americas/rss", section: "americas" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/africa/rss", section: "africa" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/china/rss", section: "china" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/russia/rss", section: "russia" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/business/economics/rss", section: "economics" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/technology/artificialintelligenceai/rss", section: "ai" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/environment/climate-crisis/rss", section: "climate" },

  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/US.xml", section: "us" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Africa.xml", section: "africa" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml", section: "americas" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml", section: "politics" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml", section: "health" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Space.xml", section: "space" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/PersonalTech.xml", section: "personal-tech" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/DealBook.xml", section: "dealbook" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Upshot.xml", section: "upshot" },

  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/health/rss.xml", section: "health" },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/education/rss.xml", section: "education" },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml", section: "latin-america" },
  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", section: "culture" },

  { outlet: "Le Monde", url: "https://www.lemonde.fr/politique/rss_full.xml", section: "politique" },
  { outlet: "Le Monde", url: "https://www.lemonde.fr/planete/rss_full.xml", section: "planete" },
  { outlet: "Le Monde", url: "https://www.lemonde.fr/pixels/rss_full.xml", section: "tech" },

  { outlet: "Frankfurter Allgemeine Zeitung", url: "https://www.faz.net/rss/aktuell/wirtschaft/", section: "wirtschaft" },
  { outlet: "Frankfurter Allgemeine Zeitung", url: "https://www.faz.net/rss/aktuell/politik/", section: "politik" },
  { outlet: "Frankfurter Allgemeine Zeitung", url: "https://www.faz.net/rss/aktuell/wissen/", section: "wissen" },

  { outlet: "The Hindu", url: "https://www.thehindu.com/sci-tech/feeder/default.rss", section: "sci-tech" },
  { outlet: "The Hindu", url: "https://www.thehindu.com/news/feeder/default.rss", section: "news" },

  { outlet: "El País", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ciencia/portada", section: "ciencia" },
  { outlet: "El País", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia/portada", section: "tecnologia" },

  // Third pass — push over the 140-feed target.
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/ukraine/rss", section: "ukraine" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/india/rss", section: "india" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/france/rss", section: "france" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/world/germany/rss", section: "germany" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/inequality/rss", section: "inequality" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/commentisfree/rss", section: "opinion" },
  { outlet: "The Guardian", url: "https://www.theguardian.com/cities/rss", section: "cities" },

  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Education.xml", section: "education" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml", section: "sports" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml", section: "arts" },
  { outlet: "The New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/Books.xml", section: "books" },

  { outlet: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", section: "top" },

  { outlet: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed", section: "china" },
  { outlet: "South China Morning Post", url: "https://www.scmp.com/rss/92/feed", section: "asia" },
  { outlet: "South China Morning Post", url: "https://www.scmp.com/rss/5/feed", section: "business" },

  // Fourth pass — specialist and non-Anglophone coverage (every URL verified
  // against its live endpoint on 2026-08-02). This rebalances the set away from
  // the Anglophone giants toward the domain focus (clean energy, EU/DACH and
  // Quebec politics, industrial policy) and strengthens cross-lingual
  // corroboration. Outlets whose feeds could not be reached (Caixin, Lawfare,
  // Hydrogen Insight, Recharge, Kyiv Independent, Asahi AJW, Haaretz — no public
  // RSS or a hard bot block) are left to auto-discovery.

  // Germany / Austria / Switzerland (German-language)
  { outlet: "Handelsblatt", url: "https://www.handelsblatt.com/contentexport/feed/schlagzeilen", section: "schlagzeilen" },
  { outlet: "Handelsblatt", url: "https://www.handelsblatt.com/contentexport/feed/wirtschaft", section: "wirtschaft" },
  { outlet: "Handelsblatt", url: "https://www.handelsblatt.com/contentexport/feed/unternehmen", section: "unternehmen" },
  { outlet: "Handelsblatt", url: "https://www.handelsblatt.com/contentexport/feed/finanzen", section: "finanzen" },
  { outlet: "Süddeutsche Zeitung", url: "https://rss.sueddeutsche.de/rss/Topthemen", section: "topthemen" },
  { outlet: "Süddeutsche Zeitung", url: "https://rss.sueddeutsche.de/rss/Wirtschaft", section: "wirtschaft" },
  { outlet: "Süddeutsche Zeitung", url: "https://rss.sueddeutsche.de/rss/Politik", section: "politik" },
  { outlet: "Neue Zürcher Zeitung", url: "https://www.nzz.ch/recent.rss", section: "recent" },
  { outlet: "Neue Zürcher Zeitung", url: "https://www.nzz.ch/international.rss", section: "international" },
  { outlet: "Neue Zürcher Zeitung", url: "https://www.nzz.ch/wirtschaft.rss", section: "wirtschaft" },
  { outlet: "Der Standard", url: "https://www.derstandard.at/rss/international", section: "international" },
  { outlet: "Der Standard", url: "https://www.derstandard.at/rss/inland", section: "inland" },
  { outlet: "Der Standard", url: "https://www.derstandard.at/rss/wirtschaft", section: "wirtschaft" },
  { outlet: "Die Presse", url: "https://www.diepresse.com/rss/wirtschaft", section: "wirtschaft" },
  { outlet: "Die Presse", url: "https://www.diepresse.com/rss/politik", section: "politik" },

  // France / EU
  { outlet: "Politico Europe", url: "https://www.politico.eu/feed/", section: "main" },

  // Canada / Quebec
  { outlet: "La Presse", url: "https://www.lapresse.ca/actualites/rss", section: "actualites" },
  { outlet: "La Presse", url: "https://www.lapresse.ca/affaires/rss", section: "affaires" },
  { outlet: "La Presse", url: "https://www.lapresse.ca/international/rss", section: "international" },
  { outlet: "The Globe and Mail", url: "https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/canada/", section: "canada" },
  { outlet: "The Globe and Mail", url: "https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/business/", section: "business" },
  { outlet: "The Globe and Mail", url: "https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/world/", section: "world" },
  { outlet: "National Post", url: "https://nationalpost.com/feed/", section: "main" },

  // Europe (other languages) + Russia-in-exile
  { outlet: "Corriere della Sera", url: "https://xml2.corriereobjects.it/rss/homepage.xml", section: "homepage" },
  { outlet: "Meduza", url: "https://meduza.io/rss/en/all", section: "all" },

  // Asia-Pacific
  { outlet: "The Straits Times", url: "https://www.straitstimes.com/news/world/rss.xml", section: "world" },
  { outlet: "Australian Financial Review", url: "https://www.afr.com/rss/feed.xml", section: "main" },

  // Specialist science / technology / investigative (primary_publication basis)
  { outlet: "Nature news", url: "https://www.nature.com/nature.rss", section: "news" },
  { outlet: "Science news", url: "https://www.science.org/rss/news_current.xml", section: "news" },
  { outlet: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", section: "main" },
  { outlet: "STAT News", url: "https://www.statnews.com/feed/", section: "main" },
  { outlet: "ProPublica", url: "https://www.propublica.org/feeds/propublica/main", section: "main" },
  { outlet: "Bellingcat", url: "https://www.bellingcat.com/feed/", section: "main" },

  // Clean-energy / climate specialists (new outlets in registry.ts) — the domain focus
  { outlet: "Canary Media", url: "https://www.canarymedia.com/articles.rss", section: "main" },
  { outlet: "Utility Dive", url: "https://www.utilitydive.com/feeds/news/", section: "news" },
  { outlet: "Carbon Brief", url: "https://www.carbonbrief.org/feed/", section: "main" },
  { outlet: "pv magazine", url: "https://www.pv-magazine.com/feed/", section: "main" },

  // China — English-language coverage (all verified 2026-08-02). State media give
  // the official line (industrial-policy focus); the independent/translated
  // watchers below provide the cross-check that keeps single-source state claims
  // in "thinly sourced". Caixin and Yicai Global expose no public RSS, and Sixth
  // Tone dropped its feed — those are left to auto-discovery.
  { outlet: "China Daily", url: "https://www.chinadaily.com.cn/rss/china_rss.xml", section: "china" },
  { outlet: "China Daily", url: "https://www.chinadaily.com.cn/rss/world_rss.xml", section: "world" },
  { outlet: "China Daily", url: "https://www.chinadaily.com.cn/rss/bizchina_rss.xml", section: "business" },
  { outlet: "Global Times", url: "https://www.globaltimes.cn/rss/outbrain.xml", section: "main" },
  { outlet: "CGTN", url: "https://www.cgtn.com/subscribe/rss/section/china.xml", section: "china" },
  { outlet: "CGTN", url: "https://www.cgtn.com/subscribe/rss/section/world.xml", section: "world" },
  { outlet: "People's Daily", url: "http://en.people.cn/rss/China.xml", section: "china" },
  { outlet: "Xinhua", url: "https://english.news.cn/rss/worldrss.xml", section: "world" },
  { outlet: "The Wire China", url: "https://www.thewirechina.com/feed/", section: "main" },
  { outlet: "ChinaFile", url: "https://www.chinafile.com/rss.xml", section: "main" },
  { outlet: "China Digital Times", url: "https://chinadigitaltimes.net/feed/", section: "main" },
  { outlet: "What's on Weibo", url: "https://www.whatsonweibo.com/feed/", section: "main" },
  { outlet: "Pekingnology", url: "https://www.pekingnology.com/feed", section: "main" },

  // Southeast Asia (English) — verified 2026-08-02. Jakarta Post, The Star (MY),
  // and Tempo expose no working RSS and are left to discovery.
  { outlet: "Channel NewsAsia", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", section: "main" },
  { outlet: "Bangkok Post", url: "https://www.bangkokpost.com/rss/data/topstories.xml", section: "topstories" },
  { outlet: "New Straits Times", url: "https://www.nst.com.my/feed", section: "main" },
  { outlet: "Rappler", url: "https://www.rappler.com/feed/", section: "main" },
  { outlet: "Philippine Daily Inquirer", url: "https://www.inquirer.net/feed/", section: "main" },
  { outlet: "VnExpress International", url: "https://e.vnexpress.net/rss/news.rss", section: "news" },
  { outlet: "VnExpress International", url: "https://e.vnexpress.net/rss/business.rss", section: "business" },
  { outlet: "The Diplomat", url: "https://thediplomat.com/feed/", section: "main" },

  // South America — verified 2026-08-02. Estadão, Brazilian Report, Infobae, and
  // El Espectador expose no working RSS and are left to discovery.
  { outlet: "G1 Globo", url: "https://g1.globo.com/rss/g1/", section: "main" },
  { outlet: "Clarín", url: "https://www.clarin.com/rss/lo-ultimo/", section: "ultimo" },
  { outlet: "La Nación", url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml", section: "main" },
  { outlet: "Buenos Aires Herald", url: "https://buenosairesherald.com/feed", section: "main" },
  { outlet: "Buenos Aires Times", url: "https://www.batimes.com.ar/feed", section: "main" },
  { outlet: "El Tiempo", url: "https://www.eltiempo.com/rss/colombia.xml", section: "colombia" },
  { outlet: "La Tercera", url: "https://www.latercera.com/arc/outboundfeeds/rss/?outputType=xml", section: "main" },
  { outlet: "El Comercio Perú", url: "https://elcomercio.pe/arc/outboundfeeds/rss/?outputType=xml", section: "main" },
  { outlet: "MercoPress", url: "https://en.mercopress.com/rss/", section: "main" },

  // France — broader spectrum, verified 2026-08-02. Les Échos, La Tribune, and
  // Le Point expose no working RSS (403/404) and are left to discovery.
  { outlet: "Le Figaro", url: "https://www.lefigaro.fr/rss/figaro_actualites.xml", section: "actualites" },
  { outlet: "Le Figaro", url: "https://www.lefigaro.fr/rss/figaro_economie.xml", section: "economie" },
  { outlet: "Le Figaro", url: "https://www.lefigaro.fr/rss/figaro_international.xml", section: "international" },
  { outlet: "Libération", url: "https://www.liberation.fr/arc/outboundfeeds/rss/?outputType=xml", section: "main" },
  { outlet: "France 24", url: "https://www.france24.com/fr/rss", section: "fr" },
  { outlet: "France 24", url: "https://www.france24.com/en/rss", section: "en" },
  { outlet: "RFI", url: "https://www.rfi.fr/fr/rss", section: "fr" },
  { outlet: "L'Express", url: "https://www.lexpress.fr/rss/alaune.xml", section: "alaune" },
  { outlet: "Ouest-France", url: "https://www.ouest-france.fr/rss/une", section: "une" },
  { outlet: "Mediapart", url: "https://www.mediapart.fr/articles/feed", section: "main" },

  // Germany — broader spectrum, verified 2026-08-02. Der Spiegel's international
  // feed is English (per-item language is detected at ingestion).
  { outlet: "Der Spiegel", url: "https://www.spiegel.de/schlagzeilen/tops/index.rss", section: "schlagzeilen" },
  { outlet: "Der Spiegel", url: "https://www.spiegel.de/wirtschaft/index.rss", section: "wirtschaft" },
  { outlet: "Der Spiegel", url: "https://www.spiegel.de/international/index.rss", section: "international" },
  { outlet: "Die Zeit", url: "https://newsfeed.zeit.de/index", section: "index" },
  { outlet: "Die Zeit", url: "https://newsfeed.zeit.de/wirtschaft/index", section: "wirtschaft" },
  { outlet: "Die Welt", url: "https://www.welt.de/feeds/latest.rss", section: "latest" },
  { outlet: "Die Welt", url: "https://www.welt.de/feeds/section/wirtschaft.rss", section: "wirtschaft" },
  { outlet: "Tagesschau", url: "https://www.tagesschau.de/index~rss2.xml", section: "index" },
  { outlet: "Tagesschau", url: "https://www.tagesschau.de/wirtschaft/index~rss2.xml", section: "wirtschaft" },
  { outlet: "Deutsche Welle", url: "https://rss.dw.com/rdf/rss-en-all", section: "en" },
  { outlet: "Deutsche Welle", url: "https://rss.dw.com/xml/rss-de-all", section: "de" },
  { outlet: "taz", url: "https://taz.de/rss.xml", section: "main" },
  { outlet: "Frankfurter Rundschau", url: "https://www.fr.de/rssfeed.rdf", section: "main" },

];

// Note: CBC uses the cbc.ca/webfeed/rss/rss-* endpoints above (the older
// rss.cbc.ca/lineup/*.xml paths are deprecated / 404). CBC is unreachable from
// some networks — connections hang with no response — so these are validated via
// the GitHub Actions runner, not local runs. Reuters and Bloomberg are
// intentionally absent — neither offers public RSS any longer.
