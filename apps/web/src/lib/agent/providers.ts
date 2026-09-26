import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OpenRouterAgent } from "./openrouter";
import { ScenarioAgent } from "./scenario";
import type { AgentProvider } from "./types";

/**
 * Selects the agent implementation (same event stream for all):
 * - "scenario": rule-based, no model; the default and the only one allowed on client data.
 * - "openrouter": a general model via OpenRouter, demo on synthetic data only (ADR 0007); it
 *   refuses to run unless VERITY_DATA_CLASS=synthetic.
 * - "engine" (FastAPI + LangGraph with an in-country model, PLAN.md §7) comes later.
 */
export function getAgentProvider(client: SupabaseClient): AgentProvider {
  const name = process.env.VERITY_AGENT_PROVIDER ?? "scenario";
  if (name === "scenario") return new ScenarioAgent(client);
  if (name === "openrouter") return new OpenRouterAgent(client);
  throw new Error(`Agent provider "${name}" is not available yet`);
}
