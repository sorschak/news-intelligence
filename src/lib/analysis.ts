/**
 * Model-based analysis (SPEC.md 8.1, 8.3) — Phase 4.
 *
 * Per-cluster scoring with Claude Sonnet (cost-appropriate for the call volume;
 * SPEC 3.2), and numeric-claim extraction. The scoring prompt is where the
 * system's editorial judgment resides — it is versioned by SHA-256 hash, and any
 * modification invalidates cached scores (SPEC 8.1). Model IDs are configurable
 * and default to `claude-sonnet-5` (DECISIONS.md D-015). Thinking is disabled to
 * control cost across ~250 calls/day; the prompt carries the judgment.
 *
 * Responses are parsed as JSON (the prompt mandates JSON-only output);
 * fence-stripping tolerates an occasional stray code fence (DECISIONS.md D-016).
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";

import { optionalEnv, requireEnv } from "./env.js";

function loadPrompt(name: string): string {
  const url = new URL(`../prompts/${name}`, import.meta.url);
  return readFileSync(fileURLToPath(url), "utf8");
}

export function promptHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export const SCORE_PROMPT = loadPrompt("score.txt");
export const CLAIMS_PROMPT = loadPrompt("claims.txt");
export const SCORE_PROMPT_HASH = promptHash(SCORE_PROMPT);

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  return client;
}

function analysisModel(): string {
  return optionalEnv("ANALYSIS_MODEL", "claude-sonnet-5");
}

export type ClusterItemInput = {
  index: number;
  outlet: string;
  country: string;
  publishedAt: Date;
  headline: string;
  standfirst: string | null;
};

export type RawScore = {
  structural: number;
  irreversibility: number;
  domain_relevance: number;
  contribution: number;
  ephemerality: number;
  rationale: string;
  single_source: boolean;
  primary_ref: string | null;
};

export type RawClaim = {
  item_index: number;
  claim_key: string;
  value: number;
  unit: string | null;
  qualifier: string | null;
};

function formatItems(items: ClusterItemInput[]): string {
  const lines = items.map((i) => {
    const tail = i.standfirst ? ` — ${i.standfirst}` : "";
    return `[${i.index}] ${i.outlet} (${i.country}, ${i.publishedAt.toISOString()}): ${i.headline}${tail}`;
  });
  return `${items.length} outlets reporting the same event:\n\n${lines.join("\n")}`;
}

function parseJsonBlock<T>(text: string): T {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/```$/, "")
      .trim();
  }
  return JSON.parse(t) as T;
}

function textOf(message: Anthropic.Message): string {
  for (const block of message.content) {
    if (block.type === "text") return block.text;
  }
  throw new Error("model response contained no text block");
}

function clamp05(n: number): number {
  return Math.max(0, Math.min(5, Math.round(n)));
}

/** Score one cluster on the five dimensions (SPEC 8.1). */
export async function scoreCluster(items: ClusterItemInput[]): Promise<RawScore> {
  const message = await anthropic().messages.create({
    model: analysisModel(),
    max_tokens: 1024,
    thinking: { type: "disabled" },
    system: SCORE_PROMPT,
    messages: [{ role: "user", content: formatItems(items) }],
  });
  const raw = parseJsonBlock<RawScore>(textOf(message));
  return {
    structural: clamp05(raw.structural),
    irreversibility: clamp05(raw.irreversibility),
    domain_relevance: clamp05(raw.domain_relevance),
    contribution: clamp05(raw.contribution),
    ephemerality: clamp05(raw.ephemerality),
    rationale: String(raw.rationale ?? ""),
    single_source: Boolean(raw.single_source),
    primary_ref: raw.primary_ref ? String(raw.primary_ref) : null,
  };
}

/** Extract numeric claims for arithmetic divergence detection (SPEC 8.3). */
export async function extractClaims(items: ClusterItemInput[]): Promise<RawClaim[]> {
  const message = await anthropic().messages.create({
    model: analysisModel(),
    max_tokens: 2048,
    thinking: { type: "disabled" },
    system: CLAIMS_PROMPT,
    messages: [{ role: "user", content: formatItems(items) }],
  });
  const parsed = parseJsonBlock<{ claims: RawClaim[] }>(textOf(message));
  return Array.isArray(parsed.claims) ? parsed.claims : [];
}
