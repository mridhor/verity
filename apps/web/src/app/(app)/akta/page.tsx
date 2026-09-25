import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { AKTA_STATUS_TONE, Badge } from "@/components/ui/badge";
import { EmptyState, FilterChips, SearchForm, Table, td } from "@/components/ui/blocks";
import { notFound } from "next/navigation";
import { requirePrincipal } from "@/lib/auth";
import { aktaIdsMatching, likeTerm } from "@/lib/search/akta";
import { APPOINTMENT_LABEL, AKTA_STATUSES, AKTA_STATUS_LABEL, PARTY_ROLE_LABEL, formatAktaNumber, type AktaStatus, type PartyRole } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { AgentPageContext } from "@/components/agent/agent-provider";

type Party = { role: PartyRole; sort_order: number; persons: { full_name: string } | null; companies: { name: string; legal_form: string } | null };

export default async function AktaListPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const me = await requirePrincipal();
  if (me.role === "super_admin") notFound(); // no client content for the Super Admin (C-17)
  const { status, q } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("akta")
    .select("id, title, akta_type, appointment, status, number, number_period, akta_date, created_at, berkas(id, title), akta_parties(role, sort_order, persons(full_name), companies(name, legal_form))")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && (AKTA_STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
  if (q?.trim()) {
    // Title or type, plus akta number and party names (PRD: cari nomor, pihak, jenis).
    const ids = await aktaIdsMatching(supabase, q);
    const like = likeTerm(q);
    query = query.or([`title.ilike.${like}`, `akta_type.ilike.${like}`, ...(ids.length ? [`id.in.(${ids.join(",")})`] : [])].join(","));
  }
  const [{ data: rows, error }, { count: total }] = await Promise.all([
    query,
    supabase.from("akta").select("id", { count: "exact", head: true }),
  ]);

  const partyName = (p: Party) => p.persons?.full_name ?? (p.companies ? `${p.companies.legal_form} ${p.companies.name}` : "");

  return (
    <>
      <AgentPageContext context={{ kind: "kantor", label: "Seluruh kantor", page: "lainnya" }} suggestions={["akta menunggu TTD", "akta final bulan ini", "akta dalam verifikasi", "draft akta"]} />
      <PageHeader
        eyebrow={me.role === "notaris" ? "Semua akta kantor" : "Akta di berkas tempat Anda ditugaskan"}
        title="Manajemen akta"
        meta={<span>{total ?? 0} akta terdaftar</span>}
        actions={
          <Link href="/akta/baru" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-card hover:bg-foreground/90">
            <Plus size={14} /> Akta baru
          </Link>
        }
      />
      <div className="mx-auto w-full max-w-[1100px] space-y-4 px-8 py-7">
        <div className="flex flex-wrap items-center gap-3">
          <SearchForm action="/akta" value={q} placeholder="Cari nomor, pihak, judul, atau jenis akta" hidden={{ status }} />
          <FilterChips base="/akta" param="status" value={status} extra={{ q }}
            options={AKTA_STATUSES.map((s) => ({ value: s, label: AKTA_STATUS_LABEL[s] }))} />
        </div>
        {error && <p role="alert" className="text-destructive">Daftar akta gagal dimuat.</p>}
        {rows && rows.length === 0 ? (
          <EmptyState>{q || status ? "Tidak ada akta yang cocok." : "Belum ada akta. Buat akta dari sebuah berkas."}</EmptyState>
        ) : (
          <Table head={["Nomor", "Tanggal akta", "Jenis", "Judul", "Penghadap / pihak", "Pejabat", "Status"]}>
            {(rows ?? []).map((a) => {
              const parties = ((a.akta_parties ?? []) as unknown as Party[])
                .filter((p) => p.role !== "saksi")
                .sort((x, y) => x.sort_order - y.sort_order);
              return (
                <tr key={a.id} className="hover:bg-border-soft/50">
                  <td className={`${td} font-medium tabular-nums whitespace-nowrap`}>
                    {formatAktaNumber(a.number, a.number_period) ?? <span className="text-subtle">—</span>}
                  </td>
                  <td className={`${td} tabular-nums text-muted-foreground whitespace-nowrap`}>{a.akta_date ? formatDate(a.akta_date) : "—"}</td>
                  <td className={`${td} text-muted-foreground`}>{a.akta_type}</td>
                  <td className={td}>
                    <Link href={`/akta/${a.id}`} className="font-medium hover:underline">{a.title}</Link>
                    {a.berkas && <div className="text-[11.5px] text-subtle">{(a.berkas as unknown as { title: string }).title}</div>}
                  </td>
                  <td className={`${td} text-muted-foreground`}>
                    {parties.length === 0 ? "—" : parties.slice(0, 2).map((p) => (
                      <div key={partyName(p)}>{partyName(p)} <span className="text-[11px] text-subtle">({PARTY_ROLE_LABEL[p.role]})</span></div>
                    ))}
                    {parties.length > 2 && <div className="text-[11.5px] text-subtle">+{parties.length - 2} lainnya</div>}
                  </td>
                  <td className={`${td} text-muted-foreground`}>{APPOINTMENT_LABEL[a.appointment as "notaris" | "ppat"]}</td>
                  <td className={td}><Badge tone={AKTA_STATUS_TONE[a.status as AktaStatus]}>{AKTA_STATUS_LABEL[a.status as AktaStatus]}</Badge></td>
                </tr>
              );
            })}
          </Table>
        )}
      </div>
    </>
  );
}
