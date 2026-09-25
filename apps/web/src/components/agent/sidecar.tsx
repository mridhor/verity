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
    <aside aria-label="Agen" className="fixed inset-0 z-30 flex flex-col bg-pane md:static md:inset-auto md:z-auto md:w-[400px] md:shrink-0 md:border-l md:border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles size={15} className="text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold">Agen</div>
          <div className="truncate text-[11.5px] text-subtle">{context.label}</div>
        </div>
        <span className="rounded bg-border-soft px-1.5 py-0.5 text-[10.5px] text-muted-foreground" title="Agen berbasis aturan; belum memakai model AI">
          Mode uji
        </span>
        {thread.messages.length > 0 && (
          <button type="button" onClick={newThread} aria-label="Percakapan baru" title="Percakapan baru"
            className="rounded-md p-1.5 text-subtle hover:bg-border-soft hover:text-foreground"><MessageSquarePlus size={15} /></button>
        )}
        <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Tutup agen"
          className="rounded-md p-1.5 text-subtle hover:bg-border-soft hover:text-foreground"><X size={15} /></button>
      </div>
      <Conversation compact />
    </aside>
  );
}

export function AgentToggleButton() {
  const { open, setOpen, embedded } = useAgent();
  if (embedded) return null;
  return (
    <button type="button" onClick={() => setOpen(!open)} aria-pressed={open}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[12.5px] text-foreground hover:border-subtle">
      <Sparkles size={13} className="text-primary" aria-hidden /> Tanya agen
      <kbd className="ml-1 rounded border border-border px-1 font-sans text-[10.5px] text-subtle">⌘J</kbd>
    </button>
  );
}
