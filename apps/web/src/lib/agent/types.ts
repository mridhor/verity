import type { AgentEventSchema } from "@verity/schema-ts";

/** One event of an agent run; same contract as the future engine (packages/schema/schemas/agent-event.schema.json). */
export type AgentEvent = AgentEventSchema;
export type CitationTarget = Extract<AgentEvent, { type: "citation" }>["target"];
export type AgentEventInput = AgentEvent extends infer E ? (E extends { seq: number } ? Omit<E, "seq"> : never) : never;

/** Where the user is asking from. Pages register this; the agent scopes its answers to it. */
export type AgentContext =
  | { kind: "kantor"; label: string; page?: "beranda" | "jadwal" | "register" | "dokumen" | "dasar_hukum" | "lainnya" }
  | { kind: "berkas"; label: string; berkasId: string }
  | { kind: "akta"; label: string; berkasId: string; aktaId: string };

export type AgentRunInput = {
  threadId: string;
  userMessageId: number;
  message: string;
  context: AgentContext;
};

export interface AgentProvider {
  readonly name: string;
  run(input: AgentRunInput): AsyncIterable<AgentEvent>;
}
