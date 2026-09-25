import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Table, td } from "@/components/ui/blocks";
import { isNotaryOffice, requirePrincipal } from "@/lib/auth";
import { jakartaToday } from "@/lib/jakarta-time";
import { formatAktaNumber } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/utils";
import { CorrectionForm } from "./correction-form";
import { AgentPageContext } from "@/components/agent/agent-provider";

export default async function RepertoriumPage({ searchParams }: { searchParams: Promise<{ pejabat?: string; tahun?: string }> }) {
  const me = await requirePrincipal();
  if (me.role === "super_admin") notFound();
  if (!(await isNotaryOffice(me.tenantId))) notFound();
  const { pejabat = "notaris", tahun = String(jakartaToday().year) } = await searchParams;
  const appointment = pejabat === "ppat" ? "ppat" : "notaris";
  const supabase = await createClient();
  const [{ data: rows }, { data: periods }] = await Promise.all([
    supabase.from("repertorium_entries")
      .select("id, entry_no, akta_id, akta_number, akta_date, akta_type, title, parties_summary, source, corrects_entry_id, correction_note, created_at, period")
      .eq("appointment", appointment).eq("period", tahun).order("entry_no").order("created_at"),
    supabase.from("repertorium_entries").select("period").eq("appointment", appointment),
  ]);
  const years = [...new Set([String(jakartaToday().year), ...(periods ?? []).map((p) => p.period)])].sort().reverse();
  const corrections = new Map<string, NonNullable<typeof rows>>();
  for (const r of rows ?? []) {
    if (r.corrects_entry_id) corrections.set(r.corrects_entry_id, [...(corrections.get(r.corrects_entry_id) ?? []), r]);
  }
  const originals = (rows ?? []).filter((r) => !r.corrects_entry_id);

  return (
    <>
      <AgentPageContext context={{ kind: "kantor", label: "Repertorium", page: "register" }} suggestions={["repertorium notaris 2026", "repertorium PPAT 2026", "akta final bulan ini"]} />
      <PageHeader eyebrow="Register" title={`Repertorium ${appointment === "ppat" ? "PPAT" : "Notaris"} ${tahun}`}
        meta={<span>Terbentuk otomatis saat akta difinalkan. Entri tidak dapat diubah atau dihapus; koreksi dicatat sebagai entri baru.</span>} />
      <div className="w-full max-w-[1100px] space-y-4 px-8 pt-5 pb-10">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex gap-1.5">
            {(["notaris", "ppat"] as const).map((a) => (
              <Link key={a} href={`/register/repertorium?pejabat=${a}&tahun=${tahun}`} aria-current={a === appointment ? "true" : undefined}
                className={`rounded-full border border-border px-3 py-1 text-[12px] ${a === appointment ? "border-foreground bg-foreground text-card" : "text-muted-foreground"}`}>
                {a === "ppat" ? "Akta PPAT" : "Akta Notaris"}
              </Link>
            ))}
          </div>
          <nav aria-label="Tahun" className="flex gap-1.5">
            {[...new Set([...years, tahun])].sort().reverse().map((y) => (
              <Link key={y} href={`/register/repertorium?pejabat=${appointment}&tahun=${y}`} aria-current={y === tahun ? "true" : undefined}
                className={`rounded-full border border-border px-3 py-1 text-[12px] tabular-nums ${y === tahun ? "border-foreground bg-foreground text-card" : "text-muted-foreground"}`}>
                {y}
              </Link>
            ))}
          </nav>
        </div>
        {originals.length === 0 ? (
          <EmptyState>Belum ada entri untuk periode ini.</EmptyState>
        ) : (
          <Table head={["No.", "Tanggal", "Sifat akta", "Judul", "Nama penghadap", ""]}>
            {originals.map((r) => (
              <tr key={r.id}>
                <td className={`${td} font-medium tabular-nums`}>{formatAktaNumber(r.akta_number, r.period)}</td>
                <td className={`${td} tabular-nums text-muted-foreground whitespace-nowrap`}>{formatDate(r.akta_date)}</td>
                <td className={`${td} text-muted-foreground`}>{r.akta_type}</td>
                <td className={td}>
                  {r.akta_id ? <Link href={`/akta/${r.akta_id}`} className="hover:underline">{r.title}</Link> : r.title}
                  {r.source === "legacy_import" && <div><Badge>Impor data lama</Badge></div>}
                  {(corrections.get(r.id) ?? []).map((c) => (
                    <div key={c.id} className="mt-1.5 rounded bg-border-soft px-2 py-1 text-[12px]">
                      <span className="font-medium">Koreksi:</span> {c.correction_note}
                      <span className="text-subtle"> · {formatDateTime(c.created_at)}</span>
                    </div>
                  ))}
                </td>
                <td className={`${td} text-muted-foreground`}>{r.parties_summary}</td>
                <td className={`${td} text-right`}>{me.role === "notaris" && <CorrectionForm entryId={r.id} label={`Entri ${r.entry_no ?? ""}`.trim()} />}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </>
  );
}
