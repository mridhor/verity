import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Dot } from "@/components/ui/input";
import { auditLabel } from "@/lib/audit-labels";
import { requirePrincipal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

const ACTOR = { human: "Manusia", agent: "Agen", worker: "Worker", system: "Sistem" } as const;

export default async function AuditPage() {
  const me = await requirePrincipal();
  if (me.role !== "notaris" && me.role !== "super_admin") notFound();
  const supabase = await createClient();
  const [{ data: rows }, { data: colleagues }, chain] = await Promise.all([
    supabase.from("audit_log").select("id, occurred_at, actor_type, actor_user_id, action, target_type, berkas_id").order("id", { ascending: false }).limit(200),
    supabase.from("tenant_members").select("user_id, display_name").eq("tenant_id", me.tenantId),
    supabase.rpc("audit_chain_status"),
  ]);
  const nameOf = new Map((colleagues ?? []).map((c) => [c.user_id, c.display_name]));
  const intact = !chain.error && chain.data === null;

  return (
    <>
      <PageHeader
        eyebrow="Administrasi"
        title="Audit log"
        meta={
          <span className="inline-flex items-center gap-1.5">
            <Dot tone={intact ? "success" : "destructive"} />
            {chain.error
              ? "Integritas tidak dapat diperiksa"
              : intact
                ? "Rantai hash utuh"
                : `Rantai hash rusak mulai entri #${chain.data}`}
          </span>
        }
      />
      <div className="mx-auto w-full max-w-[960px] px-8 py-7">
        <p className="mb-4 text-[12px] text-subtle">
          Log ini tidak dapat diubah atau dihapus oleh siapa pun. Isi dokumen tidak pernah dicatat di sini.
        </p>
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-background text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Waktu</th>
                <th className="px-4 py-2.5 font-medium">Pelaku</th>
                <th className="px-4 py-2.5 font-medium">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border-soft">
                  <td className="px-4 py-2.5 tabular-nums text-subtle">{r.id}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{formatDateTime(r.occurred_at)}</td>
                  <td className="px-4 py-2.5">
                    {nameOf.get(r.actor_user_id ?? "") ?? "—"}{" "}
                    <span className="text-[11.5px] text-subtle">({ACTOR[r.actor_type as keyof typeof ACTOR]})</span>
                  </td>
                  <td className="px-4 py-2.5">{auditLabel(r.action)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
