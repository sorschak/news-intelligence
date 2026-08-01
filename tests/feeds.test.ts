import { describe, expect, it } from "vitest";

import {
  discoverFeeds,
  type FetchLike,
  parseAlternateLinks,
} from "../src/lib/feeds.js";

const HOMEPAGE = `
<!doctype html><html><head>
  <title>Example Paper</title>
  <link rel="alternate" type="application/rss+xml" title="World" href="/rss/world.xml">
  <link rel="alternate" type="application/atom+xml" title="Business"
        href="https://cdn.example.com/atom/business">
  <link rel="stylesheet" href="/style.css">
  <link rel="alternate" type="text/html" hreflang="fr" href="/fr/">
</head><body>news</body></html>
`;

type Route = { status: number; body?: string };

function mockFetch(routes: Record<string, Route>): FetchLike {
  return async (url, init) => {
    const method = init?.method ?? "GET";
    const route = routes[`${method} ${url}`] ?? { status: 404 };
    return {
      ok: route.status < 400,
      status: route.status,
      text: async () => route.body ?? "",
    };
  };
}

describe("parseAlternateLinks", () => {
  it("selects only RSS/Atom feed alternates", () => {
    const hrefs = parseAlternateLinks(HOMEPAGE).map((l) => l.href);
    expect(new Set(hrefs)).toEqual(
      new Set(["/rss/world.xml", "https://cdn.example.com/atom/business"]),
    );
  });

  it("preserves link titles", () => {
    const byHref = Object.fromEntries(
      parseAlternateLinks(HOMEPAGE).map((l) => [l.href, l.title]),
    );
    expect(byHref["/rss/world.xml"]).toBe("World");
  });
});

describe("discoverFeeds", () => {
  it("resolves alternate links against the homepage and dedupes", async () => {
    const fetchImpl = mockFetch({ "GET https://ex.com/": { status: 200, body: HOMEPAGE } });
    const urls = (await discoverFeeds("https://ex.com/", fetchImpl)).map((c) => c.url);

    expect(new Set(urls)).toEqual(
      new Set([
        "https://ex.com/rss/world.xml",
        "https://cdn.example.com/atom/business",
      ]),
    );
  });

  it("probes common paths and keeps those that respond", async () => {
    const fetchImpl = mockFetch({
      "GET https://ex.com/": { status: 200, body: "<html><head></head><body/></html>" },
      "HEAD https://ex.com/feed": { status: 200 },
    });
    const result = await discoverFeeds("https://ex.com/", fetchImpl);

    expect(result).toEqual([{ url: "https://ex.com/feed", title: null }]);
  });
});
