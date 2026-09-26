import { notFound } from "next/navigation";
import { DocumentTable, type DocumentRow } from "@/components/documents/document-table";
import { UploadForm } from "@/components/documents/upload-form";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState, FilterChips, SearchForm, StatCard } from "@/components/ui/blocks";
import { requirePrincipal } from "@/lib/auth";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL, fileFormat, formatAktaNumber } from "@/lib/labels";
import { likeTerm, parseAktaNumber } from "@/lib/search/akta";
import { createClient } from "@/lib/supabase/server";
import { AgentPageContext } from "@/components/agent/agent-provider";

export const metadata = { title: "Minuta & dokumen" };

const FORMATS = ["PDF", "JPG", "PNG", "DOCX"];

export default async function DokumenPage({ searchParams }: { searchParams: Promise<{ jenis?: string; format?: string; q?: string }> }) {
  const me = await requirePrincipal();
  if (me.role === "super_admin") notFound();
  const { jenis, format, q } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("documents")
    .select("id, title, doc_type, file_name, mime_type, size_bytes, uploaded_at, uploaded_by, berkas(id, title), akta(id, title, number, number_period)")
    .order("uploaded_at", { ascending: false }).limit(300);
  if (jenis && (DOCUMENT_TYPES as readonly string[]).includes(jenis)) query = query.eq("doc_type", jenis);
  if (q?.trim()) {
    // Title, file name, or the akta number the document belongs to ("001/2026").
    const num = parseAktaNumber(q);
    let ids: string[] = [];
    if (num) {
      let aq = supabase.from("akta").select("id").eq("number", num.number);
      if (num.period) aq = aq.eq("number_period", num.period);
      ids = ((await aq.limit(50)).data ?? []).map((a) => a.id);
    }
    const like = likeTerm(q);
    query = query.or([`title.ilike.${like}`, `file_name.ilike.${like}`, ...(ids.length ? [`akta_id.in.(${ids.join(",")})`] : [])].join(","));
  }
  const [{ data }, { data: berkas }, { data: akta }, { data: colleagues }, all] = await Promise.all([
    query,
    supabase.from("berkas").select("id, title").eq("status", "aktif").order("title"),
    supabase.from("akta").select("id, title, berkas_id, number, number_period").order("created_at", { ascending: false }).limit(300),
    supabase.from("tenant_members").select("user_id, display_name").eq("tenant_id", me.tenantId),
    supabase.from("documents").select("doc_type"),
  ]);
  const rows = ((data ?? []) as unknown as DocumentRow[]).filter((d) => !format || fileFormat(d.mime_type) === format);
  const counts = (all.data ?? []).reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.doc_type]: (acc[d.doc_type] ?? 0) + 1 }), {});
  const total = all.data?.length ?? 0;
  const identity = (counts.ktp ?? 0) + (counts.kk ?? 0) + (counts.npwp ?? 0);

  return (
    <>
      <AgentPageContext context={{ kind: "kantor", label: "Minuta & dokumen", page: "dokumen" }} suggestions={["dokumen KTP Laras", "dokumen terbaru", "minuta akta final bulan ini"]} />
      <PageHeader eyebrow="Arsip dokumen berkas, tersimpan privat dan tercatat setiap aksesnya" title="Minuta & dokumen"
        meta={<span>{total} dokumen · {counts.minuta ?? 0} minuta</span>}
        actions={
          <UploadForm
            tenantId={me.tenantId}
            berkas={(berkas ?? []).map((b) => ({ id: b.id, label: b.title }))}
            akta={(akta ?? []).map((a) => ({ id: a.id, berkasId: a.berkas_id, label: formatAktaNumber(a.number, a.number_period) ? `${formatAktaNumber(a.number, a.number_period)} · ${a.title}` : a.title }))}
          />
        } />
      <div className="w-full max-w-[1180px] space-y-5 px-8 pt-5 pb-10">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total dokumen" value={total} href="/dokumen" />
          <StatCard label="Minuta akta" value={counts.minuta ?? 0} href="/dokumen?jenis=minuta" />
          <StatCard label="Identitas (KTP/KK/NPWP)" value={identity} href="/dokumen?jenis=ktp" />
          <StatCard label="Lainnya" value={Math.max(0, total - (counts.minuta ?? 0) - identity)} sub={`Termasuk ${counts.sertifikat ?? 0} sertifikat`} />
        </div>
        <div className="space-y-2">
          <FilterChips base="/dokumen" param="jenis" value={jenis} extra={{ format, q }}
            options={DOCUMENT_TYPES.filter((t) => counts[t]).map((t) => ({ value: t, label: DOCUMENT_TYPE_LABEL[t], count: counts[t] }))} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-2">
            <div className="flex items-center gap-2 text-[12.5px] text-subtle">
              Format
              <FilterChips base="/dokumen" param="format" value={format} extra={{ jenis, q }} options={FORMATS.map((f) => ({ value: f, label: f }))} />
            </div>
            <SearchForm action="/dokumen" value={q} placeholder="Cari judul, file, atau nomor akta" hidden={{ jenis, format }} />
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState>{q || jenis || format ? "Tidak ada dokumen yang cocok." : "Belum ada dokumen."}</EmptyState>
        ) : (
          <DocumentTable rows={rows} nameOf={new Map((colleagues ?? []).map((c) => [c.user_id, c.display_name]))} />
        )}
        <p className="text-[12px] text-subtle">
          Dokumen tidak dapat diubah atau dihapus lewat aplikasi; minuta termasuk protokol yang wajib disimpan.
        </p>
      </div>
    </>
  );
}
