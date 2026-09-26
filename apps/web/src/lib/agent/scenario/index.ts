import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readonlyDb } from "../readonly-db";
import type { AgentEvent, AgentProvider, AgentRunInput } from "../types";
import { matchIntent } from "./intents";
import { RunBuilder, withSeq } from "./run";
import { runAction, runIntent } from "./skills";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Rule-based stand-in for the LangGraph engine (PLAN.md §7). Answers from real data under the
 * user's RLS, cites every record it relies on, and only ever creates proposals. It never calls
 * a third-party model: nothing leaves the deployment (rule 9).
 */
export class ScenarioAgent implements AgentProvider {
  readonly name = "scenario";

  constructor(private readonly client: SupabaseClient) {}

  async *run(input: AgentRunInput): AsyncIterable<AgentEvent> {
    // First event immediately (NFR-PERF-01), before any database work.
    yield { type: "step", seq: 0, id: "s0", label: "Memahami pertanyaan", status: "running" };
    const db = readonlyDb(this.client);
    const run = new RunBuilder(`${input.userMessageId}-`);
    try {
      const c = { db, run, input, context: input.context };
      if (input.action) await runAction(c, input.action);
      else await runIntent(c, matchIntent(input.message, input.context));
      const events = withSeq([{ type: "step", id: "s0", label: "Memahami pertanyaan", status: "done" }, ...(await run.events(db))], 1);
      for (const e of events) {
        yield e;
        if (e.type === "step" || e.type === "text" || e.type === "table") await pause(90);
      }
      yield { type: "done", seq: events.length + 1 };
    } catch (err) {
      console.error("scenario agent failed", { name: (err as Error).name });
      yield { type: "error", seq: 1, message: "Agen gagal memproses pertanyaan ini. Coba lagi." };
      yield { type: "done", seq: 2 };
    }
  }
}
