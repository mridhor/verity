"use client";

import type { CitationTarget } from "@/lib/agent/types";
import { Dot } from "@/components/ui/input";
import { RichText } from "./cite-chip";

const TONE = { ok: "success", warn: "warning", bad: "destructive" } as const;

export function ResultTable({ columns, rows, cites }: {
  columns: string[]; rows: { cells: string[]; tone?: "ok" | "warn" | "bad" }[]; cites: Map<string, CitationTarget>;
}) {
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="bg-muted text-left text-muted-foreground">
            {columns.map((c) => <th key={c} className="border-b border-border px-3 py-2 font-medium whitespace-nowrap">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.cells.map((cell, j) => (
                <td key={j} className="border-t border-border-soft px-3 py-2 align-top">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {j === r.cells.length - 1 && r.tone && <Dot tone={TONE[r.tone]} />}
                    <RichText text={cell} cites={cites} />
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
