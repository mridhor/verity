"use client";

import Link from "next/link";
import { ArrowUpRight, CircleAlert } from "lucide-react";
import type { AgentEvent, CitationTarget, Widget } from "@/lib/agent/types";
import { cn } from "@/lib/utils";
import { useAgent, type UiMessage } from "./agent-provider";
import { RichText } from "./cite-chip";
import { ProposalCards } from "./proposal-card";
import { ResultTable } from "./result-table";
import { ToolSteps } from "./tool-steps";
import { AgentWidget } from "./widgets";

type View = {
  steps: { id: string; label: string; status: string }[];
  cites: Map<string, CitationTarget>;
  blocks: ({ kind: "text"; id: string; text: string; unsupported?: boolean } | { kind: "table"; id: string; columns: string[]; rows: { cells: string[]; tone?: "ok" | "warn" | "bad" }[] })[];
  proposals: string[];
  links: { href: string; label: string }[];
  suggestions: string[];
  errors: string[];
  widgets: { id: string; widget: Widget }[];
};

export function buildView(events: AgentEvent[]): View {
  const v: View = { steps: [], cites: new Map(), blocks: [], proposals: [], links: [], suggestions: [], errors: [], widgets: [] };
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    switch (e.type) {
      case "step": {
        const i = v.steps.findIndex((s) => s.id === e.id);
        if (i >= 0) v.steps[i] = e; else v.steps.push(e);
        break;
      }
      case "citation": v.cites.set(e.marker, e.target); break;
      case "text": {
        const b = v.blocks.find((x) => x.kind === "text" && x.id === e.blockId);
        if (b && b.kind === "text") { b.text += e.delta; b.unsupported ||= e.unsupported; }
        else v.blocks.push({ kind: "text", id: e.blockId, text: e.delta, unsupported: e.unsupported });
        break;
      }
      case "table": v.blocks.push({ kind: "table", id: e.blockId, columns: e.columns, rows: e.rows }); break;
      case "proposal": v.proposals.push(...e.proposedChangeIds); break;
      case "navigate": v.links.push({ href: e.href, label: e.label }); break;
      case "suggestions": v.suggestions = e.items; break;
      case "error": v.errors.push(e.message); break;
      case "widget": v.widgets.push({ id: e.widgetId, widget: e.widget }); break;
    }
  }
  return v;
}

/** `latest`: the last message of the thread, whose widgets still take an answer. */
export function AgentMessage({ message, compact, latest }: { message: UiMessage; compact?: boolean; latest?: boolean }) {
  const { send, busy } = useAgent();
  const v = buildView(message.events);
  const hasContent = v.blocks.length > 0 || v.errors.length > 0 || v.links.length > 0 || v.widgets.length > 0;
  return (
    <div className="mb-7" aria-live={message.streaming ? "polite" : undefined}>
      <ToolSteps steps={v.steps} running={message.streaming} />
      {message.streaming && !hasContent && <p className="agent-pulse text-[13px] text-subtle">Agen sedang membaca data…</p>}
      {v.blocks.map((b) => b.kind === "text" ? (
        <p key={b.id} className={cn(compact ? "agent-p-sm" : "agent-p", "mb-2.5")}>
          <RichText text={b.text} cites={v.cites} />
          {b.unsupported && (
            <span className="ml-1.5 inline-flex items-center gap-1 align-middle font-sans text-[11px] text-warning">
              <CircleAlert size={11} /> tanpa sumber yang valid
            </span>
          )}
        </p>
      ) : (
        <ResultTable key={b.id} columns={b.columns} rows={b.rows} cites={v.cites} />
      ))}
      {v.links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {v.links.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium shadow-card hover:bg-muted">
              {l.label} <ArrowUpRight size={12} />
            </Link>
          ))}
        </div>
      )}
      {v.errors.map((e) => <p key={e} role="alert" className="text-[13px] text-destructive">{e}</p>)}
      {v.widgets.map((w) => <AgentWidget key={w.id} id={w.id} widget={w.widget} active={!!latest && !message.streaming} />)}
      {v.proposals.length > 0 && <ProposalCards ids={v.proposals} />}
      {!message.streaming && v.suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {v.suggestions.map((s) => (
            <button key={s} type="button" disabled={busy} onClick={() => send(s)}
              className="rounded-lg border border-border bg-card px-2.5 py-1 text-[12.5px] text-muted-foreground shadow-card hover:bg-muted hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
