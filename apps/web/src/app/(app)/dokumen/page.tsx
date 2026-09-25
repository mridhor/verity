import { notFound } from "next/navigation";
import { DocumentTable, type DocumentRow } from "@/components/documents/document-table";
import { UploadForm } from "@/components/documents/upload-form";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState, FilterChips, SearchForm, StatCard } from "@/components/ui/blocks";
import { requirePrincipal } from "@/lib/auth";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL, fileFormat, formatAktaNumber } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { AgentPageContext } from "@/components/agent/agent-provider";

const FORMATS = ["PDF", "JPG", "PNG", "DOCX"];

export default async function DokumenPage({ searchParams }: { searchParams: Promise<{ jenis?: string; format?: string; q?: string }> }) {
  const me = await requirePrincipal();
  if (me.role === "super_admin") notFound();
  const { jenis, format, q } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("documents")
    .select("id, title, doc_type, file_name, mime_type, size_bytes, uploaded_at, uploaded_by, berkas(id, title)")
    .order("uploaded_at", { ascending: false }).limit(300);
  if (jenis && (DOCUMENT_TYPES as readonly string[]).includes(jenis)) query = query.eq("doc_type", jenis);
  if (q) { const s = q.replace(/[%,()]/g, " "); query = query.or(`title.ilike.%${s}%,file_name.ilike.%${s}%`); }
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

  return (
    <>
      <AgentPageContext context={{ kind: "kantor", label: "Minuta & dokumen", page: "dokumen" }} suggestions={["dokumen KTP Laras", "dokumen terbaru", "minuta akta final bulan ini"]} />
      <PageHeader eyebrow="Arsip dokumen berkas, tersimpan privat dan tercatat setiap aksesnya" title="Minuta & dokumen" />
      <div className="mx-auto w-full max-w-[1100px] space-y-5 px-8 py-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total dokumen" value={total} />
          <StatCard label="Minuta akta" value={counts.minuta ?? 0} />
          <StatCard label="Identitas (KTP/KK/NPWP)" value={(counts.ktp ?? 0) + (counts.kk ?? 0) + (counts.npwp ?? 0)} />
          <StatCard label="Sertifikat" value={counts.sertifikat ?? 0} />
        </div>
        <UploadForm
          tenantId={me.tenantId}
          berkas={(berkas ?? []).map((b) => ({ id: b.id, label: b.title }))}
          akta={(akta ?? []).map((a) => ({ id: a.id, berkasId: a.berkas_id, label: formatAktaNumber(a.number, a.number_period) ? `${formatAktaNumber(a.number, a.number_period)} · ${a.title}` : a.title }))}
        />
        <div className="flex flex-wrap items-center gap-3">
          <SearchForm action="/dokumen" value={q} placeholder="Cari judul atau nama file" hidden={{ jenis, format }} />
          <FilterChips base="/dokumen" param="format" value={format} extra={{ jenis, q }} options={FORMATS.map((f) => ({ value: f, label: f }))} />
        </div>
        <FilterChips base="/dokumen" param="jenis" value={jenis} extra={{ format, q }}
          options={DOCUMENT_TYPES.map((t) => ({ value: t, label: DOCUMENT_TYPE_LABEL[t] }))} />
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
