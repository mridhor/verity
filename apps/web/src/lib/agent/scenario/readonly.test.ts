import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Rule 1, code side: the scenario agent reaches the database only through readonly-db.
const dir = join(__dirname);
const sources = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => [f, readFileSync(join(dir, f), "utf8")] as const);

describe("scenario agent is read-only", () => {
  it.each(sources)("%s never writes or builds its own client", (_file, src) => {
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(src).not.toMatch(/createClient|createServerClient|supabase\/server/);
    expect(src).not.toMatch(/\bfetch\(/);
  });
});
