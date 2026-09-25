import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SearchForm, StatCard } from "@/components/ui/blocks";
import { Button } from "@/components/ui/button";
import { requirePrincipal } from "@/lib/auth";
import { jakartaToday } from "@/lib/jakarta-time";
import { PROTOKOL_STATUS_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { markReceived } from "./actions";
import { TransferForm } from "./transfer-form";

export default async function ProtokolPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requirePrincipal();
  if (me.role === "super_admin") notFound();
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: tenant } = await supabase.from("tenants").select("kind").eq("id", me.tenantId).single();
  if (tenant?.kind !== "kantor_notaris") notFound();
  const { data } = await supabase.from("protokol_transfers")
    .select("id, source_notaris_name, sk_ref, wilayah, handover_date, akta_count, year_range, status, notes")
    .order("handover_date", { ascending: false });
  const all = data ?? [];
  const rows = all.filter((p) => !q || `${p.source_notaris_name} ${p.wilayah ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const isNotaris = me.role === "notaris";

  return (
    <>
      <PageHeader eyebrow="Register" title="Transfer protokol notaris" meta={<span>Arsip yang diterima dari notaris lain yang pensiun, pindah, atau berhalangan tetap.</span>} />
      <div className="w-full max-w-[1000px] space-y-5 px-8 pt-5 pb-10">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Serah terima tercatat" value={all.length} />
          <StatCard label="Total akta protokol" value={all.reduce((a, p) => a + p.akta_count, 0).toLocaleString("id-ID")} />
          <StatCard label="Dalam proses" value={all.filter((p) => p.status === "dalam_proses").length} />
        </div>
        {isNotaris ? <TransferForm today={jakartaToday().date} /> : <p className="text-[12.5px] text-subtle">Hanya Notaris yang dapat mencatat serah terima protokol.</p>}
        <SearchForm action="/protokol" value={q} placeholder="Cari nama notaris atau wilayah" />
        {rows.length === 0 ? <EmptyState>Belum ada serah terima protokol.</EmptyState> : (
          <ul className="space-y-2.5">
            {rows.map((p) => (
              <li key={p.id} className="rounded-md border border-border bg-card px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-serif text-[16px]">{p.source_notaris_name}</div>
                    <div className="text-[12px] text-subtle">{[p.sk_ref && `SK ${p.sk_ref}`, p.wilayah].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <Badge tone={p.status === "diterima" ? "success" : "warning"}>{PROTOKOL_STATUS_LABEL[p.status as "dalam_proses" | "diterima"]}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-3 text-[12.5px]">
                  <div><dt className="text-subtle">Jumlah akta</dt><dd className="font-medium tabular-nums">{p.akta_count.toLocaleString("id-ID")}</dd></div>
                  <div><dt className="text-subtle">Rentang tahun</dt><dd className="font-medium">{p.year_range ?? "—"}</dd></div>
                  <div><dt className="text-subtle">Tanggal serah terima</dt><dd className="font-medium">{formatDate(p.handover_date)}</dd></div>
                </dl>
                {p.notes && <p className="mt-2 text-[12.5px] text-muted-foreground">{p.notes}</p>}
                {isNotaris && p.status === "dalam_proses" && (
                  <form action={markReceived} className="mt-3">
                    <input type="hidden" name="id" value={p.id} />
                    <Button size="sm" variant="primary">Tandai sudah diterima</Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
