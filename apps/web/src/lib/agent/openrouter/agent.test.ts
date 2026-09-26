import { describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/test/fake-supabase";
import type { AgentEvent, AgentRunInput } from "../types";
import { OpenRouterAgent } from ".";

const BERKAS = { id: "00000000-0000-4000-8000-000000000001", title: "AJB Rumah Kebagusan III" };
const env = { VERITY_DATA_CLASS: "synthetic", OPENROUTER_API_KEY: "sk-or-test" };
const input = (over: Partial<AgentRunInput> = {}): AgentRunInput => ({
  threadId: "00000000-0000-4000-8000-0000000000f0", userMessageId: 7, message: "jadwalkan penandatanganan",
  context: { kind: "berkas", label: BERKAS.title, berkasId: BERKAS.id }, ...over,
});
const reply = (message: Record<string, unknown>) => new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 });

async function collect(it: AsyncIterable<AgentEvent>) {
  const out: AgentEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe("OpenRouterAgent", () => {
  it("asks for the date with a form, and drops markers the tools never gave", async () => {
    const { client } = fakeSupabase({ berkas: [BERKAS], agent_messages: [] });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(reply({ content: null, tool_calls: [{ id: "call1", type: "function", function: { name: "usul_jadwal", arguments: "{\"jenis\":\"penandatanganan\"}" } }] }))
      .mockResolvedValueOnce(reply({ content: "Silakan isi tanggal dan jamnya pada formulir. [[c9]]" }));
    const events = await collect(new OpenRouterAgent(client, env, fetcher).run(input()));

    const widget = events.find((e) => e.type === "widget");
    expect(widget).toMatchObject({ widgetId: "7-w1", widget: { kind: "schedule_form", berkas: BERKAS, defaults: { kind: "penandatanganan", title: `Penandatanganan ${BERKAS.title}` } } });
    const text = events.filter((e) => e.type === "text");
    expect(text).toEqual([expect.objectContaining({ delta: "Silakan isi tanggal dan jamnya pada formulir. ", unsupported: true })]);
    expect(events.at(-1)?.type).toBe("done");
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));

    const [, first] = fetcher.mock.calls[0]!;
    const body = JSON.parse(first.body);
    expect(first.headers.Authorization).toBe("Bearer sk-or-test");
    expect(body.provider).toEqual({ data_collection: "deny", zdr: true });
    expect(body.model).toBe("anthropic/claude-sonnet-5");
    // The tool result went back to the model; after a form the last call may not use tools.
    expect(JSON.parse(fetcher.mock.calls[1]![1].body).tool_choice).toBe("none");
  });

  it("never calls the model when the data is not synthetic", async () => {
    const { client } = fakeSupabase({});
    const fetcher = vi.fn();
    const events = await collect(new OpenRouterAgent(client, { ...env, VERITY_DATA_CLASS: "client" }, fetcher).run(input()));
    expect(fetcher).not.toHaveBeenCalled();
    expect(events.find((e) => e.type === "error")).toMatchObject({ message: expect.stringMatching(/data sintetis/) });
  });

  it("answers widgets without the model, as a proposal", async () => {
    const { client, rpcCalls } = fakeSupabase({ berkas: [BERKAS] });
    const fetcher = vi.fn();
    const events = await collect(new OpenRouterAgent(client, env, fetcher).run(input({
      message: "Tambahkan checklist: Minta NPWP Laras",
      action: { kind: "checklist_form", widgetId: "6-w1", berkasId: BERKAS.id, title: "Minta NPWP Laras", dueDate: "2026-10-01" },
    })));
    expect(fetcher).not.toHaveBeenCalled();
    expect(rpcCalls).toEqual([expect.objectContaining({ name: "create_proposed_changes", args: expect.objectContaining({
      p_berkas: BERKAS.id, p_items: [expect.objectContaining({ op: "checklist.add", params: { title: "Minta NPWP Laras", due_date: "2026-10-01" } })],
    }) })]);
    expect(events.some((e) => e.type === "proposal")).toBe(true);
  });

  it("reports a model failure without its content", async () => {
    const { client } = fakeSupabase({ agent_messages: [] });
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 502 }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const events = await collect(new OpenRouterAgent(client, env, fetcher).run(input({ message: "rahasia klien" })));
    expect(events.find((e) => e.type === "error")).toMatchObject({ message: expect.stringContaining("(502)") });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("rahasia");
    spy.mockRestore();
  });
});
