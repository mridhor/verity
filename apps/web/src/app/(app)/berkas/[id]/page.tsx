import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Dot, Select } from "@/components/ui/input";
import { auditLabel } from "@/lib/audit-labels";
import { requirePrincipal } from "@/lib/auth";
import { berkasType } from "@/lib/berkas-types";
import { MEMBERSHIP_MANAGERS, ROLE_LABEL, type AppRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDateTime } from "@/lib/utils";
import { setBerkasMember } from "../actions";

const TABS = [
  { id: "percakapan", label: "Percakapan", note: "Agen baca-saja dengan sitasi hadir pada R1b." },
  { id: "dokumen", label: "Dokumen", note: "Unggah dokumen dan verifikasi ekstraksi hadir pada fase Dokumen dan Vault." },
  { id: "checklist", label: "Checklist", note: "Checklist dan tenggat manual hadir pada fase System of Record." },
  { id: "aktivitas", label: "Aktivitas" },
  { id: "anggota", label: "Anggota" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function BerkasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const me = await requirePrincipal();
  const { id } = await params;
  const requestedTab = (await searchParams).tab;
  const tab: TabId = TABS.find((t) => t.id === requestedTab)?.id ?? "aktivitas";
  const supabase = await createClient();

  const { data: berkas } = await supabase
    .from("berkas")
    .select("id, title, type, status, workflow_step, pic_user_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!berkas) notFound(); // RLS hides berkas the user may not see: same response as nonexistent.

  const [{ data: colleagues }, { data: members }, { data: activity }] = await Promise.all([
    supabase.from("tenant_members").select("user_id, display_name, role, active").eq("tenant_id", me.tenantId),
    supabase.from("berkas_members").select("user_id, active").eq("berkas_id", id),
    supabase.from("audit_log").select("id, occurred_at, actor_type, actor_user_id, action").eq("berkas_id", id).order("id", { ascending: false }).limit(50),
  ]);
  const nameOf = new Map((colleagues ?? []).map((c) => [c.user_id, c.display_name]));
  const type = berkasType(berkas.type);
  const steps = type?.steps ?? [];
  const current = Math.max(0, berkas.workflow_step ? steps.indexOf(berkas.workflow_step) : 0);
  const activeMembers = new Set((members ?? []).filter((m) => m.active).map((m) => m.user_id));
  const canManage = MEMBERSHIP_MANAGERS.has(me.role);

  return (
    <>
      <PageHeader
        eyebrow={`Berkas / ${type?.group ?? berkas.type}`}
        title={berkas.title}
        meta={
          <>
            <span>Akta: belum ada</span>
            <span>Penanggung jawab: {nameOf.get(berkas.pic_user_id ?? "") ?? "—"}</span>
            <span>Tenggat terdekat: —</span>
          </>
        }
      >
        {steps.length > 0 && (
          <ol className="mt-[18px] mb-4 flex flex-wrap gap-x-[18px] gap-y-1" aria-label="Langkah workflow">
            {steps.map((s, i) => {
              const state = i < current ? "done" : i === current ? "now" : "next";
              return (
                <li key={s} className={cn("flex items-center gap-[7px] text-[12.5px] text-subtle", state === "done" && "text-muted-foreground", state === "now" && "font-medium text-foreground")} aria-current={state === "now" ? "step" : undefined}>
                  <span className={cn("grid size-[18px] place-items-center rounded-full border border-border bg-card text-[10.5px] tabular-nums", state === "done" && "border-foreground bg-foreground text-card", state === "now" && "border-primary text-primary shadow-[0_0_0_3px_var(--primary-soft)]")}>
                    {state === "done" ? <Check size={10} strokeWidth={3} /> : i + 1}
                  </span>
                  {s}
                </li>
              );
            })}
            {type && !type.stepsVerified && <li className="text-[11.5px] text-subtle">(langkah belum dikonfirmasi Notaris)</li>}
          </ol>
        )}
        <div role="tablist" className="flex gap-[22px]">
          {TABS.map((t) => (
            <Link
              key={t.id}
              role="tab"
              aria-selected={t.id === tab}
              href={`/berkas/${id}?tab=${t.id}`}
              className={cn("-mb-px border-b-2 border-transparent pb-[11px] text-[13.5px] text-muted-foreground", t.id === tab && "border-foreground font-medium text-foreground")}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-[720px] px-8 py-7">
        {TABS.map((t) =>
          t.id === tab && "note" in t ? (
            <p key={t.id} className="py-16 text-center text-[13px] text-subtle">{t.note}</p>
          ) : null,
        )}

        {tab === "aktivitas" && (
          <ul>
            {(activity ?? []).map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-b border-border py-[13px] text-sm">
                <Dot tone={a.actor_type === "agent" ? "primary" : "subtle"} />
                <span className="flex-1">
                  {nameOf.get(a.actor_user_id ?? "") ?? "Sistem"} · {auditLabel(a.action)}
                </span>
                <span className="text-xs tabular-nums text-subtle">{formatDateTime(a.occurred_at)}</span>
              </li>
            ))}
            {activity?.length === 0 && <p className="py-16 text-center text-[13px] text-subtle">Belum ada aktivitas.</p>}
          </ul>
        )}

        {tab === "anggota" && (
          <div className="space-y-6">
            <ul>
              {(colleagues ?? [])
                .filter((c) => activeMembers.has(c.user_id))
                .map((c) => (
                  <li key={c.user_id} className="flex items-center gap-3 border-b border-border py-3 text-sm">
                    <span className="flex-1">{c.display_name}</span>
                    <span className="text-xs text-subtle">{ROLE_LABEL[c.role as AppRole]}</span>
                    {canManage && (
                      <form action={setBerkasMember}>
                        <input type="hidden" name="berkasId" value={id} />
                        <input type="hidden" name="userId" value={c.user_id} />
                        <input type="hidden" name="active" value="false" />
                        <Button size="sm" variant="ghost">Keluarkan</Button>
                      </form>
                    )}
                  </li>
                ))}
            </ul>
            {me.role === "notaris" && (
              <p className="text-[12px] text-subtle">Sebagai Notaris, Anda dapat melihat semua berkas kantor tanpa menjadi anggota.</p>
            )}
            {canManage && (
              <form action={setBerkasMember} className="flex items-end gap-2">
                <input type="hidden" name="berkasId" value={id} />
                <input type="hidden" name="active" value="true" />
                <label className="flex-1">
                  <span className="mb-1.5 block text-[12.5px] text-muted-foreground">Tambah anggota</span>
                  <Select name="userId" required defaultValue="">
                    <option value="" disabled>Pilih pengguna</option>
                    {(colleagues ?? [])
                      .filter((c) => c.active && !activeMembers.has(c.user_id) && c.role !== "super_admin" && c.user_id !== me.userId)
                      .map((c) => (
                        <option key={c.user_id} value={c.user_id}>
                          {c.display_name} · {ROLE_LABEL[c.role as AppRole]}
                        </option>
                      ))}
                  </Select>
                </label>
                <Button type="submit">Tambahkan</Button>
              </form>
            )}
          </div>
        )}
      </div>
    </>
  );
}
