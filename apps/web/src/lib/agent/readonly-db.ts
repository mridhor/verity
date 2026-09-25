import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The only database access the agent gets (rule 1, code side): reads under the user's RLS and
 * the proposal RPC. There is deliberately no insert/update/delete. Database-level enforcement
 * for the future engine is the separate agent PostgREST (PLAN.md §10.1).
 */
const RPC_ALLOWLIST = ["create_proposed_changes"] as const;
type AllowedRpc = (typeof RPC_ALLOWLIST)[number];

export type ReadonlyDb = ReturnType<typeof readonlyDb>;

export function readonlyDb(client: SupabaseClient) {
  return {
    select: (table: string, columns: string, options?: { count?: "exact"; head?: boolean }) =>
      client.from(table).select(columns, options),
    rpc: (name: AllowedRpc, args: Record<string, unknown>) => {
      if (!RPC_ALLOWLIST.includes(name)) throw new Error(`RPC ${name} is not allowed for the agent`);
      return client.rpc(name, args);
    },
  };
}
