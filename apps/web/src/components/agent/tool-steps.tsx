"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Database } from "lucide-react";

export function ToolSteps({ steps }: { steps: { id: string; label: string; status: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!steps.length) return null;
  return (
    <div className="mb-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex items-center gap-1.5 text-[12.5px] text-subtle hover:text-muted-foreground">
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {steps.length} langkah dijalankan
      </button>
      {open && (
        <ol className="mt-2 ml-1.5 border-l border-border pl-3">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-0.5 text-[12.5px] text-muted-foreground">
              <Database size={12} className="text-subtle" aria-hidden />
              {s.label}{s.status === "running" && <span className="agent-pulse text-subtle">…</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
