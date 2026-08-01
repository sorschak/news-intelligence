import { describe, expect, it } from "vitest";

import { salience, scoreBoth, type Score } from "../src/lib/scoring.js";

const SAMPLE: Score = {
  structural: 4,
  irreversibility: 3,
  corroboration: 0.75,
  contribution: 2,
  domainRelevance: 5,
  ephemerality: 1,
};

describe("salience (SPEC 8.2)", () => {
  it("computes the domained value", () => {
    // .26*.8 + .21*.6 + .18*.75 + .13*.4 + .12*1 - .18*.2 = 0.605
    expect(salience(SAMPLE)).toBe(0.605);
  });

  it("redistributes the freed domain weight when domainWeight = 0", () => {
    // k = 1 + 0.12/0.78; domain term drops out; ephemerality penalty unscaled.
    expect(salience(SAMPLE, 0)).toBe(0.5652);
  });

  it("floors at zero", () => {
    const bleak: Score = {
      structural: 0,
      irreversibility: 0,
      corroboration: 0,
      contribution: 0,
      domainRelevance: 0,
      ephemerality: 5,
    };
    expect(salience(bleak)).toBe(0);
  });
});

describe("scoreBoth", () => {
  it("returns both persisted values", () => {
    expect(scoreBoth(SAMPLE)).toEqual({ salience: 0.605, undomained: 0.5652 });
  });
});
