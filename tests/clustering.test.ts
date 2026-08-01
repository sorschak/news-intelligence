import { describe, expect, it } from "vitest";

import {
  ASSIGN_THRESHOLD,
  cosine,
  decideAssignment,
  parseVectorLiteral,
  toVectorLiteral,
} from "../src/lib/clustering.js";

describe("cosine", () => {
  it("is 1 for identical direction, 0 for orthogonal, -1 for opposite", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("is scale-invariant", () => {
    expect(cosine([2, 0], [5, 0])).toBeCloseTo(1);
  });

  it("returns 0 against a zero vector", () => {
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });

  it("throws on dimension mismatch", () => {
    expect(() => cosine([1, 2], [1, 2, 3])).toThrow(/dimension mismatch/);
  });
});

describe("vector literal round-trip", () => {
  it("serialises and parses back", () => {
    expect(toVectorLiteral([1, 2.5, -3])).toBe("[1,2.5,-3]");
    expect(parseVectorLiteral("[1,2.5,-3]")).toEqual([1, 2.5, -3]);
  });

  it("parses an empty vector", () => {
    expect(parseVectorLiteral("[]")).toEqual([]);
  });
});

describe("decideAssignment", () => {
  it("attaches when similarity clears the threshold", () => {
    expect(decideAssignment({ clusterId: 7, similarity: ASSIGN_THRESHOLD })).toEqual({
      kind: "attach",
      clusterId: 7,
    });
  });

  it("creates when below threshold or no candidate", () => {
    expect(decideAssignment({ clusterId: 7, similarity: 0.5 })).toEqual({ kind: "create" });
    expect(decideAssignment(null)).toEqual({ kind: "create" });
  });
});
