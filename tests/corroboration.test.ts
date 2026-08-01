import { describe, expect, it } from "vitest";

import {
  chooseBasis,
  corroborationByOutlets,
  corroborationByPublication,
} from "../src/lib/corroboration.js";

describe("corroborationByOutlets (SPEC 7.3)", () => {
  it("scores a single uncorroborated originator low", () => {
    expect(
      corroborationByOutlets({
        originatorCount: 1,
        wireCount: 0,
        regionCount: 1,
        languageCount: 1,
      }),
    ).toBe(0.23);
  });

  it("rewards multiple originators, a wire, and geographic/linguistic spread", () => {
    expect(
      corroborationByOutlets({
        originatorCount: 3,
        wireCount: 1,
        regionCount: 3,
        languageCount: 2,
      }),
    ).toBe(0.75);
  });

  it("saturates at 1.0 for heavily corroborated clusters", () => {
    expect(
      corroborationByOutlets({
        originatorCount: 6,
        wireCount: 2,
        regionCount: 4,
        languageCount: 3,
      }),
    ).toBe(1);
  });

  it("is deterministic (FR-05)", () => {
    const input = { originatorCount: 2, wireCount: 1, regionCount: 2, languageCount: 1 };
    expect(corroborationByOutlets(input)).toBe(corroborationByOutlets(input));
  });
});

describe("corroborationByPublication (SPEC 7.3.1)", () => {
  it("scores a preprint low (not yet reviewed)", () => {
    expect(
      corroborationByPublication({
        primaryRef: "arXiv:2508.01234",
        hasIndependentExpertComment: false,
        mentionsReplication: false,
      }),
    ).toBe(0.35);
  });

  it("scores a peer-reviewed venue high, plus independent comment", () => {
    expect(
      corroborationByPublication({
        primaryRef: "Nature",
        hasIndependentExpertComment: true,
        mentionsReplication: false,
      }),
    ).toBe(0.9);
  });

  it("gives an identifiable but unclassified venue the middle base", () => {
    expect(
      corroborationByPublication({
        primaryRef: "Journal of Obscure Studies",
        hasIndependentExpertComment: false,
        mentionsReplication: false,
      }),
    ).toBe(0.5);
  });
});

describe("chooseBasis (SPEC 7.3.1)", () => {
  it("uses primary_publication only with a ref AND a specialist originator", () => {
    expect(chooseBasis("10.1038/x", true)).toBe("primary_publication");
    expect(chooseBasis("10.1038/x", false)).toBe("outlets");
    expect(chooseBasis(null, true)).toBe("outlets");
  });
});
