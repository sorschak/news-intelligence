import { describe, expect, it } from "vitest";

import { topKeywords } from "../src/lib/gdelt.js";

describe("topKeywords", () => {
  it("ranks salient terms by frequency, ignoring stopwords and short tokens", () => {
    const headlines = [
      "Hydrogen subsidy passes after long debate",
      "Hydrogen subsidy reshapes energy market",
      "Energy market reacts to the hydrogen news",
    ];
    const keys = topKeywords(headlines, 3);
    expect(keys[0]).toBe("hydrogen"); // appears 3x
    expect(keys).toContain("energy");
    expect(keys).not.toContain("the"); // stopword
  });

  it("returns an empty list for no input", () => {
    expect(topKeywords([])).toEqual([]);
  });
});
