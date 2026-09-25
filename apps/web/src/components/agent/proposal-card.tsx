"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { decideProposal, getProposals, type ProposalView } from "./actions";

const STATUS_NOTE: Record<ProposalView["status"], string> = {
  pending: "",
  applied: "Diterapkan ke database",
  rejected: "Ditolak, tidak ada perubahan",
  stale: "Data sudah berubah sejak usulan dibuat; minta agen menyusun ulang",
  expired: "Kedaluwarsa",
};

function Stamp({ who, when }: { who: string; when: string }) {
  return (
    <div className="stamp" aria-label={`Disetujui oleh ${who}`}>
      <div className="font-serif text-[15px] font-semibold tracking-[0.02em]">Disetujui</div>
      <div className="mt-0.5 max-w-[88px] truncate text-[10.5px]">{who}</div>
      <div className="text-[10px] tabular-nums opacity-85">{when}</div>
    </div>
  );
}

/** "Perubahan yang diusulkan" (PRD-A-03). Nothing changes until a permitted human approves. */
export function ProposalCards({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [items, setItems] = useState<ProposalView[] | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const idsKey = ids.join(",");

  const load = useCallback(() => getProposals(idsKey.split(",").filter(Boolean)).then(setItems).catch(() => setItems([])), [idsKey]);
  useEffect(() => { load(); }, [load]);

  const decide = (id: string, decision: "approve" | "reject") => start(async () => {
    setError(undefined);
    const res = await decideProposal(id, decision);
    if (res.error) setError(res.error);
    await load();
    router.refresh();
  });

  if (!items) return <div className="mt-4 h-24 animate-pulse rounded-md border border-border bg-card" aria-busy />;
  return (
    <div className="mt-4 space-y-3">
      {items.map((p) => (
        <div key={p.id} className={cn("relative rounded-md border bg-card px-4 py-3.5", p.status === "applied" ? "border-primary" : "border-border")}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <div className="text-[13.5px] font-semibold">Perubahan yang diusulkan</div>
            <div className="text-[12px] text-subtle">
              {p.status === "pending" ? (p.tier === "notaris" ? "Perlu persetujuan Notaris" : "Perlu persetujuan staf berkas") : STATUS_NOTE[p.status]}
            </div>
          </div>
          <ol className={cn("list-decimal space-y-1 pl-5 text-[13px] leading-relaxed", p.status === "applied" && "pr-28")}>
            {p.items.map((i) => (
              <li key={i.label} className={cn(p.status === "rejected" || p.status === "stale" || p.status === "expired" ? "text-subtle line-through" : "")}>{i.label}</li>
            ))}
          </ol>
          {p.status === "pending" && (
            <div className="mt-3.5">
              <div className="flex gap-2">
                <Button variant="primary" disabled={!p.canDecide || pending} onClick={() => decide(p.id, "approve")} title={p.reason ?? undefined}>
                  <Check size={14} /> Setujui perubahan
                </Button>
                <Button disabled={!p.canDecide || pending} onClick={() => decide(p.id, "reject")}>
                  <X size={14} /> Tolak
                </Button>
              </div>
              {p.reason && <p className="mt-1.5 text-[11.5px] text-subtle">{p.reason}.</p>}
            </div>
          )}
          {p.status === "applied" && p.decidedBy && p.decidedAt && <Stamp who={p.decidedBy} when={p.decidedAt} />}
          {p.status === "applied" && <div className="h-16" aria-hidden />}
        </div>
      ))}
      {error && <p role="alert" className="text-[12.5px] text-destructive">{error}</p>}
    </div>
  );
}
