import { Star } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState, FilterChips, SearchForm } from "@/components/ui/blocks";
import { Button } from "@/components/ui/button";
import { requirePrincipal } from "@/lib/auth";
import { LEGAL_CATEGORIES, LEGAL_CATEGORY_LABEL, LEGAL_STATUS_LABEL, type LegalCategory } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { toggleBookmark, verifyReference } from "./actions";
import { ReferenceForm } from "./reference-form";
import { AgentPageContext } from "@/components/agent/agent-provider";

type Ref = {
  id: string; category: LegalCategory; number_label: string; title: string; year: number | null;
  status: "berlaku" | "diubah" | "dicabut"; source_url: string | null; verified_by: string | null; verified_at: string | null;
};

export default async function DasarHukumPage({ searchParams }: { searchParams: Promise<{ kategori?: string; q?: string }> }) {
  const me = await requirePrincipal();
  const { kategori, q } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("legal_references")
    .select("id, category, number_label, title, year, status, source_url, verified_by, verified_at")
    .order("year", { ascending: false, nullsFirst: false }).limit(500);
  if (kategori && (LEGAL_CATEGORIES as readonly string[]).includes(kategori)) query = query.eq("category", kategori);
  if (q) { const s = q.replace(/[%,()]/g, " "); query = query.or(`title.ilike.%${s}%,number_label.ilike.%${s}%`); }
  const [{ data }, { data: marks }, { data: colleagues }] = await Promise.all([
    query,
    supabase.from("legal_bookmarks").select("reference_id"),
    supabase.from("tenant_members").select("user_id, display_name").eq("tenant_id", me.tenantId),
  ]);
  const rows = (data ?? []) as Ref[];
  const marked = new Set((marks ?? []).map((m) => m.reference_id));
  const nameOf = new Map((colleagues ?? []).map((c) => [c.user_id, c.display_name]));
  const canWrite = me.role !== "super_admin";

  const Item = ({ r }: { r: Ref }) => (
    <li className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{LEGAL_CATEGORY_LABEL[r.category]}</Badge>
          <span className="text-[12px] font-medium tabular-nums text-muted-foreground">{r.number_label}{r.year ? ` · ${r.year}` : ""}</span>
          {r.status !== "berlaku" && <Badge tone="danger">{LEGAL_STATUS_LABEL[r.status]}</Badge>}
        </div>
        <div className="mt-1 text-[13.5px] font-medium">{r.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11.5px] text-subtle">
          {r.verified_by
            ? <span className="text-success">Terverifikasi oleh {nameOf.get(r.verified_by) ?? "Notaris"}{r.verified_at ? `, ${formatDate(r.verified_at)}` : ""}</span>
            : <span>Belum terverifikasi</span>}
          {r.source_url && <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">Buka sumber resmi</a>}
          {!r.verified_by && me.role === "notaris" && (
            <form action={verifyReference}>
              <input type="hidden" name="id" value={r.id} />
              <button className="font-medium text-primary hover:underline">Verifikasi</button>
            </form>
          )}
        </div>
      </div>
      <form action={toggleBookmark}>
        <input type="hidden" name="id" value={r.id} />
        <input type="hidden" name="on" value={marked.has(r.id) ? "0" : "1"} />
        <Button size="icon" variant="ghost" aria-label={marked.has(r.id) ? "Hapus penanda" : "Tandai"} aria-pressed={marked.has(r.id)}>
          <Star size={15} className={marked.has(r.id) ? "fill-warning text-warning" : ""} />
        </Button>
      </form>
    </li>
  );

  const bookmarked = rows.filter((r) => marked.has(r.id));
  return (
    <>
      <AgentPageContext context={{ kind: "kantor", label: "Dasar hukum", page: "dasar_hukum" }} suggestions={["dasar hukum fidusia", "dasar hukum jabatan notaris", "dasar hukum perseroan terbatas"]} />
      <PageHeader eyebrow="Referensi" title="Portal dasar hukum"
        meta={<span>Referensi peraturan dan putusan untuk kenotariatan. Setiap entri perlu diverifikasi Notaris sebelum diandalkan.</span>} />
      <div className="mx-auto w-full max-w-[1000px] space-y-5 px-8 py-7">
        {canWrite && <ReferenceForm />}
        <div className="flex flex-wrap items-center gap-3">
          <SearchForm action="/dasar-hukum" value={q} placeholder="Cari judul atau nomor peraturan" hidden={{ kategori }} />
        </div>
        <FilterChips base="/dasar-hukum" param="kategori" value={kategori} extra={{ q }}
          options={LEGAL_CATEGORIES.map((c) => ({ value: c, label: LEGAL_CATEGORY_LABEL[c] }))} />
        {!kategori && !q && bookmarked.length > 0 && (
          <section>
            <h2 className="mb-2 text-[12.5px] font-semibold text-muted-foreground">Ditandai</h2>
            <ul className="space-y-2">{bookmarked.map((r) => <Item key={`b-${r.id}`} r={r} />)}</ul>
          </section>
        )}
        {rows.length === 0 ? <EmptyState>{q || kategori ? "Tidak ada referensi yang cocok." : "Belum ada referensi."}</EmptyState> : (
          <section>
            {!kategori && !q && bookmarked.length > 0 && <h2 className="mb-2 text-[12.5px] font-semibold text-muted-foreground">Semua referensi</h2>}
            <ul className="space-y-2">{rows.map((r) => <Item key={r.id} r={r} />)}</ul>
          </section>
        )}
      </div>
    </>
  );
}
