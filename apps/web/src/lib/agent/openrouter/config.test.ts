import { describe, expect, it } from "vitest";
import { AgentConfigError, DEFAULT_OPENROUTER_MODEL, openRouterConfig } from "./config";

const base = { VERITY_DATA_CLASS: "synthetic", OPENROUTER_API_KEY: "sk-or-test" };

describe("openRouterConfig", () => {
  it("runs only on synthetic data", () => {
    for (const cls of [undefined, "", "client", "Synthetic"]) {
      expect(() => openRouterConfig({ ...base, VERITY_DATA_CLASS: cls })).toThrow(AgentConfigError);
    }
  });
  it("needs a key", () => expect(() => openRouterConfig({ ...base, OPENROUTER_API_KEY: " " })).toThrow(/OPENROUTER_API_KEY/));
  it("refuses models outside the allow-list", () => {
    expect(() => openRouterConfig({ ...base, OPENROUTER_MODEL: "some/other-model" })).toThrow(/tidak ada di daftar/);
  });
  it("defaults the model", () => expect(openRouterConfig(base)).toEqual({ apiKey: "sk-or-test", model: DEFAULT_OPENROUTER_MODEL }));
});
