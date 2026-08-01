import { describe, expect, it } from "vitest";

import { promptHash, SCORE_PROMPT, SCORE_PROMPT_HASH } from "../src/lib/analysis.js";

describe("prompt versioning (SPEC 8.1)", () => {
  it("hashes deterministically", () => {
    expect(promptHash("abc")).toBe(promptHash("abc"));
    expect(promptHash("abc")).not.toBe(promptHash("abd"));
  });

  it("exposes a stable 64-char hash of the scoring prompt", () => {
    expect(SCORE_PROMPT_HASH).toHaveLength(64);
    expect(SCORE_PROMPT_HASH).toBe(promptHash(SCORE_PROMPT));
  });

  it("loads the scoring prompt with its five dimensions", () => {
    for (const dim of [
      "structural",
      "irreversibility",
      "domain_relevance",
      "contribution",
      "ephemerality",
    ]) {
      expect(SCORE_PROMPT).toContain(dim);
    }
  });
});
