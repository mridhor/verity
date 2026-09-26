import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState, FilterChips, SearchForm, Table, td } from "@/components/ui/blocks";
import { Dot } from "@/components/ui/input";
import { AUDIT_MODULES, auditDetail, auditLabel, auditModule } from "@/lib/audit-labels";
import { requirePrincipal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit log" };

const ACTOR = { human: "Manusia", agent: "Agen", worker: "Worker", system: "Sistem" } as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ modul?: string; q?: string }> }) {
  const me = await requirePrincipal();
  if (me.role !== "notaris" && me.role !== "super_admin") notFound();
  const { modul, q } = await searchParams;
  const supabase = await createClient();
  const mod = AUDIT_MODULES.find((m) => m.id === modul);
  let query = supabase.from("audit_log").select("id, occurred_at, actor_type, actor_user_id, action, target_type, berkas_id, details")
    .order("id", { ascending: false }).limit(500);
  if (mod) query = query.or(mod.prefixes.map((p) => `action.like.${p}*`).join(","));
  const [{ data: rows }, { data: colleagues }, { data: berkas }, chain, { count: total }] = await Promise.all([
    query,
    supabase.from("tenant_members").select("user_id, display_name").eq("tenant_id", me.tenantId),
    supabase.from("berkas").select("id, title"),
    supabase.rpc("audit_chain_status"),
    supabase.from("audit_log").select("id", { count: "exact", head: true }),
  ]);
  const nameOf = new Map((colleagues ?? []).map((c) => [c.user_id, c.display_name]));
  const berkasOf = new Map((berkas ?? []).map((b) => [b.id, b.title]));
  const needle = q?.toLowerCase();
  const filtered = (rows ?? []).filter((r) => !needle || [auditLabel(r.action), nameOf.get(r.actor_user_id ?? "") ?? "", berkasOf.get(r.berkas_id ?? "") ?? "", auditDetail(r.action, r.details)]
    .some((s) => s.toLowerCase().includes(needle)));
  const intact = !chain.error && chain.data === null;
  const exportHref = `/admin/audit/ekspor${modul ? `?modul=${modul}` : ""}`;

  return (
    <>
      <PageHeader
        eyebrow="Administrasi"
        title="Audit log"
        meta={
          <>
            <span>{(total ?? 0).toLocaleString("id-ID")} aktivitas tercatat</span>
            <span className="inline-flex items-center gap-1.5">
              <Dot tone={intact ? "success" : "destructive"} />
              {chain.error ? "Integritas tidak dapat diperiksa" : intact ? "Rantai hash utuh" : `Rantai hash rusak mulai entri #${chain.data}`}
            </span>
          </>
        }
        actions={
          <a href={exportHref} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-[13px] font-medium shadow-card hover:bg-muted">
            <Download size={13} /> Ekspor CSV
          </a>
        }
      />
      <div className="w-full max-w-[1100px] space-y-4 px-8 pt-5 pb-10">
        <p className="text-[12px] text-subtle">
          Log ini tidak dapat diubah atau dihapus oleh siapa pun. Isi dokumen dan data klien tidak pernah dicatat di sini, hanya siapa melakukan apa dan kapan.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips base="/admin/audit" param="modul" value={modul} extra={{ q }} options={AUDIT_MODULES.map((m) => ({ value: m.id, label: m.label }))} />
          <SearchForm action="/admin/audit" value={q} placeholder="Cari tindakan, pengguna, berkas, detail" hidden={{ modul }} />
        </div>
        {filtered.length === 0 ? <EmptyState>Tidak ada aktivitas yang cocok.</EmptyState> : (
          <Table head={["#", "Waktu", "Pengguna", "Tindakan", "Detail", "Berkas", "Modul"]}>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className={`${td} tabular-nums text-subtle`}>{r.id}</td>
                <td className={`${td} tabular-nums text-muted-foreground whitespace-nowrap`}>{formatDateTime(r.occurred_at)}</td>
                <td className={td}>
                  {nameOf.get(r.actor_user_id ?? "") ?? "—"}{" "}
                  <span className="text-[11.5px] text-subtle">({ACTOR[r.actor_type as keyof typeof ACTOR]})</span>
                </td>
                <td className={td}>{auditLabel(r.action)}</td>
                <td className={`${td} text-[12.5px] text-muted-foreground`}>{auditDetail(r.action, r.details) || <span className="text-subtle">—</span>}</td>
                <td className={`${td} text-muted-foreground`}>{berkasOf.get(r.berkas_id ?? "") ?? (r.berkas_id ? "(tidak dapat dilihat)" : "—")}</td>
                <td className={`${td} text-muted-foreground`}>{auditModule(r.action)?.label ?? "Lainnya"}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </>
  );
}
