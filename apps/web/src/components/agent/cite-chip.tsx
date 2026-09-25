"use client";

import { BookOpen, CalendarDays, ClipboardList, CreditCard, FileText, Folder, Library, ListChecks, Building2 } from "lucide-react";
import type { CitationTarget } from "@/lib/agent/types";
import { useAgent } from "./agent-provider";

const ICON = {
  berkas: Folder, akta: FileText, person: CreditCard, company: Building2, document: ClipboardList,
  checklist: ListChecks, schedule: CalendarDays, legal: Library, repertorium: BookOpen, klapper: BookOpen,
} as const;

export function CiteChip({ target }: { target: CitationTarget }) {
  const { onCite, activeCite } = useAgent();
  const Icon = ICON[target.kind];
  const key = `${target.kind}:${target.id}:${target.field ?? ""}`;
  return (
    <button type="button" className="cite" data-active={activeCite === key ? "1" : "0"} onClick={() => onCite(target)}
      title={`Buka sumber: ${target.label}`}>
      <Icon size={11} strokeWidth={2} aria-hidden />
      {target.label}
    </button>
  );
}

/** Text with [[cN]] markers rendered as citation chips. Unknown markers are dropped. */
export function RichText({ text, cites }: { text: string; cites: Map<string, CitationTarget> }) {
  const parts: React.ReactNode[] = [];
  const re = /\[\[(c\d+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    const t = cites.get(m[1]!);
    if (t) parts.push(<CiteChip key={k++} target={t} />);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(<span key={k++}>{text.slice(last)}</span>);
  return <>{parts}</>;
}
