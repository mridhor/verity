import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState, FilterChips, SearchForm, Table, td } from "@/components/ui/blocks";
import { Dot } from "@/components/ui/input";
import { AUDIT_MODULES, auditLabel, auditModule } from "@/lib/audit-labels";
import { requirePrincipal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

const ACTOR = { human: "Manusia", agent: "Agen", worker: "Worker", system: "Sistem" } as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ modul?: string; q?: string }> }) {
  const me = await requirePrincipal();
  if (me.role !== "notaris" && me.role !== "super_admin") notFound();
  const { modul, q } = await searchParams;
  const supabase = await createClient();
  const mod = AUDIT_MODULES.find((m) => m.id === modul);
  let query = supabase.from("audit_log").select("id, occurred_at, actor_type, actor_user_id, action, target_type, berkas_id")
    .order("id", { ascending: false }).limit(500);
  if (mod) query = query.or(mod.prefixes.map((p) => `action.like.${p}*`).join(","));
  const [{ data: rows }, { data: colleagues }, { data: berkas }, chain] = await Promise.all([
    query,
    supabase.from("tenant_members").select("user_id, display_name").eq("tenant_id", me.tenantId),
    supabase.from("berkas").select("id, title"),
    supabase.rpc("audit_chain_status"),
  ]);
  const nameOf = new Map((colleagues ?? []).map((c) => [c.user_id, c.display_name]));
  const berkasOf = new Map((berkas ?? []).map((b) => [b.id, b.title]));
  const needle = q?.toLowerCase();
  const filtered = (rows ?? []).filter((r) => !needle || [auditLabel(r.action), nameOf.get(r.actor_user_id ?? "") ?? "", berkasOf.get(r.berkas_id ?? "") ?? ""]
    .some((s) => s.toLowerCase().includes(needle)));
  const intact = !chain.error && chain.data === null;
  const exportHref = `/admin/audit/ekspor${modul ? `?modul=${modul}` : ""}`;

  return (
    <>
      <PageHeader
        eyebrow="Administrasi"
        title="Audit log"
        meta={
          <span className="inline-flex items-center gap-1.5">
            <Dot tone={intact ? "success" : "destructive"} />
            {chain.error ? "Integritas tidak dapat diperiksa" : intact ? "Rantai hash utuh" : `Rantai hash rusak mulai entri #${chain.data}`}
          </span>
        }
        actions={
          <a href={exportHref} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] hover:border-subtle">
            <Download size={13} /> Ekspor CSV
          </a>
        }
      />
      <div className="mx-auto w-full max-w-[1100px] space-y-4 px-8 py-7">
        <p className="text-[12px] text-subtle">
          Log ini tidak dapat diubah atau dihapus oleh siapa pun. Isi dokumen dan data klien tidak pernah dicatat di sini, hanya siapa melakukan apa dan kapan.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <SearchForm action="/admin/audit" value={q} placeholder="Cari tindakan, pengguna, atau berkas" hidden={{ modul }} />
        </div>
        <FilterChips base="/admin/audit" param="modul" value={modul} extra={{ q }} options={AUDIT_MODULES.map((m) => ({ value: m.id, label: m.label }))} />
        {filtered.length === 0 ? <EmptyState>Tidak ada aktivitas yang cocok.</EmptyState> : (
          <Table head={["#", "Waktu", "Pengguna", "Tindakan", "Berkas", "Modul"]}>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className={`${td} tabular-nums text-subtle`}>{r.id}</td>
                <td className={`${td} tabular-nums text-muted-foreground whitespace-nowrap`}>{formatDateTime(r.occurred_at)}</td>
                <td className={td}>
                  {nameOf.get(r.actor_user_id ?? "") ?? "—"}{" "}
                  <span className="text-[11.5px] text-subtle">({ACTOR[r.actor_type as keyof typeof ACTOR]})</span>
                </td>
                <td className={td}>{auditLabel(r.action)}</td>
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
