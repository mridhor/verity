"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Right-hand panel over the page (native <dialog>: focus trap, Esc, inert background), for
 * looking at one record without leaving the list.
 */
export function Sheet({ open, onClose, title, subtitle, actions, width = "md", children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: React.ReactNode; actions?: React.ReactNode;
  width?: "md" | "lg"; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) { opener.current = document.activeElement; el.showModal(); }
    else if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onNativeClose = () => { onClose(); if (opener.current instanceof HTMLElement) opener.current.focus(); };
    el.addEventListener("close", onNativeClose);
    return () => el.removeEventListener("close", onNativeClose);
  }, [onClose]);

  return (
    <dialog ref={ref} aria-labelledby="sheet-title"
      onMouseDown={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      className={cn("sheet-pop fixed inset-y-2 right-2 left-auto m-0 text-left h-[calc(100dvh-16px)] max-h-none overflow-hidden rounded-xl border border-border bg-card p-0 text-foreground shadow-pop backdrop:bg-foreground/20",
        width === "lg" ? "w-[min(760px,calc(100vw-16px))]" : "w-[min(560px,calc(100vw-16px))]")}>
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-start gap-3 border-b border-border-soft px-6 py-4">
            <div className="min-w-0 flex-1">
              <h2 id="sheet-title" className="truncate text-[17px] font-medium">{title}</h2>
              {subtitle && <div className="mt-0.5 truncate text-[12.5px] text-subtle">{subtitle}</div>}
            </div>
            {actions}
            <button type="button" onClick={() => ref.current?.close()} aria-label="Tutup"
              className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-muted hover:text-foreground"><X size={16} /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Label/value rows, like the properties block of a record. */
export function Properties({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[132px_1fr] gap-x-4 gap-y-3 text-[13px]">
      {items.map((i) => (
        <div key={i.label} className="contents">
          <dt className="text-subtle">{i.label}</dt>
          <dd className="min-w-0 text-foreground">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
