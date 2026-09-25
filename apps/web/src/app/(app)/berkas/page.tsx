import Link from "next/link";
import { FileText, Files, FolderOpen, ListChecks } from "lucide-react";
import { AgentPageContext } from "@/components/agent/agent-provider";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState, FilterChips, SearchForm } from "@/components/ui/blocks";
import { requirePrincipal } from "@/lib/auth";
import { berkasType } from "@/lib/berkas-types";
import { likeTerm } from "@/lib/search/akta";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { NewBerkasForm } from "./new-berkas-form";

const STATUS = [
  { value: "aktif", label: "Aktif" },
  { value: "selesai", label: "Selesai" },
  { value: "ditutup", label: "Ditutup" },
];
const count = (x: unknown) => (Array.isArray(x) ? Number((x[0] as { count?: number })?.count ?? 0) : 0);

export default async function BerkasListPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const me = await requirePrincipal();
  const { status, q } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("berkas")
    .select("id, title, type, status, workflow_step, created_at, updated_at, pic_user_id, akta(count), documents(count), checklist_items(count)")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (status && STATUS.some((s) => s.value === status)) query = query.eq("status", status);
  if (q?.trim()) query = query.ilike("title", likeTerm(q));
  const [{ data: rows, error }, { data: colleagues }, { data: all }] = await Promise.all([
    query,
    supabase.from("tenant_members").select("user_id, display_name").eq("tenant_id", me.tenantId),
    supabase.from("berkas").select("status"),
  ]);
  const nameOf = new Map((colleagues ?? []).map((c) => [c.user_id, c.display_name]));
  const counts = Object.fromEntries(STATUS.map((s) => [s.value, (all ?? []).filter((b) => b.status === s.value).length]));
  const content = me.role !== "super_admin";

  const scope =
    me.role === "notaris" || me.role === "super_admin" ? "Semua berkas kantor" : "Berkas tempat Anda ditugaskan";

  return (
    <>
      <AgentPageContext context={{ kind: "kantor", label: "Seluruh kantor", page: "lainnya" }} suggestions={["buka berkas Sinar Kopi", "tenggat minggu ini", "akta menunggu TTD"]} />
      <PageHeader eyebrow={scope} title="Berkas" meta={<span>{(all ?? []).length} berkas · {counts.aktif ?? 0} aktif</span>}
        actions={content ? <NewBerkasForm /> : undefined} />
      <div className="w-full max-w-[1180px] space-y-5 px-8 pt-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips base="/berkas" param="status" value={status} extra={{ q }}
            options={STATUS.map((s) => ({ ...s, count: counts[s.value] }))} />
          <SearchForm action="/berkas" value={q} placeholder="Cari nama berkas" hidden={{ status }} />
        </div>
        {error && <p role="alert" className="text-destructive">Daftar berkas gagal dimuat.</p>}
        {rows && rows.length === 0 && (
          <EmptyState icon={<FolderOpen size={18} />}>{q || status ? "Tidak ada berkas yang cocok." : "Belum ada berkas. Buat berkas baru untuk mulai."}</EmptyState>
        )}
        {rows && rows.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((b) => {
              const type = berkasType(b.type);
              const steps = type?.steps ?? [];
              const step = Math.max(0, b.workflow_step ? steps.indexOf(b.workflow_step) : 0);
              return (
                <li key={b.id}>
                  <Link href={`/berkas/${b.id}`}
                    className="group flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-[box-shadow,border-color] hover:border-[#d9d6ce] hover:shadow-surface">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"><FolderOpen size={16} /></span>
                      <Badge tone={b.status === "aktif" ? "info" : b.status === "selesai" ? "success" : "neutral"}>
                        {STATUS.find((s) => s.value === b.status)?.label ?? b.status}
                      </Badge>
                    </div>
                    <div className="text-[12px] text-subtle">{type?.label ?? b.type}</div>
                    <div className="mt-0.5 line-clamp-2 text-[15px] leading-snug font-medium">{b.title}</div>
                    {steps.length > 0 && (
                      <div className="mt-3" aria-label={`Langkah ${step + 1} dari ${steps.length}: ${steps[step]}`}>
                        <div className="flex gap-1">
                          {steps.map((s, i) => (
                            <span key={s} className={`h-1 flex-1 rounded-full ${i < step || b.status === "selesai" ? "bg-foreground" : i === step ? "bg-foreground/45" : "bg-muted"}`} />
                          ))}
                        </div>
                        <div className="mt-1.5 text-[12px] text-muted-foreground">{b.status === "selesai" ? "Selesai" : steps[step]}</div>
                      </div>
                    )}
                    <div className="mt-auto flex items-center gap-3 pt-4 text-[12px] text-subtle">
                      <span className="inline-flex items-center gap-1"><FileText size={12} />{count(b.akta)} akta</span>
                      <span className="inline-flex items-center gap-1"><Files size={12} />{count(b.documents)} dok</span>
                      <span className="inline-flex items-center gap-1"><ListChecks size={12} />{count(b.checklist_items)}</span>
                      <span className="ml-auto truncate">{nameOf.get(b.pic_user_id ?? "")?.split(" ")[0] ?? "—"} · {formatDate(b.updated_at ?? b.created_at)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
