import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { DocumentTable, type DocumentRow } from "@/components/documents/document-table";
import { UploadForm } from "@/components/documents/upload-form";
import { PageHeader } from "@/components/shell/page-header";
import { AKTA_STATUS_TONE, Badge } from "@/components/ui/badge";
import { EmptyState, Table, td } from "@/components/ui/blocks";
import { Button } from "@/components/ui/button";
import { Dot, Select } from "@/components/ui/input";
import { auditLabel } from "@/lib/audit-labels";
import { requirePrincipal } from "@/lib/auth";
import { berkasType } from "@/lib/berkas-types";
import { formatLongDate, formatTime, jakartaDateOf, jakartaToday } from "@/lib/jakarta-time";
import { AKTA_STATUS_LABEL, APPOINTMENT_LABEL, formatAktaNumber, type AktaStatus } from "@/lib/labels";
import { MEMBERSHIP_MANAGERS, ROLE_LABEL, type AppRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { setBerkasMember } from "../actions";
import { deleteChecklistItem, toggleChecklistItem } from "../checklist-actions";
import { ChecklistForm } from "./checklist-form";

const TABS = [
  { id: "percakapan", label: "Percakapan", note: "Agen baca-saja dengan sitasi hadir pada R1b." },
  { id: "akta", label: "Akta" },
  { id: "dokumen", label: "Dokumen" },
  { id: "checklist", label: "Checklist" },
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

  const [{ data: colleagues }, { data: members }, { data: activity }, { data: akta }, { data: docs }, { data: checklist }, { data: nextSchedule }] = await Promise.all([
    supabase.from("tenant_members").select("user_id, display_name, role, active").eq("tenant_id", me.tenantId),
    supabase.from("berkas_members").select("user_id, active").eq("berkas_id", id),
    supabase.from("audit_log").select("id, occurred_at, actor_type, actor_user_id, action").eq("berkas_id", id).order("id", { ascending: false }).limit(50),
    supabase.from("akta").select("id, title, akta_type, status, number, number_period, akta_date, appointment").eq("berkas_id", id).order("created_at"),
    supabase.from("documents").select("id, title, doc_type, file_name, mime_type, size_bytes, uploaded_at, uploaded_by").eq("berkas_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("checklist_items").select("id, title, assignee_user_id, due_date, done, done_by, done_at").eq("berkas_id", id).order("created_at"),
    supabase.from("schedules").select("title, starts_at").eq("berkas_id", id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(1).maybeSingle(),
  ]);
  const nameOf = new Map((colleagues ?? []).map((c) => [c.user_id, c.display_name]));
  const type = berkasType(berkas.type);
  const steps = type?.steps ?? [];
  const current = Math.max(0, berkas.workflow_step ? steps.indexOf(berkas.workflow_step) : 0);
  const activeMembers = new Set((members ?? []).filter((m) => m.active).map((m) => m.user_id));
  const canManage = MEMBERSHIP_MANAGERS.has(me.role);
  const activeMembersFor = (userId: string) =>
    activeMembers.has(userId) || (colleagues ?? []).some((c) => c.user_id === userId && c.role === "notaris");

  return (
    <>
      <PageHeader
        eyebrow={`Berkas / ${type?.group ?? berkas.type}`}
        title={berkas.title}
        meta={
          <>
            <span>Akta: {(akta ?? []).length === 0 ? "belum ada" : (akta ?? []).map((a) => formatAktaNumber(a.number, a.number_period) ?? "draft").join(", ")}</span>
            <span>Penanggung jawab: {nameOf.get(berkas.pic_user_id ?? "") ?? "—"}</span>
            <span>
              Tenggat terdekat:{" "}
              {(() => {
                const due = (checklist ?? []).filter((c) => !c.done && c.due_date).map((c) => c.due_date as string).sort()[0];
                return due ? <b className="font-medium text-foreground">{formatDate(due)}</b> : "—";
              })()}
            </span>
            {nextSchedule && <span>Jadwal: {nextSchedule.title}, {formatLongDate(jakartaDateOf(nextSchedule.starts_at))} {formatTime(nextSchedule.starts_at)}</span>}
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
              {t.id === "dokumen" && (docs ?? []).length > 0 && <span className="ml-1.5 text-subtle">{docs!.length}</span>}
              {t.id === "checklist" && (checklist ?? []).length > 0 && (
                <span className="ml-1.5 text-subtle">{checklist!.filter((c) => c.done).length}/{checklist!.length}</span>
              )}
            </Link>
          ))}
        </div>
      </PageHeader>

      <div className={cn("mx-auto w-full px-8 py-7", tab === "dokumen" || tab === "akta" ? "max-w-[1000px]" : "max-w-[720px]")}>
        {TABS.map((t) =>
          t.id === tab && "note" in t ? (
            <p key={t.id} className="py-16 text-center text-[13px] text-subtle">{t.note}</p>
          ) : null,
        )}

        {tab === "akta" && (
          <div className="space-y-4">
            {me.role !== "super_admin" && (
              <Link href={`/akta/baru?berkas=${id}`} className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-[13px] font-medium text-card hover:bg-foreground/90">
                Akta baru untuk berkas ini
              </Link>
            )}
            {(akta ?? []).length === 0 ? <EmptyState>Belum ada akta di berkas ini.</EmptyState> : (
              <Table head={["Nomor", "Jenis", "Judul", "Pejabat", "Status"]}>
                {akta!.map((a) => (
                  <tr key={a.id}>
                    <td className={`${td} font-medium tabular-nums`}>{formatAktaNumber(a.number, a.number_period) ?? <span className="text-subtle">—</span>}</td>
                    <td className={`${td} text-muted-foreground`}>{a.akta_type}</td>
                    <td className={td}><Link href={`/akta/${a.id}`} className="font-medium hover:underline">{a.title}</Link></td>
                    <td className={`${td} text-muted-foreground`}>{APPOINTMENT_LABEL[a.appointment as "notaris" | "ppat"]}</td>
                    <td className={td}><Badge tone={AKTA_STATUS_TONE[a.status as AktaStatus]}>{AKTA_STATUS_LABEL[a.status as AktaStatus]}</Badge></td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        )}

        {tab === "dokumen" && (
          <div className="space-y-4">
            {me.role !== "super_admin" && (
              <UploadForm tenantId={me.tenantId} fixedBerkas={id} berkas={[{ id, label: berkas.title }]}
                akta={(akta ?? []).map((a) => ({ id: a.id, berkasId: id, label: formatAktaNumber(a.number, a.number_period) ? `${formatAktaNumber(a.number, a.number_period)} · ${a.title}` : a.title }))} />
            )}
            {(docs ?? []).length === 0 ? <EmptyState>Belum ada dokumen di berkas ini.</EmptyState> : (
              <DocumentTable rows={(docs ?? []) as unknown as DocumentRow[]} nameOf={nameOf} showBerkas={false} />
            )}
          </div>
        )}

        {tab === "checklist" && (
          <div className="space-y-5">
            <ul>
              {(checklist ?? []).map((c) => {
                const overdue = !c.done && c.due_date && c.due_date < jakartaToday().date;
                return (
                  <li key={c.id} className="flex items-center gap-3 border-b border-border py-3 text-sm">
                    <form action={toggleChecklistItem}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="berkasId" value={id} />
                      <input type="hidden" name="done" value={c.done ? "0" : "1"} />
                      <button aria-label={c.done ? `Tandai belum selesai: ${c.title}` : `Tandai selesai: ${c.title}`}
                        className={cn("grid size-[16px] place-items-center rounded border border-subtle", c.done && "border-primary bg-primary text-primary-foreground")}>
                        {c.done && <Check size={11} strokeWidth={3} />}
                      </button>
                    </form>
                    <span className={cn("flex-1", c.done && "text-subtle line-through")}>{c.title}</span>
                    <span className={cn("text-xs text-subtle", overdue && "font-medium text-destructive")}>
                      {[nameOf.get(c.assignee_user_id ?? ""), c.due_date && formatDate(c.due_date)].filter(Boolean).join(", ")}
                      {c.done && c.done_at && ` · selesai ${formatDate(c.done_at)}`}
                    </span>
                    <form action={deleteChecklistItem}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="berkasId" value={id} />
                      <Button size="sm" variant="ghost" aria-label={`Hapus ${c.title}`}>Hapus</Button>
                    </form>
                  </li>
                );
              })}
              {(checklist ?? []).length === 0 && <EmptyState>Belum ada item checklist.</EmptyState>}
            </ul>
            {me.role !== "super_admin" && (
              <ChecklistForm berkasId={id} members={(colleagues ?? []).filter((c) => activeMembersFor(c.user_id)).map((c) => ({ id: c.user_id, name: c.display_name }))} />
            )}
            <p className="text-[11.5px] text-subtle">Tenggat di sini diisi manual. Tenggat berbasis peraturan hadir setelah aturannya diverifikasi Notaris.</p>
          </div>
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
