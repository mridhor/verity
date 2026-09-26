import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Rule 1 and rule 9, code side: the model path writes nothing itself and talks to OpenRouter only.
const sources = readdirSync(__dirname).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => [f, readFileSync(join(__dirname, f), "utf8")] as const);

describe("openrouter agent boundary", () => {
  it.each(sources)("%s never writes or builds its own client", (_f, src) => {
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(src).not.toMatch(/createClient|createServerClient|supabase\/server|service_role|sb_secret/);
  });
  it("only calls the OpenRouter endpoint", () => {
    const urls = sources.flatMap(([, src]) => [...src.matchAll(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'`]*/g)].map((m) => m[0]));
    expect(new Set(urls)).toEqual(new Set(["https://openrouter.ai/api/v1/chat/completions"]));
  });
});
