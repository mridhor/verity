import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_SPECS } from "../openrouter/tool-specs";
import { buildDataset } from "./build";

// `pnpm --filter @verity/web agent:dataset` rewrites the file; a normal test run fails if it drifted.
const FILE = join(__dirname, "../../../../../../docs/agent/dataset/verity-tools.synthetic.jsonl");

describe("fine-tuning dataset", () => {
  const data = buildDataset();
  it("is up to date", () => {
    if (process.env.AGENT_DATASET_WRITE) writeFileSync(FILE, data);
    expect(readFileSync(FILE, "utf8")).toBe(data);
  });
  it("uses only known tools with their declared arguments", () => {
    const specs = new Map(TOOL_SPECS.map((t) => [t.name, t]));
    const lines = data.trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.length).toBeGreaterThan(100);
    for (const l of lines) {
      const call = l.messages.at(-1).tool_calls?.[0]?.function;
      if (!call) continue;
      const spec = specs.get(call.name)!;
      expect(spec, call.name).toBeTruthy();
      for (const k of Object.keys(JSON.parse(call.arguments))) expect(Object.keys(spec.params), `${call.name}.${k}`).toContain(k);
    }
  });
});
