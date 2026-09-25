import type { AgentContext } from "./types";

/** Stable key for "which conversation belongs to this page". */
export function contextKey(ctx: AgentContext): string {
  if (ctx.kind === "akta") return `akta:${ctx.aktaId}`;
  if (ctx.kind === "berkas") return `berkas:${ctx.berkasId}`;
  return `kantor:${ctx.page ?? "lainnya"}`;
}
