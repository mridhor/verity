import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, FileText, Star } from "lucide-react";
import { AgentPageContext } from "@/components/agent/agent-provider";
import { PageCrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/blocks";
import { Button } from "@/components/ui/button";
import { Properties } from "@/components/ui/sheet";
import { requirePrincipal } from "@/lib/auth";
import { LEGAL_CATEGORY_LABEL, LEGAL_STATUS_LABEL, type LegalCategory } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { toggleBookmark, verifyReference } from "../actions";
import { AttachLegalFile } from "./attach-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await (await createClient()).from("legal_references").select("number_label").eq("id", id).maybeSingle();
  return { title: data?.number_label ?? "Dasar hukum" };
}

export default async function DasarHukumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePrincipal();
  const { id } = await params;
  const supabase = await createClient();
  const { data: r } = await supabase.from("legal_references")
    .select("id, category, number_label, title, year, status, source_url, notes, verified_by, verified_at, file_path, created_by, created_at")
    .eq("id", id).maybeSingle();
  if (!r) notFound();
  const [{ data: mark }, { data: colleagues }] = await Promise.all([
    supabase.from("legal_bookmarks").select("reference_id").eq("reference_id", id).maybeSingle(),
    supabase.from("tenant_members").select("user_id, display_name").eq("tenant_id", me.tenantId),
  ]);
  const nameOf = new Map((colleagues ?? []).map((c) => [c.user_id, c.display_name]));
  const canWrite = me.role !== "super_admin";

  return (
    <>
      <PageCrumbs items={[{ label: "Referensi" }, { label: "Dasar hukum", href: "/dasar-hukum" }, { label: r.number_label }]} />
      <AgentPageContext context={{ kind: "kantor", label: `Dasar hukum: ${r.number_label}`, page: "dasar_hukum" }}
        suggestions={[`dasar hukum ${r.number_label}`, "dasar hukum jabatan notaris"]} />
      <PageHeader
        eyebrow={<Link href="/dasar-hukum" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft size={13} /> Portal dasar hukum</Link>}
        title={r.number_label}
        meta={<><span>{LEGAL_CATEGORY_LABEL[r.category as LegalCategory]}</span>{r.year && <span>Tahun {r.year}</span>}</>}
        actions={
          <>
            <form action={toggleBookmark}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="on" value={mark ? "0" : "1"} />
              <Button aria-pressed={!!mark}><Star size={14} className={mark ? "fill-warning text-warning" : ""} /> {mark ? "Ditandai" : "Tandai"}</Button>
            </form>
            {r.file_path && (
              <a href={`/dasar-hukum/${r.id}/unduh`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-[13px] font-medium text-card shadow-card hover:bg-foreground/85">
                <Download size={14} /> Unduh PDF
              </a>
            )}
          </>
        }
      />
      <div className="grid w-full max-w-[1100px] gap-5 px-8 pt-5 pb-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Section title="Judul">
            <p className="font-serif text-[20px] leading-snug">{r.title}</p>
            {r.notes && <p className="mt-3 text-[13.5px] leading-relaxed whitespace-pre-line text-muted-foreground">{r.notes}</p>}
          </Section>
          <Section title="Dokumen peraturan" actions={canWrite ? <AttachLegalFile tenantId={me.tenantId} referenceId={r.id} hasFile={!!r.file_path} /> : undefined}>
            {r.file_path ? (
              <a href={`/dasar-hukum/${r.id}/unduh`} className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3 transition-colors hover:bg-accent">
                <FileText size={18} className="text-[#c0392b]" />
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{r.file_path.split("/").pop()?.replace(/^[0-9a-f-]{36}-/, "")}</span>
                <Download size={14} className="text-subtle" />
              </a>
            ) : (
              <p className="py-2 text-[13px] text-subtle">Belum ada PDF terlampir.{r.source_url ? " Gunakan tautan sumber resmi di samping." : ""}</p>
            )}
            <p className="mt-3 text-[12px] text-subtle">Setiap unduhan dicatat di audit log.</p>
          </Section>
        </div>
        <aside className="space-y-5">
          <Section title="Status">
            <div className="mb-4 flex flex-wrap gap-1.5">
              <Badge tone={r.status === "berlaku" ? "success" : r.status === "diubah" ? "warning" : "danger"}>{LEGAL_STATUS_LABEL[r.status as "berlaku"]}</Badge>
              <Badge tone={r.verified_by ? "authority" : "neutral"}>{r.verified_by ? "Terverifikasi" : "Belum terverifikasi"}</Badge>
            </div>
            <Properties items={[
              { label: "Verifikasi", value: r.verified_by ? `${nameOf.get(r.verified_by) ?? "Notaris"}${r.verified_at ? `, ${formatDate(r.verified_at)}` : ""}` : "Perlu diperiksa Notaris" },
              { label: "Ditambahkan", value: `${r.created_by ? nameOf.get(r.created_by) ?? "—" : "Sistem"} · ${formatDate(r.created_at)}` },
              { label: "Sumber", value: r.source_url
                ? <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all hover:underline">Buka sumber resmi <ExternalLink size={11} /></a>
                : "—" },
            ]} />
            {!r.verified_by && me.role === "notaris" && (
              <form action={verifyReference} className="mt-4">
                <input type="hidden" name="id" value={r.id} />
                <Button variant="primary" className="w-full">Verifikasi referensi ini</Button>
              </form>
            )}
          </Section>
        </aside>
      </div>
    </>
  );
}
