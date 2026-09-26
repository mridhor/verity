import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readonlyDb, type ReadonlyDb } from "../readonly-db";
import { ScenarioAgent } from "../scenario";
import { RunBuilder, withSeq, type SkillOutput } from "../scenario/run";
import type { AgentEvent, AgentProvider, AgentRunInput } from "../types";
import { AgentConfigError, openRouterConfig, type OpenRouterConfig } from "./config";
import { systemPrompt } from "./system-prompt";
import { TOOL_STEP, toolDefinitions } from "./tool-specs";
import { runTool } from "./tools";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_TOOL_ROUNDS = 4;
const HISTORY = 12;
const TIMEOUT_MS = 45_000;

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
type Completion = { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[]; error?: { message?: string } };

export type Fetch = typeof fetch;

/**
 * Demo agent on a general model through OpenRouter (ADR 0007), for synthetic data only. The model
 * chooses tools; the tools are the scenario agent's skills (read-only under the user's RLS,
 * proposals only). What the user sees is the model's answer, citation-checked, plus the skills'
 * tables, widgets and proposals. Widget answers never reach the model: they are handled by the
 * scenario agent. Prompt content is never logged (rule 9).
 */
export class OpenRouterAgent implements AgentProvider {
  readonly name = "openrouter";

  constructor(private readonly client: SupabaseClient, private readonly env: Record<string, string | undefined> = process.env, private readonly fetcher: Fetch = fetch) {}

  async *run(input: AgentRunInput): AsyncIterable<AgentEvent> {
    if (input.action) {
      yield* new ScenarioAgent(this.client).run(input);
      return;
    }
    let seq = 0;
    yield { type: "step", seq: seq++, id: "s0", label: "Memahami pertanyaan", status: "running" };
    let config: OpenRouterConfig;
    try {
      config = openRouterConfig(this.env);
    } catch (err) {
      const message = err instanceof AgentConfigError ? err.message : "Konfigurasi agen tidak valid.";
      yield { type: "error", seq: seq++, message };
      yield { type: "done", seq };
      return;
    }

    const db = readonlyDb(this.client);
    const run = new RunBuilder(`${input.userMessageId}-`);
    const c = { db, run, input, context: input.context };
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt(input.context) },
      ...(await history(db, input)),
      { role: "user", content: input.message },
    ];
    const steps: { id: string; label: string }[] = [];

    try {
      let answer = "";
      for (let round = 0; ; round++) {
        const last = round >= MAX_TOOL_ROUNDS;
        const reply = await this.complete(config, messages, last);
        const calls = last ? [] : reply.tool_calls ?? [];
        if (!calls.length) { answer = reply.content?.trim() ?? ""; break; }
        messages.push({ role: "assistant", content: reply.content ?? null, tool_calls: calls });
        for (const call of calls) {
          const step = { id: `t${steps.length + 1}`, label: TOOL_STEP[call.function.name] ?? "Membaca data" };
          steps.push(step);
          yield { type: "step", seq: seq++, ...step, status: "running" };
          let result: SkillOutput | { error: string };
          try {
            const ok = await runTool(c, call.function.name, parseArgs(call.function.arguments));
            result = ok ? run.take() : { error: "Tool tidak dikenal." };
          } catch {
            run.take();
            result = { error: "Tool gagal dijalankan." };
          }
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
          yield { type: "step", seq: seq++, ...step, status: "done" };
        }
        // A form is waiting for the user: nothing more to look up in this turn.
        if (run.hasWidget) {
          answer = (await this.complete(config, messages, true)).content?.trim() ?? "";
          break;
        }
      }
      if (answer) run.answer(answer);
      const tail = withSeq([{ type: "step", id: "s0", label: "Memahami pertanyaan", status: "done" }, ...(await run.events(db, { skillText: !answer, skillSteps: false }))], seq);
      for (const e of tail) yield e;
      yield { type: "done", seq: seq + tail.length };
    } catch (err) {
      // Only the kind of failure, never the prompt or data (rule 9).
      console.error("openrouter agent failed", { name: (err as Error).name, status: (err as { status?: number }).status });
      yield { type: "error", seq: seq++, message: "Agen LLM tidak dapat dihubungi. Coba lagi sebentar lagi." };
      yield { type: "done", seq };
    }
  }

  private async complete(config: OpenRouterConfig, messages: ChatMessage[], final: boolean) {
    const res = await this.fetcher(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Verity (demo)",
        ...(config.referer ? { "HTTP-Referer": config.referer } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools: toolDefinitions(),
        tool_choice: final ? "none" : "auto",
        temperature: 0.2,
        max_tokens: 1200,
        // Only providers that neither keep nor train on prompts (demo data is synthetic anyway).
        provider: { data_collection: "deny", zdr: true },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as Completion;
    if (!res.ok || body.error) throw Object.assign(new Error("openrouter request failed"), { status: res.status });
    return body.choices?.[0]?.message ?? {};
  }
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** Earlier turns of this thread (under RLS): the user's words and the agent's text, markers removed. */
async function history(db: ReadonlyDb, input: AgentRunInput): Promise<ChatMessage[]> {
  const { data } = await db.select("agent_messages", "id, role, body, events").eq("thread_id", input.threadId)
    .neq("id", input.userMessageId).order("id", { ascending: false }).limit(HISTORY);
  const rows = ((data ?? []) as unknown as { role: "user" | "agent"; body: string | null; events: AgentEvent[] | null }[]).reverse();
  return rows.flatMap((m): ChatMessage[] => {
    if (m.role === "user") return m.body ? [{ role: "user", content: m.body }] : [];
    const text = (m.events ?? []).flatMap((e) => (e.type === "text" ? [e.delta] : [])).join("\n").replace(/\[\[c\d+\]\]/g, "").trim();
    return text ? [{ role: "assistant", content: text }] : [];
  });
}
