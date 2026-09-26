import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ScenarioAgent } from "./scenario";
import type { AgentProvider } from "./types";

/**
 * Selects the agent implementation. "engine" (FastAPI + LangGraph with an in-country model,
 * PLAN.md §7) will proxy the same event stream; until it exists only the scenario agent runs.
 * An unknown value (for example a leftover "openrouter") falls back to the scenario agent, so a
 * stale environment variable never takes the agent down.
 */
export function getAgentProvider(client: SupabaseClient): AgentProvider {
  const name = process.env.VERITY_AGENT_PROVIDER ?? "scenario";
  if (name !== "scenario") console.warn(`Agent provider "${name}" is not available; using the scenario agent`);
  return new ScenarioAgent(client);
}
