"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInbox, markAllNotificationsRead, type InboxItem } from "./notification-actions";

const DOT = { info: "bg-info", warning: "bg-warning", success: "bg-success", neutral: "bg-subtle" } as const;

export function NotificationBell({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<{ reminders: InboxItem[]; notifications: InboxItem[] } | null>(null);
  const [tab, setTab] = useState<"pengingat" | "notifikasi">("pengingat");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getInbox().then((x) => { if (alive) setInbox(x); }).catch(() => { if (alive) setInbox({ reminders: [], notifications: [] }); });
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { alive = false; document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const list = tab === "pengingat" ? inbox?.reminders : inbox?.notifications;
  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog"
        aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi dan pengingat"}
        className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <Bell size={16} />
        {unread > 0 && <span aria-hidden className="absolute top-2 right-2 size-1.5 rounded-full bg-destructive ring-2 ring-card" />}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifikasi" className="absolute right-0 z-30 mt-1.5 w-[360px] overflow-hidden rounded-xl border border-border bg-card shadow-pop">
          <div className="flex items-center gap-1 border-b border-border-soft px-2 pt-2 pb-1.5">
            {(["pengingat", "notifikasi"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={cn("rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground", tab === t && "bg-muted font-medium text-foreground")}>
                {t === "pengingat" ? "Pengingat" : "Notifikasi"}
                {t === "notifikasi" && unread > 0 && <span className="ml-1.5 rounded-full bg-destructive px-1.5 text-[10.5px] text-card tabular-nums">{unread}</span>}
                {t === "pengingat" && inbox && inbox.reminders.length > 0 && <span className="ml-1 text-subtle tabular-nums">({inbox.reminders.length})</span>}
              </button>
            ))}
            <div className="flex-1" />
            {tab === "notifikasi" && unread > 0 && (
              <form action={markAllNotificationsRead}>
                <button className="rounded-md px-2 py-1 text-[12px] text-subtle hover:bg-muted hover:text-foreground">Tandai dibaca</button>
              </form>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto py-1">
            {!inbox && <p className="agent-pulse px-4 py-8 text-center text-[12.5px] text-subtle">Memuat…</p>}
            {inbox && list!.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-[12.5px] text-subtle">
                <CalendarClock size={18} />
                {tab === "pengingat" ? "Tidak ada jadwal hari ini atau tenggat dekat." : "Belum ada notifikasi."}
              </div>
            )}
            {inbox && list!.map((n) => (
              <Link key={n.id} href={n.href} onClick={() => setOpen(false)}
                className="mx-1 flex gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted">
                <span aria-hidden className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", DOT[n.tone])} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13px]", n.unread ? "font-medium text-foreground" : "text-foreground")}>{n.title}</span>
                  <span className="block truncate text-[12px] text-subtle">{n.sub}</span>
                </span>
                {n.unread && <span className="mt-1.5 text-[10.5px] font-medium text-destructive">Baru</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
