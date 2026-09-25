import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { AKTA_STATUS_TONE, Badge } from "@/components/ui/badge";
import { EmptyState, Section, StatCard } from "@/components/ui/blocks";
import { requirePrincipal } from "@/lib/auth";
import { formatTime, jakartaInstant, jakartaToday } from "@/lib/jakarta-time";
import { AKTA_STATUSES, AKTA_STATUS_LABEL, SCHEDULE_KIND_LABEL, formatAktaNumber, type AktaStatus, type ScheduleKind } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { AgentPageContext } from "@/components/agent/agent-provider";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default async function BerandaPage() {
  const me = await requirePrincipal();
  const supabase = await createClient();
  const today = jakartaToday();
  const yearStart = `${today.year}-01-01`;
  const monthStart = `${today.year}-${String(today.month).padStart(2, "0")}-01`;
  const tomorrow = new Date(`${today.date}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  // Proposals this user may decide: Notaris and Partner decide both tiers, other members the staff tier.
  const tiers = me.role === "notaris" || me.role === "partner" ? ["staf", "notaris"] : ["staf"];
  const [finalThisYear, statusRows, recent, schedules, docs, minuta, protokol, pending] = await Promise.all([
    supabase.from("akta").select("akta_date").gte("akta_date", yearStart).in("status", ["selesai", "diarsipkan"]),
    supabase.from("akta").select("status"),
    supabase.from("akta").select("id, title, akta_type, status, number, number_period, updated_at").order("updated_at", { ascending: false }).limit(5),
    supabase.from("schedules").select("id, title, kind, starts_at, location")
      .gte("starts_at", jakartaInstant(today.date)).lt("starts_at", jakartaInstant(tomorrow.toISOString().slice(0, 10)))
      .order("starts_at"),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("doc_type", "minuta"),
    supabase.from("protokol_transfers").select("akta_count, status"),
    supabase.from("proposed_changes").select("id, tier, items, created_at, berkas(id, title)")
      .eq("status", "pending").in("tier", tiers).gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(6),
  ]);
  const pendingRows = (pending.data ?? []) as unknown as {
    id: string; tier: string; items: { label: string }[]; created_at: string; berkas: { id: string; title: string } | null;
  }[];

  const perMonth = Array.from({ length: 12 }, () => 0);
  let thisMonth = 0;
  for (const r of finalThisYear.data ?? []) {
    const m = Number(String(r.akta_date).slice(5, 7));
    perMonth[m - 1] = (perMonth[m - 1] ?? 0) + 1;
    if (r.akta_date >= monthStart) thisMonth++;
  }
  const peak = Math.max(1, ...perMonth);
  const byStatus = Object.fromEntries(AKTA_STATUSES.map((s) => [s, 0])) as Record<AktaStatus, number>;
  for (const r of statusRows.data ?? []) byStatus[r.status as AktaStatus]++;
  const totalAkta = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const protokolAkta = (protokol.data ?? []).filter((p) => p.status === "diterima").reduce((a, p) => a + (p.akta_count ?? 0), 0);

  return (
    <>
      <AgentPageContext context={{ kind: "kantor", label: "Seluruh kantor", page: "beranda" }} suggestions={["akta menunggu TTD", "jadwal hari ini", "tenggat minggu ini", "akta final bulan ini"]} />
      <PageHeader eyebrow="Ringkasan operasional kantor hari ini" title="Beranda" />
      <div className="mx-auto w-full max-w-[1040px] space-y-5 px-8 py-7">
        {me.role === "super_admin" && (
          <p className="rounded-md bg-border-soft px-3 py-2 text-[12.5px] text-muted-foreground">
            Super Admin tidak melihat isi berkas dan akta, sehingga angka di bawah kosong. Gunakan menu Pengguna dan Audit log.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Akta final bulan ini" value={thisMonth} />
          <StatCard label={`Akta final tahun ${today.year}`} value={finalThisYear.data?.length ?? 0} />
          <StatCard label="Menunggu tanda tangan" value={byStatus.menunggu_ttd} sub={byStatus.menunggu_ttd ? "Perlu tindak lanjut" : undefined} />
          <StatCard label="Dokumen tersimpan" value={docs.count ?? 0} />
        </div>

        {pendingRows.length > 0 && (
          <Section title="Menunggu persetujuan saya">
            <ul>
              {pendingRows.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 border-b border-border-soft py-2.5 last:border-0">
                  <Link href={`/berkas/${p.berkas?.id}?tab=percakapan`} className="min-w-0">
                    <div className="truncate text-[13px] font-medium hover:underline">
                      {p.items.map((i) => i.label).join("; ")}
                    </div>
                    <div className="text-[11.5px] text-subtle">
                      {p.berkas?.title} · diusulkan agen {formatDateTime(p.created_at)}
                    </div>
                  </Link>
                  <Badge tone={p.tier === "notaris" ? "warning" : "neutral"}>{p.tier === "notaris" ? "Perlu Notaris" : "Staf"}</Badge>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Section title={`Akta final per bulan — ${today.year}`}>
            <div className="flex h-44 items-end gap-2" role="img" aria-label={`Jumlah akta final per bulan tahun ${today.year}`}>
              {perMonth.map((n, i) => (
                <div key={MONTHS[i]} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[11px] tabular-nums text-subtle">{n || ""}</span>
                  <div
                    className={`w-full rounded-t-[3px] ${i + 1 === today.month ? "bg-foreground" : "bg-border"}`}
                    style={{ height: `${Math.max(2, (n / peak) * 120)}px` }}
                  />
                  <span className="text-[11px] text-muted-foreground">{MONTHS[i]}</span>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Status akta">
            {totalAkta === 0 ? (
              <EmptyState>Belum ada akta.</EmptyState>
            ) : (
              <ul className="space-y-2.5">
                {AKTA_STATUSES.map((s) => (
                  <li key={s}>
                    <div className="mb-1 flex justify-between text-[12.5px]">
                      <span className="text-muted-foreground">{AKTA_STATUS_LABEL[s]}</span>
                      <span className="tabular-nums">{byStatus[s]}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border-soft">
                      <div className="h-1.5 rounded-full bg-muted-foreground" style={{ width: `${(byStatus[s] / totalAkta) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Akta terbaru" actions={<Link href="/akta" className="text-[12px] text-subtle hover:text-foreground">Semua akta</Link>}>
            {(recent.data ?? []).length === 0 ? (
              <EmptyState>Belum ada akta.</EmptyState>
            ) : (
              <ul>
                {recent.data!.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-b border-border-soft py-2.5 last:border-0">
                    <Link href={`/akta/${a.id}`} className="min-w-0">
                      <div className="truncate text-[13px] font-medium hover:underline">{a.title}</div>
                      <div className="text-[11.5px] text-subtle">
                        {formatAktaNumber(a.number, a.number_period) ?? "Belum bernomor"} · {a.akta_type}
                      </div>
                    </Link>
                    <Badge tone={AKTA_STATUS_TONE[a.status as AktaStatus]}>{AKTA_STATUS_LABEL[a.status as AktaStatus]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <div className="space-y-4">
            <Section title="Jadwal hari ini" actions={<Link href="/jadwal" className="text-[12px] text-subtle hover:text-foreground">Semua jadwal</Link>}>
              {(schedules.data ?? []).length === 0 ? (
                <EmptyState>Tidak ada jadwal hari ini.</EmptyState>
              ) : (
                <ul>
                  {schedules.data!.map((j) => (
                    <li key={j.id} className="flex gap-3 border-b border-border-soft py-2.5 last:border-0">
                      <span className="w-12 shrink-0 text-[12.5px] font-semibold tabular-nums">{formatTime(j.starts_at)}</span>
                      <div>
                        <div className="text-[13px] font-medium">{j.title}</div>
                        <div className="text-[11.5px] text-subtle">
                          {SCHEDULE_KIND_LABEL[j.kind as ScheduleKind]}{j.location ? ` · ${j.location}` : ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="Ringkasan arsip">
              <div className="grid grid-cols-3 gap-3">
                {[["Minuta akta", minuta.count ?? 0], ["Akta dari protokol", protokolAkta.toLocaleString("id-ID")], ["Dokumen pendukung", Math.max(0, (docs.count ?? 0) - (minuta.count ?? 0))]].map(([l, v]) => (
                  <div key={String(l)}>
                    <div className="font-serif text-xl tabular-nums">{v}</div>
                    <div className="text-[11.5px] text-subtle">{l}</div>
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
