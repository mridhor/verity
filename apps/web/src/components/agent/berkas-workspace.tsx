"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, X } from "lucide-react";
import type { CitationTarget } from "@/lib/agent/types";
import { cn } from "@/lib/utils";
import { getCitationDetail, type CitationDetail } from "./actions";
import { useAgent } from "./agent-provider";
import { Conversation } from "./conversation";

type Opened = { target: CitationTarget; detail: CitationDetail | null | undefined };

/**
 * Berkas "Percakapan" tab, as in docs/design/berkas-workspace.jsx: the conversation in the
 * middle and a document pane on the right that opens and highlights what the agent cited.
 */
export function BerkasWorkspace() {
  const { setEmbedded, setCiteHandler } = useAgent();
  const [opened, setOpened] = useState<Opened[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setEmbedded(true);
    setCiteHandler((target) => {
      setOpened((list) => {
        const i = list.findIndex((o) => o.target.kind === target.kind && o.target.id === target.id);
        if (i >= 0) {
          const next = [...list];
          next[i] = { ...next[i]!, target };
          setActiveIdx(i);
          return next;
        }
        setActiveIdx(list.length);
        return [...list, { target, detail: undefined }];
      });
      if (["person", "company", "document", "akta", "checklist"].includes(target.kind)) {
        getCitationDetail(target.kind, target.id).then((detail) =>
          setOpened((list) => list.map((o) => (o.target.id === target.id ? { ...o, detail } : o))));
      }
    });
    return () => { setEmbedded(false); setCiteHandler(null); };
  }, [setEmbedded, setCiteHandler]);

  const active = opened[activeIdx];
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col"><Conversation /></div>
      <aside aria-label="Panel dokumen" className="hidden w-[min(42vw,520px)] shrink-0 flex-col border-l border-border bg-pane lg:flex">
        {opened.length > 0 && (
          <div className="flex gap-0.5 overflow-x-auto border-b border-border px-3 pt-2.5">
            {opened.map((o, i) => (
              <div key={`${o.target.kind}-${o.target.id}`}
                className={cn("-mb-px flex items-center gap-1 rounded-t-md border border-transparent px-2.5 py-1.5 text-[12.5px] whitespace-nowrap text-muted-foreground",
                  i === activeIdx && "border-border border-b-pane bg-pane font-medium text-foreground")}>
                <button type="button" onClick={() => setActiveIdx(i)}>{o.target.label.split(",")[0]}</button>
                <button type="button" aria-label={`Tutup ${o.target.label}`} className="text-subtle hover:text-foreground"
                  onClick={() => { setOpened((l) => l.filter((_, j) => j !== i)); setActiveIdx((a) => Math.max(0, a > i ? a - 1 : a === i ? i - 1 : a)); }}>
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-7 py-7">
          {!active ? (
            <p className="py-16 text-center text-[13px] text-subtle">Klik sumber pada jawaban agen untuk membukanya di sini.</p>
          ) : active.detail === undefined && ["person", "company", "document", "akta", "checklist"].includes(active.target.kind) ? (
            <p className="agent-pulse text-[13px] text-subtle">Membuka {active.target.label}…</p>
          ) : !active.detail ? (
            <div className="space-y-3">
              <div className="font-serif text-[20px]">{active.target.label}</div>
              <Link href={active.target.href} className="inline-flex items-center gap-1 text-[13px] underline-offset-2 hover:underline">
                Buka halamannya <ExternalLink size={12} />
              </Link>
            </div>
          ) : (
            <div>
              <div className="mb-1 font-serif text-[20px]">{active.detail.title}</div>
              <div className="mb-4 text-[12px] text-subtle">{active.detail.subtitle}</div>
              <dl className="rounded-md border border-border bg-card">
                {active.detail.fields.map((f, i) => {
                  const hl = active.target.field === f.key;
                  return (
                    <div key={f.key} className={cn("grid grid-cols-[140px_1fr] gap-3 px-3.5 py-2.5 transition-colors", i && "border-t border-border-soft", hl && "bg-highlight")}>
                      <dt className="text-[12.5px] text-muted-foreground">{f.label}</dt>
                      <dd className={cn("text-[13.5px] tabular-nums", f.value === "Belum ada" && "text-destructive")}>{f.value}</dd>
                    </div>
                  );
                })}
              </dl>
              <div className="mt-4 flex gap-3 text-[12.5px]">
                {active.detail.download && (
                  <a href={active.detail.download} className="inline-flex items-center gap-1 underline-offset-2 hover:underline"><Download size={12} /> Unduh dokumen</a>
                )}
                <Link href={active.detail.href} className="inline-flex items-center gap-1 underline-offset-2 hover:underline">Buka halamannya <ExternalLink size={12} /></Link>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
