/**
 * OpenRouter settings for the demo agent (ADR 0007). OpenRouter sends prompts to model providers
 * outside Indonesia, so it may only ever see synthetic data (PLAN.md:16, §10.3): the provider
 * refuses to start unless the deployment declares `VERITY_DATA_CLASS=synthetic`. Production keeps
 * the in-country engine (PLAN.md §7).
 */

/** Models the demo may use. Anything else is refused (same idea as PLAN.md:808). */
export const OPENROUTER_MODELS = [
  "anthropic/claude-sonnet-5",
  "anthropic/claude-opus-5.5",
  "anthropic/claude-haiku-4.5",
  "google/gemini-3.8-flash",
] as const;
export type OpenRouterModel = (typeof OPENROUTER_MODELS)[number];
export const DEFAULT_OPENROUTER_MODEL: OpenRouterModel = "anthropic/claude-sonnet-5";

export type OpenRouterConfig = { apiKey: string; model: OpenRouterModel; referer?: string };

export class AgentConfigError extends Error {}

export function openRouterConfig(env: Record<string, string | undefined> = process.env): OpenRouterConfig {
  if (env.VERITY_DATA_CLASS !== "synthetic") {
    throw new AgentConfigError("Agen LLM (OpenRouter) hanya boleh dipakai pada data sintetis; VERITY_DATA_CLASS belum 'synthetic'.");
  }
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new AgentConfigError("OPENROUTER_API_KEY belum diisi.");
  const model = (env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL) as OpenRouterModel;
  if (!OPENROUTER_MODELS.includes(model)) throw new AgentConfigError(`Model "${model}" tidak ada di daftar yang diizinkan.`);
  const referer = env.NEXT_PUBLIC_SITE_URL ?? (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
  return { apiKey, model, ...(referer ? { referer } : {}) };
}
