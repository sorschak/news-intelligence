import { describe, expect, it } from "vitest";

import {
  classify,
  type ClassifyInput,
  detectWireCredit,
  isPersonByline,
} from "../src/lib/originator.js";

// A tier-2 newsroom item with no distinguishing features, used as the base case
// so each test isolates the single rule under exercise.
function base(overrides: Partial<ClassifyInput> = {}): ClassifyInput {
  return {
    headline: "Quiet procedural amendment reshapes pension oversight",
    standfirst: "The regulator adopted a rule change affecting how funds report.",
    outletIsWire: false,
    outletTier: 2,
    creator: null,
    precedent: null,
    ...overrides,
  };
}

describe("detectWireCredit", () => {
  it("matches a parenthesised agency", () => {
    expect(detectWireCredit("Ceasefire holds along the border (Reuters)")).toBe("Reuters");
  });

  it("matches a trailing dash attribution", () => {
    expect(detectWireCredit("Ministers agree emergency fuel measures — AFP")).toBe(
      "Agence France-Presse",
    );
  });

  it("matches a 'with files from' phrasing", () => {
    expect(detectWireCredit("Report on flooding, with files from Associated Press")).toBe(
      "Associated Press",
    );
  });

  it("does not fire on an article merely about a wire", () => {
    expect(detectWireCredit("Thomson Reuters reports quarterly earnings growth")).toBeNull();
  });
});

describe("isPersonByline", () => {
  it("accepts a two-part human name", () => {
    expect(isPersonByline("Jane Doe")).toBe(true);
    expect(isPersonByline("By Marie-Claude Tremblay")).toBe(true);
  });

  it("rejects organisations and single tokens", () => {
    expect(isPersonByline("Reuters Staff")).toBe(false);
    expect(isPersonByline("Newsroom")).toBe(false);
    expect(isPersonByline("")).toBe(false);
    expect(isPersonByline(null)).toBe(false);
  });
});

describe("classification cascade (SPEC 7.2)", () => {
  it("rule 1 — explicit wire credit → reprint", () => {
    const out = classify(base({ headline: "Border clashes escalate (AFP)" }));
    expect(out).toEqual({ class: "reprint", evidence: "wire-credit:Agence France-Presse" });
  });

  it("rule 2 — outlet is a wire → originator (a wire's own copy)", () => {
    const out = classify(base({ outletIsWire: true }));
    expect(out).toEqual({ class: "originator", evidence: "outlet-is-wire" });
  });

  it("rule 3 — aggregator tier → reprint", () => {
    const out = classify(base({ outletTier: 3 }));
    expect(out).toEqual({ class: "reprint", evidence: "aggregator-tier" });
  });

  it("rule 4 — temporal precedence → reprint of the earlier item", () => {
    const out = classify(base({ precedent: { itemId: "8842" } }));
    expect(out).toEqual({ class: "reprint", evidence: "temporal-precedence:8842" });
  });

  it("rule 5 — a person byline → originator", () => {
    const out = classify(base({ creator: "By Amara Okonkwo" }));
    expect(out).toEqual({ class: "originator", evidence: "byline" });
  });

  it("rule 6 — nothing fires → unknown (counted at 0.5)", () => {
    expect(classify(base())).toEqual({ class: "unknown", evidence: "default" });
  });

  it("precedence: wire credit outranks a wire outlet", () => {
    // A wire outlet republishing another agency's credited copy is still a reprint.
    const out = classify(base({ headline: "Statement issued (Reuters)", outletIsWire: true }));
    expect(out.class).toBe("reprint");
  });
});
