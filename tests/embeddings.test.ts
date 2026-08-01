import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { embedTexts, type FetchLike } from "../src/lib/embeddings.js";

const DIMS = 4;

beforeAll(() => {
  process.env["EMBEDDING_PROVIDER"] = "voyage";
  process.env["EMBEDDING_MODEL"] = "test-model";
  process.env["EMBEDDING_API_KEY"] = "test-key";
  process.env["EMBEDDING_DIMS"] = String(DIMS);
});

afterAll(() => {
  delete process.env["EMBEDDING_PROVIDER"];
  delete process.env["EMBEDDING_MODEL"];
  delete process.env["EMBEDDING_API_KEY"];
  delete process.env["EMBEDDING_DIMS"];
});

// Returns an embedding whose first component encodes the text index ("t3" -> 3),
// so global ordering across batches is verifiable.
function mockFetch(dimsPerVector = DIMS): { impl: FetchLike; calls: string[][] } {
  const calls: string[][] = [];
  const impl: FetchLike = async (_url, init) => {
    const body = JSON.parse(init.body) as { input: string[] };
    calls.push(body.input);
    const data = body.input.map((t, i) => ({
      index: i,
      embedding: [Number(t.slice(1)), ...Array(dimsPerVector - 1).fill(0)],
    }));
    return {
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ data }),
    };
  };
  return { impl, calls };
}

describe("embedTexts", () => {
  it("returns an empty array for no input without calling the provider", async () => {
    const { impl, calls } = mockFetch();
    expect(await embedTexts([], impl)).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("batches by batchSize and preserves global input order", async () => {
    const { impl, calls } = mockFetch();
    const out = await embedTexts(["t0", "t1", "t2"], impl, 2);

    expect(calls).toEqual([["t0", "t1"], ["t2"]]);
    expect(out.map((v) => v[0])).toEqual([0, 1, 2]);
  });

  it("throws when the provider returns the wrong dimensionality", async () => {
    const { impl } = mockFetch(DIMS - 1);
    await expect(embedTexts(["t0"], impl)).rejects.toThrow(/dims, expected/);
  });

  it("throws on an unknown provider", async () => {
    process.env["EMBEDDING_PROVIDER"] = "nope";
    const { impl } = mockFetch();
    await expect(embedTexts(["t0"], impl)).rejects.toThrow(/Unknown EMBEDDING_PROVIDER/);
    process.env["EMBEDDING_PROVIDER"] = "voyage";
  });
});
