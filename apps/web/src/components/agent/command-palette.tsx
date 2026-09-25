"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchEverything, type SearchHit } from "./actions";
import { useAgent } from "./agent-provider";

const PAGES: SearchHit[] = [
  ["Beranda", "/beranda"], ["Berkas", "/berkas"], ["Akta", "/akta"], ["Jadwal", "/jadwal"], ["Minuta & dokumen", "/dokumen"],
  ["Repertorium", "/register/repertorium"], ["Buku klapper", "/register/klapper"], ["Protokol notaris", "/protokol"],
  ["Dasar hukum", "/dasar-hukum"], ["Keamanan", "/keamanan"], ["Pengguna", "/admin/pengguna"], ["Audit log", "/admin/audit"],
].map(([label, href]) => ({ group: "Lompat ke", label: label!, href: href! }));

type Item = { kind: "ask"; label: string } | { kind: "hit"; hit: SearchHit };

/** Navigator (⌘K): search everything the user may see, jump to pages, or ask the agent. */
export function CommandPalette() {
  const { paletteOpen } = useAgent();
  // Mounted only while open, so every opening starts empty.
  return paletteOpen ? <Palette /> : null;
}

function Palette() {
  const router = useRouter();
  const { setPaletteOpen, setOpen, send } = useAgent();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ term: string; hits: SearchHit[] }>({ term: "", hits: [] });
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const opener = document.activeElement;
    input.current?.focus();
    return () => { if (opener instanceof HTMLElement) opener.focus(); };
  }, []);

  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) return;
    const t = setTimeout(() => {
      searchEverything(term).then((hits) => setResult({ term, hits })).catch(() => setResult({ term, hits: [] }));
    }, 180);
    return () => clearTimeout(t);
  }, [term]);
  const hits = useMemo(() => (term.length >= 2 && result.term === term ? result.hits : []), [term, result]);

  const items = useMemo<Item[]>(() => {
    const lower = term.toLowerCase();
    const pages = PAGES.filter((p) => !lower || p.label.toLowerCase().includes(lower));
    return [
      ...(term ? [{ kind: "ask" as const, label: term }] : []),
      ...hits.map((hit) => ({ kind: "hit" as const, hit })),
      ...pages.map((hit) => ({ kind: "hit" as const, hit })),
    ];
  }, [term, hits]);

  const choose = (item: Item) => {
    setPaletteOpen(false);
    if (item.kind === "ask") { setOpen(true); void send(item.label); }
    else router.push(item.hit.href);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); setPaletteOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && items[idx]) { e.preventDefault(); choose(items[idx]!); }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-foreground/20 px-4 pt-[12vh]" onMouseDown={() => setPaletteOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Cari dan tanya" onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[600px] overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_24px_60px_-24px_rgba(40,36,20,.45)]">
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search size={15} className="text-subtle" aria-hidden />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey}
            role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={items[idx] ? `palette-${idx}` : undefined}
            placeholder="Cari berkas, akta, orang, dokumen, atau tanya agen…"
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle" />
          <kbd className="rounded border border-border px-1.5 text-[10.5px] text-subtle">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto py-1.5">
          {items.map((item, i) => {
            const group = item.kind === "ask" ? "Agen" : item.hit.group;
            const header = group !== lastGroup ? group : null;
            lastGroup = group;
            return (
              <li key={`${group}-${i}`} role="presentation">
                {header && <div className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-[0.06em] text-subtle">{header}</div>}
                <div id={`palette-${i}`} role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => choose(item)}
                  className={cn("mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px]", i === idx && "bg-border-soft")}>
                  {item.kind === "ask" ? (
                    <>
                      <Sparkles size={14} className="text-primary" aria-hidden />
                      <span className="flex-1 truncate">Tanya agen: <span className="font-medium">{item.label}</span></span>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.hit.label}</span>
                        {item.hit.sub && <span className="block truncate text-[11.5px] text-subtle">{item.hit.sub}</span>}
                      </span>
                      <ArrowRight size={13} className="text-subtle" aria-hidden />
                    </>
                  )}
                </div>
              </li>
            );
          })}
          {term.length >= 2 && result.term === term && hits.length === 0 && <li className="px-4 py-2 text-[12.5px] text-subtle">Tidak ada data yang cocok. Tekan Enter untuk bertanya ke agen.</li>}
        </ul>
      </div>
    </div>
  );
}

export function PaletteTrigger() {
  const { setPaletteOpen } = useAgent();
  return (
    <button type="button" onClick={() => setPaletteOpen(true)}
      title="Cari (⌘K)"
      className="flex w-full items-center gap-2 rounded-lg bg-card px-2.5 py-[7px] text-left text-[12.5px] text-subtle shadow-surface transition-colors hover:text-muted-foreground group-data-[collapsed=true]/side:justify-center">
      <Search size={14} aria-hidden className="shrink-0" />
      <span className="flex-1 group-data-[collapsed=true]/side:sr-only">Cari berkas, klien, akta</span>
      <kbd className="rounded border border-border px-1 font-sans text-[10.5px] group-data-[collapsed=true]/side:hidden">⌘K</kbd>
    </button>
  );
}
