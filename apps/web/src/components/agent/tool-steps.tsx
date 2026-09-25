"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleDashed, LoaderCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = { id: string; label: string; status: string };

function StepIcon({ status }: { status: string }) {
  if (status === "done") return <span className="grid size-[18px] place-items-center rounded-full bg-muted text-muted-foreground"><Check size={11} strokeWidth={2.5} /></span>;
  if (status === "running") return <LoaderCircle size={18} className="animate-spin text-foreground motion-reduce:animate-none" />;
  if (status === "error") return <span className="grid size-[18px] place-items-center rounded-full bg-destructive-soft text-destructive"><X size={11} strokeWidth={2.5} /></span>;
  return <CircleDashed size={18} className="text-subtle" />;
}

/**
 * The agent's plan as it runs: a live checklist while working, folded to "n langkah selesai"
 * afterwards (open to see what was read).
 */
export function ToolSteps({ steps, running }: { steps: Step[]; running?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  const done = steps.filter((s) => s.status === "done").length;
  const expanded = running || open;
  return (
    <div className="mb-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={expanded} disabled={running}
        className="group flex items-center gap-2 text-[12.5px] text-muted-foreground hover:text-foreground disabled:cursor-default">
        <span className="grid size-5 place-items-center rounded-md bg-foreground font-serif text-[11px] leading-none text-card" aria-hidden>V</span>
        {running ? `Menjalankan langkah ${Math.min(done + 1, steps.length)} dari ${steps.length}` : `${done} dari ${steps.length} langkah selesai`}
        {!running && <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />}
      </button>
      {expanded && (
        <ol className="relative mt-2 ml-[9px] space-y-2 border-l border-border pl-4">
          {steps.map((s) => (
            <li key={s.id} className="relative flex items-center gap-2.5 text-[13px]">
              <span className="absolute -left-[26px] bg-card"><StepIcon status={s.status} /></span>
              <span className={cn(s.status === "done" ? "text-subtle line-through decoration-border" : s.status === "running" ? "text-foreground" : "text-subtle")}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
