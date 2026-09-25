"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgent } from "./agent-provider";
import { AgentMessage } from "./message";

const PLACEHOLDER = {
  kantor: "Tanya tentang kantor, misalnya: akta mana yang menunggu tanda tangan?",
  berkas: "Tanya tentang berkas ini, misalnya: cek kelengkapan dokumen pendiri",
  akta: "Tanya tentang akta ini, misalnya: apa yang kurang sebelum difinalkan?",
} as const;

export function Composer({ compact }: { compact?: boolean }) {
  const { send, busy, context } = useAgent();
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim() || busy) return;
    const t = text;
    setText("");
    void send(t);
  };
  return (
    <div className="rounded-2xl border border-border bg-muted/70 p-2 transition-colors focus-within:border-foreground/20 focus-within:bg-card focus-within:shadow-surface">
      <div className="flex items-center gap-1.5 px-1.5 pt-1 pb-1.5">
        <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md bg-card px-2 py-1 text-[12px] text-muted-foreground shadow-card">
          <AtSign size={12} className="shrink-0 text-subtle" /> <span className="truncate">{context.label}</span>
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        rows={compact ? 2 : 3}
        placeholder={PLACEHOLDER[context.kind]}
        aria-label="Pesan untuk agen"
        className="w-full resize-none bg-transparent px-2 py-1 text-[14.5px] leading-relaxed outline-none placeholder:text-subtle"
      />
      <div className="flex items-center gap-2 px-1.5 pb-0.5">
        <span className="text-[11.5px] text-subtle">Agen hanya membaca; perubahan butuh persetujuan.</span>
        <div className="flex-1" />
        <button type="button" onClick={submit} disabled={!text.trim() || busy} aria-label="Kirim"
          className="grid size-9 place-items-center rounded-lg bg-foreground text-card transition-colors hover:bg-foreground/85 disabled:bg-[#d8d5cc] disabled:text-card">
          <ArrowUp size={16} />
        </button>
      </div>
    </div>
  );
}

export function Conversation({ compact }: { compact?: boolean }) {
  const { thread, suggestions, send, busy, context } = useAgent();
  const end = useRef<HTMLDivElement>(null);
  const last = thread.messages.at(-1);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread.messages.length, last?.events.length]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", compact ? "" : "mx-auto w-full max-w-[720px]")}>
      <div className={cn("min-h-0 flex-1 overflow-y-auto", compact ? "px-4 py-4" : "px-8 py-7")}>
        {!thread.loaded && <p className="agent-pulse text-[13px] text-subtle">Memuat percakapan…</p>}
        {thread.loaded && thread.messages.length === 0 && (
          <div className="py-6">
            <p className={cn(compact ? "agent-p-sm" : "agent-p", "text-muted-foreground")}>
              {context.kind === "kantor"
                ? "Tanyakan apa saja tentang data kantor yang boleh Anda lihat. Setiap fakta disertai sumber yang bisa diklik."
                : `Tanyakan tentang ${context.label}. Setiap fakta disertai sumber, dan perubahan hanya berupa usulan yang perlu disetujui.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s} type="button" disabled={busy} onClick={() => send(s)}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] text-muted-foreground shadow-card transition-colors hover:bg-muted hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {thread.messages.map((m) => m.role === "user" ? (
          <div key={m.id} className="mb-6 ml-auto max-w-[85%] rounded-2xl bg-muted px-4 py-3 text-[14px] leading-relaxed">
            {m.body}
            <div className="mt-1.5 text-[11.5px] text-subtle">{m.author}, {m.createdAt}</div>
          </div>
        ) : (
          <AgentMessage key={m.id} message={m} compact={compact} />
        ))}
        <div ref={end} />
      </div>
      <div className={cn(compact ? "px-3 pb-3" : "px-8 pb-5")}>
        <Composer compact={compact} />
      </div>
    </div>
  );
}
