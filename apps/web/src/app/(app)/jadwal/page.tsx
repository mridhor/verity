import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState, FilterChips } from "@/components/ui/blocks";
import { Button } from "@/components/ui/button";
import { requirePrincipal } from "@/lib/auth";
import { formatLongDate, formatTime, isUpcoming, jakartaDateOf, jakartaInstant, jakartaToday } from "@/lib/jakarta-time";
import { PRESIGNING_STAGE_LABEL, SCHEDULE_KINDS, SCHEDULE_KIND_LABEL, type ScheduleKind } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { deleteSchedule, runPresigningCheck } from "./actions";
import { ScheduleForm } from "./schedule-form";
import { AgentPageContext } from "@/components/agent/agent-provider";

export const metadata = { title: "Jadwal" };

const TONE: Record<ScheduleKind, BadgeTone> = { pertemuan_klien: "info", penandatanganan: "warning", internal: "neutral" };

export default async function JadwalPage({ searchParams }: { searchParams: Promise<{ jenis?: string; lalu?: string }> }) {
  const me = await requirePrincipal();
  if (me.role === "super_admin") notFound();
  const { jenis, lalu } = await searchParams;
  const today = jakartaToday().date;
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - (lalu ? 30 : 0));
  const supabase = await createClient();
  let q = supabase.from("schedules").select("id, kind, title, starts_at, location, notes, created_by, berkas(id, title)")
    .gte("starts_at", jakartaInstant(from.toISOString().slice(0, 10))).order("starts_at").limit(300);
  if (jenis && (SCHEDULE_KINDS as readonly string[]).includes(jenis)) q = q.eq("kind", jenis);
  const [{ data: rows }, { data: berkas }, { data: runs }] = await Promise.all([
    q,
    supabase.from("berkas").select("id, title").eq("status", "aktif").order("title"),
    supabase.from("agent_background_runs").select("schedule_id, stage, findings, ran_at").order("ran_at", { ascending: false }).limit(500),
  ]);
  // Latest agent pre-signing check per appointment.
  const lastRun = new Map<string, { stage: string; findings: number; ran_at: string }>();
  for (const r of runs ?? []) if (!lastRun.has(r.schedule_id)) lastRun.set(r.schedule_id, r);


  const groups = new Map<string, NonNullable<typeof rows>>();
  for (const r of rows ?? []) {
    const d = jakartaDateOf(r.starts_at);
    groups.set(d, [...(groups.get(d) ?? []), r]);
  }

  return (
    <>
      <AgentPageContext context={{ kind: "kantor", label: "Jadwal kantor", page: "jadwal" }} suggestions={["jadwal hari ini", "jadwal besok", "jadwal minggu ini", "tenggat minggu ini"]} />
      <PageHeader eyebrow="Agenda operasional kantor" title="Jadwal" />
      <div className="w-full max-w-[900px] space-y-5 px-8 pt-5 pb-10">
        <ScheduleForm today={today} berkas={berkas ?? []} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips base="/jadwal" param="jenis" value={jenis} extra={{ lalu }}
            options={SCHEDULE_KINDS.map((k) => ({ value: k, label: SCHEDULE_KIND_LABEL[k] }))} />
          <Link href={lalu ? `/jadwal${jenis ? `?jenis=${jenis}` : ""}` : `/jadwal?lalu=1${jenis ? `&jenis=${jenis}` : ""}`}
            className="text-[12px] text-subtle hover:text-foreground">
            {lalu ? "Sembunyikan jadwal lalu" : "Tampilkan 30 hari terakhir"}
          </Link>
        </div>
        {groups.size === 0 && <EmptyState>Tidak ada jadwal.</EmptyState>}
        {[...groups.entries()].map(([date, items]) => (
          <section key={date}>
            <h2 className="mb-2 flex items-center gap-2 border-b border-border pb-2 text-[12.5px] font-semibold text-muted-foreground">
              {formatLongDate(date)}
              {date === today && <Badge tone="info">Hari ini</Badge>}
            </h2>
            <ul className="space-y-2">
              {items.map((j) => {
                const b = j.berkas as unknown as { id: string; title: string } | null;
                return (
                  <li key={j.id} className="flex items-start gap-4 rounded-md border border-border bg-card px-4 py-3">
                    <div className="w-12 shrink-0 text-center">
                      <div className="text-[15px] font-semibold tabular-nums">{formatTime(j.starts_at)}</div>
                      <div className="text-[10.5px] text-subtle">WIB</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium">{j.title}</span>
                        <Badge tone={TONE[j.kind as ScheduleKind]}>{SCHEDULE_KIND_LABEL[j.kind as ScheduleKind]}</Badge>
                      </div>
                      {j.notes && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{j.notes}</div>}
                      <div className="mt-0.5 text-[12px] text-subtle">
                        {[j.location, b && <Link key="b" href={`/berkas/${b.id}`} className="hover:underline">{b.title}</Link>]
                          .filter(Boolean).map((x, i) => <span key={i}>{i > 0 && " · "}{x}</span>)}
                      </div>
                      {j.kind === "penandatanganan" && b && isUpcoming(j.starts_at) && (() => {
                        const run = lastRun.get(j.id);
                        return (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {run ? (
                              <Link href={`/berkas/${b.id}?tab=percakapan`} title="Buka hasil pemeriksaan agen">
                                <Badge tone={run.findings ? "warning" : "success"}>
                                  {run.findings ? `${run.findings} temuan` : "Siap"} · diperiksa {jakartaDateOf(run.ran_at) === today ? formatTime(run.ran_at) : formatDateTime(run.ran_at)}
                                  {run.stage !== "manual" && ` (${PRESIGNING_STAGE_LABEL[run.stage] ?? run.stage})`}
                                </Badge>
                              </Link>
                            ) : (
                              <span className="text-[12px] text-subtle">Agen memeriksa saat dijadwalkan, lalu H-3 dan H-1.</span>
                            )}
                            <form action={runPresigningCheck}>
                              <input type="hidden" name="id" value={j.id} />
                              <Button size="sm" variant="ghost"><ShieldCheck size={13} /> Periksa sekarang</Button>
                            </form>
                          </div>
                        );
                      })()}
                    </div>
                    {(j.created_by === me.userId || me.role === "notaris") && (
                      <form action={deleteSchedule}>
                        <input type="hidden" name="id" value={j.id} />
                        <Button size="sm" variant="ghost" aria-label={`Hapus jadwal ${j.title}`}>Hapus</Button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
