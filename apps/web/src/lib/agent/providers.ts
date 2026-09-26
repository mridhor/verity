import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ScenarioAgent } from "./scenario";
import type { AgentProvider } from "./types";

/**
 * Selects the agent implementation. "engine" (FastAPI + LangGraph with an in-country model,
 * PLAN.md §7) will proxy the same event stream; until it exists only the scenario agent runs.
 */
export function getAgentProvider(client: SupabaseClient): AgentProvider {
  const name = process.env.VERITY_AGENT_PROVIDER ?? "scenario";
  if (name !== "scenario") throw new Error(`Agent provider "${name}" is not available yet`);
  return new ScenarioAgent(client);
}
