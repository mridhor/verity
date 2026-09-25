import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { AKTA_STATUS_TONE, Badge } from "@/components/ui/badge";
import { EmptyState, FilterChips, SearchForm, Table, td } from "@/components/ui/blocks";
import { notFound } from "next/navigation";
import { requirePrincipal } from "@/lib/auth";
import { aktaIdsMatching, likeTerm } from "@/lib/search/akta";
import { NewAktaDialog } from "./baru/new-akta-form";
import { newAktaOptions } from "./baru/options";
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
  const [{ data: rows, error }, { data: statuses }, newAkta] = await Promise.all([
    query,
    supabase.from("akta").select("status"),
    newAktaOptions(),
  ]);
  const total = (statuses ?? []).length;
  const statusCounts = Object.fromEntries(AKTA_STATUSES.map((s) => [s, (statuses ?? []).filter((x) => x.status === s).length]));

  const partyName = (p: Party) => p.persons?.full_name ?? (p.companies ? `${p.companies.legal_form} ${p.companies.name}` : "");

  return (
    <>
      <AgentPageContext context={{ kind: "kantor", label: "Seluruh kantor", page: "lainnya" }} suggestions={["akta menunggu TTD", "akta final bulan ini", "akta dalam verifikasi", "draft akta"]} />
      <PageHeader
        eyebrow={me.role === "notaris" ? "Semua akta kantor" : "Akta di berkas tempat Anda ditugaskan"}
        title="Manajemen akta"
        meta={<span>{total ?? 0} akta terdaftar</span>}
        actions={
          <NewAktaDialog {...newAkta} />
        }
      />
      <div className="w-full max-w-[1180px] space-y-4 px-8 pt-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips base="/akta" param="status" value={status} extra={{ q }}
            options={AKTA_STATUSES.map((s) => ({ value: s, label: AKTA_STATUS_LABEL[s], count: statusCounts[s] }))} />
          <SearchForm action="/akta" value={q} placeholder="Cari nomor, pihak, judul, atau jenis" hidden={{ status }} />
        </div>
        {error && <p role="alert" className="text-destructive">Daftar akta gagal dimuat.</p>}
        {rows && rows.length === 0 ? (
          <EmptyState>{q || status ? "Tidak ada akta yang cocok." : "Belum ada akta. Buat akta dari sebuah berkas."}</EmptyState>
        ) : (
          <Table head={["Akta", "Nomor", "Pihak", "Pejabat", "Status"]}>
            {(rows ?? []).map((a) => {
              const parties = ((a.akta_parties ?? []) as unknown as Party[])
                .filter((p) => p.role !== "saksi")
                .sort((x, y) => x.sort_order - y.sort_order);
              return (
                <tr key={a.id}>
                  <td className={`${td} min-w-72`}>
                    <Link href={`/akta/${a.id}`} className="group flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><FileText size={15} /></span>
                      <span className="min-w-0">
                        <span className="block font-medium group-hover:underline">{a.title}</span>
                        <span className="block truncate text-[12px] text-subtle">
                          {a.akta_type}{a.berkas ? ` · ${(a.berkas as unknown as { title: string }).title}` : ""}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {formatAktaNumber(a.number, a.number_period)
                      ? <><div className="font-medium tabular-nums">{formatAktaNumber(a.number, a.number_period)}</div><div className="text-[12px] text-subtle tabular-nums">{a.akta_date ? formatDate(a.akta_date) : ""}</div></>
                      : <span className="text-[12.5px] text-subtle">Belum bernomor</span>}
                  </td>
                  <td className={`${td} max-w-64 text-muted-foreground`}>
                    {parties.length === 0 ? <span className="text-subtle">—</span> : (
                      <div className="truncate" title={parties.map((p) => `${partyName(p)} (${PARTY_ROLE_LABEL[p.role]})`).join(", ")}>
                        {parties.slice(0, 2).map(partyName).join(", ")}
                        {parties.length > 2 && <span className="text-subtle"> +{parties.length - 2}</span>}
                      </div>
                    )}
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
