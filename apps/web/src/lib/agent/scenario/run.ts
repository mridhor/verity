import "server-only";
import { validateCitations } from "../citations";
import type { ReadonlyDb } from "../readonly-db";
import type { AgentEvent, AgentEventInput, CitationTarget, Widget } from "../types";

type Row = { cells: string[]; tone?: "ok" | "warn" | "bad" };
type Block =
  | { kind: "text"; id: string; text: string }
  | { kind: "table"; id: string; columns: string[]; rows: Row[] };

/**
 * Collects what a skill found, then emits it as events. Citations are re-validated under RLS
 * before anything is sent (REQ-AI-06): failed markers are removed and a paragraph left with no
 * valid citation is flagged `unsupported` instead of being hidden.
 */
export class RunBuilder {
  private steps: { id: string; label: string }[] = [];
  private blocks: Block[] = [];
  private cites = new Map<string, { marker: string; target: CitationTarget }>();
  private extra: AgentEventInput[] = [];
  private n = 0;
  private widgets = 0;

  /** `prefix` keeps widget ids unique within a thread (the user message id). */
  constructor(private readonly prefix = "") {}

  step(label: string) {
    this.steps.push({ id: `s${this.steps.length + 1}`, label });
  }

  /** Returns a [[cN]] marker for the target (deduplicated by kind, id and field). */
  cite(target: CitationTarget): string {
    const key = `${target.kind}:${target.id}:${target.field ?? ""}`;
    let c = this.cites.get(key);
    if (!c) {
      c = { marker: `c${this.cites.size + 1}`, target };
      this.cites.set(key, c);
    }
    return `[[${c.marker}]]`;
  }

  say(text: string) {
    this.blocks.push({ kind: "text", id: `b${++this.n}`, text });
  }

  table(columns: string[], rows: Row[]) {
    this.blocks.push({ kind: "table", id: `b${++this.n}`, columns, rows });
  }

  proposal(ids: string[]) {
    if (ids.length) this.extra.push({ type: "proposal", proposedChangeIds: ids });
  }

  navigate(href: string, label: string) {
    this.extra.push({ type: "navigate", href, label });
  }

  /** Asks the user to fill something in; the answer comes back as an AgentAction. */
  widget(widget: Widget) {
    this.extra.push({ type: "widget", widgetId: `${this.prefix}w${++this.widgets}`, widget });
  }

  suggest(items: string[]) {
    if (items.length) this.extra.push({ type: "suggestions", items });
  }

  async events(db: ReadonlyDb): Promise<AgentEventInput[]> {
    const all = [...this.cites.values()];
    const valid = await validateCitations(db, all.map((c) => c.target));
    const keep = new Set(all.filter((c) => valid.has(`${c.target.kind}:${c.target.id}`)).map((c) => c.marker));
    const strip = (s: string) => s.replace(/\[\[(c\d+)\]\]/g, (m, id: string) => (keep.has(id) ? m : ""));
    const out: AgentEventInput[] = this.steps.map((s) => ({ type: "step", id: s.id, label: s.label, status: "done" }));
    for (const c of all) if (keep.has(c.marker)) out.push({ type: "citation", marker: c.marker, target: c.target });
    for (const b of this.blocks) {
      if (b.kind === "text") {
        const had = /\[\[c\d+\]\]/.test(b.text);
        const text = strip(b.text);
        out.push({ type: "text", blockId: b.id, delta: text, ...(had && !/\[\[c\d+\]\]/.test(text) ? { unsupported: true } : {}) });
      } else {
        out.push({ type: "table", blockId: b.id, columns: b.columns, rows: b.rows.map((r) => ({ ...r, cells: r.cells.map(strip) })) });
      }
    }
    return [...out, ...this.extra];
  }
}

export function withSeq(events: AgentEventInput[], start = 0): AgentEvent[] {
  return events.map((e, i) => ({ ...e, seq: start + i }) as AgentEvent);
}
