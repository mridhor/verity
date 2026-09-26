import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SearchForm, Section, Table, td } from "@/components/ui/blocks";
import { isNotaryOffice, requirePrincipal } from "@/lib/auth";
import { APPOINTMENT_LABEL, PARTY_ROLE_LABEL, formatAktaNumber, type PartyRole } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate } from "@/lib/utils";
import { AgentPageContext } from "@/components/agent/agent-provider";

export const metadata = { title: "Buku klapper" };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type Entry = {
  id: string; indexed_name: string; entity_kind: string; initial_letter: string; party_role: PartyRole;
  akta_id: string | null; akta_number: number; akta_date: string; period: string; appointment: "notaris" | "ppat";
};

export default async function KlapperPage({ searchParams }: { searchParams: Promise<{ huruf?: string; q?: string; nama?: string }> }) {
  const me = await requirePrincipal();
  if (me.role === "super_admin") notFound();
  if (!(await isNotaryOffice(me.tenantId))) notFound();
  const { huruf, q, nama } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("klapper_entries")
    .select("id, indexed_name, entity_kind, initial_letter, party_role, akta_id, akta_number, akta_date, period, appointment")
    .order("indexed_name").limit(2000);
  const all = (data ?? []) as Entry[];
  const present = new Set(all.map((e) => e.initial_letter));
  const filtered = all.filter((e) => (!huruf || e.initial_letter === huruf) && (!q || e.indexed_name.toLowerCase().includes(q.toLowerCase())));

  const byName = new Map<string, Entry[]>();
  for (const e of filtered) byName.set(e.indexed_name, [...(byName.get(e.indexed_name) ?? []), e]);
  const selected = nama ? all.filter((e) => e.indexed_name === nama) : [];
  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ huruf, q, ...extra })) if (v) p.set(k, v);
    return `/register/klapper${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <AgentPageContext context={{ kind: "kantor", label: "Buku klapper", page: "register" }} suggestions={["cari Laras di klapper", "akta final bulan ini"]} />
      <PageHeader eyebrow="Register" title="Buku klapper digital"
        meta={<span>{byName.size} nama terindeks. Terbentuk otomatis dari pihak pada akta yang sudah final.</span>} />
      <div className="w-full max-w-[1100px] space-y-4 px-8 pt-5 pb-10">
        <SearchForm action="/register/klapper" value={q} placeholder="Cari nama penghadap atau badan usaha" hidden={{ huruf }} />
        <nav aria-label="Filter huruf" className="flex flex-wrap gap-1">
          <Link href={qs({ huruf: undefined, nama: undefined })} className={cn("rounded px-2 py-1 text-[12px] text-muted-foreground", !huruf && "bg-foreground text-card")}>Semua</Link>
          {LETTERS.map((l) => present.has(l) ? (
            <Link key={l} href={qs({ huruf: l, nama: undefined })} aria-current={huruf === l ? "true" : undefined}
              className={cn("w-7 rounded py-1 text-center text-[12px] font-medium", huruf === l ? "bg-foreground text-card" : "hover:bg-border-soft")}>{l}</Link>
          ) : (
            <span key={l} aria-hidden className="w-7 py-1 text-center text-[12px] text-border">{l}</span>
          ))}
        </nav>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {byName.size === 0 ? (
            <EmptyState>Tidak ada nama.</EmptyState>
          ) : (
            <Table head={["Nama", "Jenis", "Akta terdaftar", "Terakhir"]}>
              {[...byName.entries()].map(([name, entries]) => (
                <tr key={name} className={cn("hover:bg-border-soft/50", nama === name && "bg-border-soft")}>
                  <td className={td}><Link href={qs({ nama: name })} className="font-medium hover:underline">{name}</Link></td>
                  <td className={td}><Badge tone={entries[0]!.entity_kind === "badan_usaha" ? "info" : "neutral"}>{entries[0]!.entity_kind === "badan_usaha" ? "Badan usaha" : "Perorangan"}</Badge></td>
                  <td className={`${td} tabular-nums text-muted-foreground`}>{entries.map((e) => formatAktaNumber(e.akta_number, e.period)).join(", ")}</td>
                  <td className={`${td} tabular-nums text-muted-foreground whitespace-nowrap`}>{formatDate(entries.map((e) => e.akta_date).sort().at(-1)!)}</td>
                </tr>
              ))}
            </Table>
          )}
          <Section title={nama ?? "Detail"}
            description={selected.length ? `${selected.length} akta · terakhir diperbarui ${formatDate(selected.map((e) => e.akta_date).sort().at(-1)!)}` : undefined}>
            {selected.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-subtle">Pilih nama untuk melihat akta yang terdaftar.</p>
            ) : (
              <ul className="space-y-2">
                {selected.map((e) => (
                  <li key={e.id} className="rounded-lg bg-muted px-3 py-2.5 text-[12.5px]">
                    <div className="font-medium tabular-nums">
                      {e.akta_id ? <Link href={`/akta/${e.akta_id}`} className="hover:underline">{formatAktaNumber(e.akta_number, e.period)}</Link> : formatAktaNumber(e.akta_number, e.period)}
                      <span className="ml-1.5 font-normal text-subtle">{APPOINTMENT_LABEL[e.appointment]}</span>
                    </div>
                    <div className="text-subtle">{PARTY_ROLE_LABEL[e.party_role]} · {formatDate(e.akta_date)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
