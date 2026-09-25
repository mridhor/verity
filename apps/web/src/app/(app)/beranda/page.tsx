import Link from "next/link";
import { ArrowRight, CalendarDays, FileSignature, ListChecks, Sparkles } from "lucide-react";
import { AgentPageContext } from "@/components/agent/agent-provider";
import { PageHeader } from "@/components/shell/page-header";
import { AKTA_STATUS_TONE, Badge } from "@/components/ui/badge";
import { EmptyState, Section, StatCard } from "@/components/ui/blocks";
import { requirePrincipal } from "@/lib/auth";
import { formatTime, jakartaInstant, jakartaToday } from "@/lib/jakarta-time";
import { AKTA_STATUSES, AKTA_STATUS_LABEL, SCHEDULE_KIND_LABEL, formatAktaNumber, type AktaStatus, type ScheduleKind } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDateTime } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const STATUS_BAR: Record<AktaStatus, string> = {
  draft: "bg-[#cfccc3]", verifikasi: "bg-info", menunggu_ttd: "bg-warning", selesai: "bg-success", diarsipkan: "bg-muted-foreground",
};

type Party = { sort_order: number; role: string; persons: { full_name: string } | null; companies: { name: string; legal_form: string } | null };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()));
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
}

function bytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${(n / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}

export default async function BerandaPage() {
  const me = await requirePrincipal();
  const supabase = await createClient();
  const today = jakartaToday();
  const yearStart = `${today.year}-01-01`;
  const monthStart = `${today.year}-${String(today.month).padStart(2, "0")}-01`;
  const prev = today.month === 1 ? { y: today.year - 1, m: 12 } : { y: today.year, m: today.month - 1 };
  const prevMonthStart = `${prev.y}-${String(prev.m).padStart(2, "0")}-01`;
  const from = prevMonthStart < yearStart ? prevMonthStart : yearStart;
  const tomorrow = new Date(`${today.date}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const content = me.role !== "super_admin";

  // Proposals this user may decide: Notaris and Partner decide both tiers, other members the staff tier.
  const tiers = me.role === "notaris" || me.role === "partner" ? ["staf", "notaris"] : ["staf"];
  const [finals, statusRows, recent, schedules, docs, minuta, protokol, pending, dueItems, settings, self] = await Promise.all([
    supabase.from("akta").select("akta_date").gte("akta_date", from).in("status", ["selesai", "diarsipkan"]),
    supabase.from("akta").select("status"),
    supabase.from("akta").select("id, title, akta_type, status, number, number_period, updated_at, akta_parties(sort_order, role, persons(full_name), companies(name, legal_form))")
      .order("updated_at", { ascending: false }).limit(6),
    supabase.from("schedules").select("id, title, kind, starts_at, location")
      .gte("starts_at", jakartaInstant(today.date)).lt("starts_at", jakartaInstant(tomorrow.toISOString().slice(0, 10)))
      .order("starts_at"),
    supabase.from("documents").select("size_bytes").limit(10000),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("doc_type", "minuta"),
    supabase.from("protokol_transfers").select("akta_count, status"),
    supabase.from("proposed_changes").select("id, tier, items, created_at, berkas(id, title)")
      .eq("status", "pending").in("tier", tiers).gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(6),
    supabase.from("checklist_items").select("id", { count: "exact", head: true }).eq("done", false).lte("due_date", today.date),
    supabase.from("tenant_settings").select("annual_akta_target").maybeSingle(),
    supabase.from("tenant_members").select("display_name").eq("user_id", me.userId).eq("tenant_id", me.tenantId).maybeSingle(),
  ]);
  const pendingRows = (pending.data ?? []) as unknown as {
    id: string; tier: string; items: { label: string }[]; created_at: string; berkas: { id: string; title: string } | null;
  }[];

  const perMonth = Array.from({ length: 12 }, () => 0);
  let thisMonth = 0;
  let lastMonth = 0;
  let thisYear = 0;
  for (const r of finals.data ?? []) {
    const d = String(r.akta_date);
    if (d >= yearStart) { perMonth[Number(d.slice(5, 7)) - 1]! += 1; thisYear++; }
    if (d >= monthStart) thisMonth++;
    else if (d >= prevMonthStart) lastMonth++;
  }
  const change = lastMonth === 0 ? null : Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  const target = settings.data?.annual_akta_target ?? null;
  const peak = Math.max(1, ...perMonth);
  const byStatus = Object.fromEntries(AKTA_STATUSES.map((s) => [s, 0])) as Record<AktaStatus, number>;
  for (const r of statusRows.data ?? []) byStatus[r.status as AktaStatus]++;
  const totalAkta = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const protokolAkta = (protokol.data ?? []).filter((p) => p.status === "diterima").reduce((a, p) => a + (p.akta_count ?? 0), 0);
  const docCount = (docs.data ?? []).length;
  const docBytes = (docs.data ?? []).reduce((a, d) => a + Number(d.size_bytes ?? 0), 0);
  const firstName = (self.data?.display_name ?? "").split(/\s+/)[0];

  // "What needs me" banner, like a command centre: every item links to where it is handled.
  const actions = [
    pendingRows.length > 0 && { icon: <Sparkles size={14} />, text: `${pendingRows.length} usulan agen menunggu persetujuan Anda`, href: `/berkas/${pendingRows[0]!.berkas?.id}?tab=percakapan` },
    byStatus.menunggu_ttd > 0 && { icon: <FileSignature size={14} />, text: `${byStatus.menunggu_ttd} akta menunggu tanda tangan`, href: "/akta?status=menunggu_ttd" },
    (dueItems.count ?? 0) > 0 && { icon: <ListChecks size={14} />, text: `${dueItems.count} item checklist jatuh tempo atau terlambat`, href: "/berkas" },
    (schedules.data ?? []).length > 0 && { icon: <CalendarDays size={14} />, text: `${schedules.data!.length} jadwal hari ini`, href: "/jadwal" },
  ].filter(Boolean) as { icon: React.ReactNode; text: string; href: string }[];

  const partyOf = (ps: Party[]) => {
    const p = [...ps].filter((x) => x.role !== "saksi").sort((a, b) => a.sort_order - b.sort_order)[0];
    return p?.persons?.full_name ?? (p?.companies ? `${p.companies.legal_form} ${p.companies.name}` : null);
  };

  return (
    <>
      <AgentPageContext context={{ kind: "kantor", label: "Seluruh kantor", page: "beranda" }} suggestions={["akta menunggu TTD", "jadwal hari ini", "tenggat minggu ini", "akta final bulan ini"]} />
      <PageHeader eyebrow="Ringkasan operasional kantor hari ini" title={firstName ? `${greeting()}, ${firstName}` : "Beranda"} />
      <div className="w-full max-w-[1120px] space-y-5 px-8 pt-5 pb-10">
        {!content && (
          <p className="rounded-xl bg-muted px-4 py-3 text-[13px] text-muted-foreground">
            Super Admin tidak melihat isi berkas dan akta, sehingga angka di bawah kosong. Gunakan menu Pengguna dan Audit log.
          </p>
        )}

        {content && (
          <section className="rounded-xl border border-border bg-card px-5 py-4" aria-label="Perlu tindakan">
            <div className="flex items-center gap-2.5">
              <span className="grid size-6 place-items-center rounded-md bg-foreground font-serif text-[13px] leading-none text-card" aria-hidden>V</span>
              <p className="text-[15px] text-muted-foreground">
                {actions.length === 0 ? "Tidak ada yang mendesak hari ini." : (
                  <>Ada <span className="font-medium text-foreground">{actions.length} hal yang perlu tindakan</span> hari ini.</>
                )}
              </p>
            </div>
            {actions.length > 0 && (
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {actions.map((a) => (
                  <li key={a.text}>
                    <Link href={a.href} className="group flex items-center gap-2.5 rounded-lg bg-muted px-3 py-2.5 text-[13px] transition-colors hover:bg-accent">
                      <span className="text-muted-foreground">{a.icon}</span>
                      <span className="flex-1">{a.text}</span>
                      <ArrowRight size={14} className="text-subtle transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Akta final bulan ini" value={thisMonth}
            delta={change === null ? undefined : { text: `${Math.abs(change)}%`, direction: change > 0 ? "up" : change < 0 ? "down" : "flat" }}
            sub={`Bulan lalu ${lastMonth}`} />
          <StatCard label={`Akta final tahun ${today.year}`} value={thisYear}
            sub={target ? `Target ${target} · ${Math.round((thisYear / target) * 100)}% tercapai` : undefined} />
          <StatCard label="Menunggu tanda tangan" value={byStatus.menunggu_ttd} href="/akta?status=menunggu_ttd"
            sub={byStatus.menunggu_ttd ? "Perlu tindak lanjut" : "Semua tertangani"} />
          <StatCard label="Arsip digital" value={bytes(docBytes)} sub={`${docCount.toLocaleString("id-ID")} dokumen tersimpan`} />
        </div>

        {pendingRows.length > 0 && (
          <Section title="Menunggu persetujuan saya" description="Perubahan yang diusulkan agen. Tidak ada yang berubah sebelum disetujui.">
            <ul>
              {pendingRows.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 border-t border-border-soft py-3 first:border-0">
                  <Link href={`/berkas/${p.berkas?.id}?tab=percakapan`} className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium hover:underline">{p.items.map((i) => i.label).join("; ")}</div>
                    <div className="text-[12px] text-subtle">{p.berkas?.title} · diusulkan agen {formatDateTime(p.created_at)}</div>
                  </Link>
                  <Badge tone={p.tier === "notaris" ? "authority" : "neutral"}>{p.tier === "notaris" ? "Perlu Notaris" : "Staf"}</Badge>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Section title={`Akta final per bulan — ${today.year}`}
            actions={target ? <span className="text-[12.5px] text-subtle tabular-nums">{thisYear} / {target} target</span> : undefined}>
            {target && (
              <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`${thisYear} dari target ${target}`}>
                <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, (thisYear / target) * 100)}%` }} />
              </div>
            )}
            <div className="relative h-48" role="img" aria-label={`Jumlah akta final per bulan tahun ${today.year}`}>
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <div key={f} aria-hidden className="absolute inset-x-0 border-t border-dashed border-border-soft" style={{ bottom: `${22 + f * 140}px` }} />
              ))}
              <div className="absolute inset-0 flex items-end gap-2.5">
                {perMonth.map((n, i) => (
                  <div key={MONTHS[i]} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-[11px] tabular-nums text-subtle">{n || ""}</span>
                    <div className={cn("w-full max-w-7 rounded-t-md", i + 1 === today.month ? "bg-foreground" : i + 1 < today.month ? "bg-[#d8d5cc]" : "bg-muted")}
                      style={{ height: `${Math.max(3, (n / peak) * 140)}px` }} />
                    <span className={cn("text-[11px]", i + 1 === today.month ? "font-medium text-foreground" : "text-subtle")}>{MONTHS[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
          <Section title="Status akta" description={`${totalAkta} akta di kantor`}>
            {totalAkta === 0 ? (
              <EmptyState>Belum ada akta.</EmptyState>
            ) : (
              <>
                <div className="mt-1 mb-4 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  {AKTA_STATUSES.map((s) => byStatus[s] > 0 && (
                    <div key={s} className={cn("h-full border-r-2 border-card last:border-0", STATUS_BAR[s])} style={{ width: `${(byStatus[s] / totalAkta) * 100}%` }} />
                  ))}
                </div>
                <ul className="space-y-1">
                  {AKTA_STATUSES.map((s) => (
                    <li key={s}>
                      <Link href={`/akta?status=${s}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-muted">
                        <span aria-hidden className={cn("size-2 rounded-full", STATUS_BAR[s])} />
                        <span className="flex-1 text-muted-foreground">{AKTA_STATUS_LABEL[s]}</span>
                        <span className="tabular-nums">{byStatus[s]}</span>
                        <span className="w-10 text-right text-[12px] text-subtle tabular-nums">{Math.round((byStatus[s] / totalAkta) * 100)}%</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Section title="Akta terbaru" actions={<Link href="/akta" className="text-[12.5px] text-subtle hover:text-foreground">Semua akta</Link>}>
            {(recent.data ?? []).length === 0 ? (
              <EmptyState>Belum ada akta.</EmptyState>
            ) : (
              <ul>
                {recent.data!.map((a) => (
                  <li key={a.id} className="border-t border-border-soft first:border-0">
                    <Link href={`/akta/${a.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60">
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-medium">{a.title}</div>
                        <div className="truncate text-[12px] text-subtle">
                          {[formatAktaNumber(a.number, a.number_period) ?? "Belum bernomor", partyOf(a.akta_parties as unknown as Party[]), a.akta_type].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <Badge tone={AKTA_STATUS_TONE[a.status as AktaStatus]}>{AKTA_STATUS_LABEL[a.status as AktaStatus]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <div className="space-y-4">
            <Section title="Jadwal hari ini" actions={<Link href="/jadwal" className="text-[12.5px] text-subtle hover:text-foreground">Semua jadwal</Link>}>
              {(schedules.data ?? []).length === 0 ? (
                <EmptyState>Tidak ada jadwal hari ini.</EmptyState>
              ) : (
                <ul className="space-y-1.5">
                  {schedules.data!.map((j) => (
                    <li key={j.id} className="flex gap-3 rounded-lg bg-muted px-3 py-2.5">
                      <span className="w-11 shrink-0 font-serif text-[16px] leading-5 tabular-nums">{formatTime(j.starts_at)}</span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium">{j.title}</div>
                        <div className="truncate text-[12px] text-subtle">
                          {SCHEDULE_KIND_LABEL[j.kind as ScheduleKind]}{j.location ? ` · ${j.location}` : ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Ringkasan arsip">
              <div className="grid grid-cols-3 gap-2">
                {[["Minuta akta", (minuta.count ?? 0).toLocaleString("id-ID")], ["Akta dari protokol", protokolAkta.toLocaleString("id-ID")], ["Dokumen pendukung", Math.max(0, docCount - (minuta.count ?? 0)).toLocaleString("id-ID")]].map(([l, v]) => (
                  <div key={String(l)} className="rounded-lg bg-muted px-3 py-2.5">
                    <div className="font-serif text-[20px] leading-tight tabular-nums">{v}</div>
                    <div className="mt-0.5 text-[11.5px] text-subtle">{l}</div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}
