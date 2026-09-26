"use client";

import { useEffect, useRef } from "react";
import { MessageSquarePlus, Sparkles, X } from "lucide-react";
import { useAgent } from "./agent-provider";
import { Conversation } from "./conversation";

/** Right-hand agent panel, available on every page and aware of the page's context. */
export function AgentSidecar() {
  const { open, embedded, setOpen, context, newThread, thread } = useAgent();
  const closeRef = useRef<HTMLButtonElement>(null);
  const visible = open && !embedded;

  useEffect(() => {
    if (!visible) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, setOpen]);

  if (!visible) return null;
  return (
    <aside aria-label="Agen" className="fixed inset-0 z-30 flex flex-col bg-card md:static md:inset-auto md:z-auto md:w-[400px] md:shrink-0 md:overflow-hidden md:rounded-xl md:shadow-surface">
      <div className="flex items-center gap-2.5 border-b border-border-soft px-4 py-3">
        <span className="grid size-7 place-items-center rounded-md bg-foreground font-serif text-[15px] leading-none text-card" aria-hidden>V</span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium">Agen Verity</div>
          <div className="truncate text-[12px] text-subtle">{context.label}</div>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground" title="Agen berbasis aturan; belum memakai model AI">
          Mode uji
        </span>
        {thread.messages.length > 0 && (
          <button type="button" onClick={newThread} aria-label="Percakapan baru" title="Percakapan baru"
            className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-muted hover:text-foreground"><MessageSquarePlus size={15} /></button>
        )}
        <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Tutup agen"
          className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-muted hover:text-foreground"><X size={15} /></button>
      </div>
      <Conversation compact />
    </aside>
  );
}

export function AgentToggleButton() {
  const { open, setOpen, embedded } = useAgent();
  if (embedded) return null;
  return (
    <button type="button" onClick={() => setOpen(!open)} aria-pressed={open} title="Tanya agent (⌘J)"
      className={`inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[13px] font-medium text-foreground shadow-card transition-colors ${open ? "bg-muted" : "bg-card hover:bg-muted"}`}>
      <Sparkles size={14} aria-hidden /> Tanya agent
      <kbd className="rounded border border-border px-1 font-sans text-[10.5px] font-normal text-subtle">⌘J</kbd>
    </button>
  );
}
