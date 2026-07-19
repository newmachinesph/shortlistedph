import "server-only";
import OpenAI from "openai";
import { requireEnv } from "./api";

// Model ids live here only — never scattered through route handlers.
export const MODELS = {
  extract: "gpt-4.1-mini",
  embed: "text-embedding-3-small",
} as const;

export const EMBED_DIM = 1536;

let client: OpenAI | null = null;

export function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  return client;
}

export async function embed(text: string): Promise<number[]> {
  const res = await openai().embeddings.create({
    model: MODELS.embed,
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

/** pgvector literal — Prisma can't bind number[] to a vector column. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
