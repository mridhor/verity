import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { AKTA_STATUS_TONE, Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/blocks";
import { Button } from "@/components/ui/button";
import { requirePrincipal } from "@/lib/auth";
import { jakartaToday } from "@/lib/jakarta-time";
import {
  APPOINTMENT_LABEL, AKTA_STATUSES, AKTA_STATUS_LABEL, DOCUMENT_TYPE_LABEL, PARTY_ROLE_LABEL, formatAktaNumber,
  type AktaStatus, type DocumentType, type PartyRole,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { deleteDraft, removeParty } from "../actions";
import { AddPartyForms, EditAktaForm, FinalizeForm, TransitionButton } from "./akta-forms";

type PartyRow = {
  id: string; role: PartyRole; capacity: string | null; sort_order: number;
  persons: { full_name: string; nik: string | null; address: string | null; occupation: string | null } | null;
  companies: { name: string; legal_form: string; nib: string | null; domicile: string | null } | null;
};

const NOTARIS_ONLY = "Hanya Notaris yang dapat melakukan ini.";

export default async function AktaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePrincipal();
  const { id } = await params;
  const supabase = await createClient();
  const { data: akta } = await supabase
    .from("akta")
    .select("id, title, akta_type, notes, status, number, number_period, akta_date, appointment, created_by, created_at, finalized_at, berkas(id, title), officials(id, user_id, display_name, appointment)")
    .eq("id", id)
    .maybeSingle();
  if (!akta) notFound();

  const [{ data: parties }, { data: history }, { data: people }, { data: companies }, { data: docs }, { data: colleagues }] = await Promise.all([
    supabase.from("akta_parties").select("id, role, capacity, sort_order, persons(full_name, nik, address, occupation), companies(name, legal_form, nib, domicile)").eq("akta_id", id).order("sort_order"),
    supabase.from("akta_status_history").select("id, from_status, to_status, note, changed_by, changed_at").eq("akta_id", id).order("id"),
    supabase.from("persons").select("id, full_name, nik").order("full_name").limit(500),
    supabase.from("companies").select("id, name, legal_form, nib").order("name").limit(500),
    supabase.from("documents").select("id, title, doc_type, uploaded_at").eq("akta_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("tenant_members").select("user_id, display_name").eq("tenant_id", me.tenantId),
  ]);

  const status = akta.status as AktaStatus;
  const official = akta.officials as unknown as { user_id: string; display_name: string; appointment: "notaris" | "ppat" };
  const berkas = akta.berkas as unknown as { id: string; title: string };
  const nameOf = new Map((colleagues ?? []).map((c) => [c.user_id, c.display_name]));
  const isNotaris = me.role === "notaris";
  const isOfficial = official.user_id === me.userId;
  const canWrite = me.role !== "super_admin";
  const editable = canWrite && (status === "draft" || status === "verifikasi");
  const number = formatAktaNumber(akta.number, akta.number_period);
  const partyList = ((parties ?? []) as unknown as PartyRow[]);
  const signers = partyList.filter((p) => p.role !== "saksi").length;
  const stepIndex = AKTA_STATUSES.indexOf(status);

  return (
    <>
      <PageHeader
        eyebrow={`Akta / ${akta.akta_type}`}
        title={akta.title}
        meta={
          <>
            <span className="font-medium text-foreground">{number ? `Nomor ${number}` : "Belum bernomor"}</span>
            <span>{APPOINTMENT_LABEL[official.appointment]}: {official.display_name}</span>
            <span>Berkas: <Link href={`/berkas/${berkas.id}`} className="underline-offset-2 hover:underline">{berkas.title}</Link></span>
            {akta.akta_date && <span>Tanggal akta: {formatDate(akta.akta_date)}</span>}
          </>
        }
        actions={<Badge tone={AKTA_STATUS_TONE[status]}>{AKTA_STATUS_LABEL[status]}</Badge>}
      >
        <ol className="mt-[18px] mb-5 flex flex-wrap gap-x-[18px] gap-y-1" aria-label="Alur status akta">
          {AKTA_STATUSES.map((s, i) => {
            const state = i < stepIndex ? "done" : i === stepIndex ? "now" : "next";
            return (
              <li key={s} aria-current={state === "now" ? "step" : undefined}
                className={cn("flex items-center gap-[7px] text-[12.5px] text-subtle", state === "done" && "text-muted-foreground", state === "now" && "font-medium text-foreground")}>
                <span className={cn("grid size-[18px] place-items-center rounded-full border border-border bg-card text-[10.5px] tabular-nums",
                  state === "done" && "border-foreground bg-foreground text-card",
                  state === "now" && "border-primary text-primary shadow-[0_0_0_3px_var(--primary-soft)]")}>
                  {state === "done" ? <Check size={10} strokeWidth={3} /> : i + 1}
                </span>
                {AKTA_STATUS_LABEL[s]}
              </li>
            );
          })}
        </ol>
      </PageHeader>

      <div className="mx-auto grid w-full max-w-[1100px] gap-5 px-8 py-7 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Section title={`Pihak (${partyList.length})`}>
            {partyList.length === 0 ? (
              <p className="py-3 text-[13px] text-subtle">Belum ada pihak. Tambahkan penghadap sebelum akta diajukan untuk tanda tangan.</p>
            ) : (
              <ul>
                {partyList.map((p) => (
                  <li key={p.id} className="flex items-start gap-3 border-b border-border-soft py-2.5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium">
                        {p.persons?.full_name ?? `${p.companies?.legal_form} ${p.companies?.name}`}
                        <span className="ml-2 text-[11.5px] font-normal text-subtle">{PARTY_ROLE_LABEL[p.role]}{p.capacity ? `, ${p.capacity}` : ""}</span>
                      </div>
                      <div className="text-[12px] tabular-nums text-muted-foreground">
                        {p.persons
                          ? [p.persons.nik && `NIK ${p.persons.nik}`, p.persons.occupation, p.persons.address].filter(Boolean).join(" · ") || "Data identitas belum lengkap"
                          : [p.companies?.nib && `NIB ${p.companies.nib}`, p.companies?.domicile].filter(Boolean).join(" · ") || "Data badan usaha belum lengkap"}
                      </div>
                    </div>
                    {editable && (
                      <form action={removeParty}>
                        <input type="hidden" name="partyId" value={p.id} />
                        <input type="hidden" name="aktaId" value={akta.id} />
                        <Button size="sm" variant="ghost">Hapus</Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editable ? (
              <div className="mt-4 border-t border-border-soft pt-4">
                <AddPartyForms
                  aktaId={akta.id}
                  subjects={[
                    ...(people ?? []).map((p) => ({ value: `person:${p.id}`, label: `${p.full_name}${p.nik ? ` · ${p.nik}` : ""}` })),
                    ...(companies ?? []).map((c) => ({ value: `company:${c.id}`, label: `${c.legal_form} ${c.name}${c.nib ? ` · NIB ${c.nib}` : ""}` })),
                  ]}
                />
              </div>
            ) : (
              status !== "draft" && status !== "verifikasi" && (
                <p className="mt-3 text-[11.5px] text-subtle">Pihak terkunci sejak akta diajukan untuk tanda tangan.</p>
              )
            )}
          </Section>

          {editable && (
            <Section title="Informasi akta">
              <EditAktaForm aktaId={akta.id} title={akta.title} notes={akta.notes} />
            </Section>
          )}
          {!editable && akta.notes && (
            <Section title="Keterangan"><p className="text-[13px] whitespace-pre-line">{akta.notes}</p></Section>
          )}

          <Section title="Dokumen terkait">
            {(docs ?? []).length === 0 ? (
              <p className="text-[13px] text-subtle">
                Belum ada dokumen untuk akta ini. Unggah dari <Link href={`/berkas/${berkas.id}?tab=dokumen`} className="underline">tab Dokumen berkas</Link>.
              </p>
            ) : (
              <ul>
                {docs!.map((d) => (
                  <li key={d.id} className="flex items-center justify-between border-b border-border-soft py-2 text-[13px] last:border-0">
                    <span>{d.title} <span className="text-[11.5px] text-subtle">· {DOCUMENT_TYPE_LABEL[d.doc_type as DocumentType]}</span></span>
                    <Link href={`/dokumen/${d.id}/unduh`} className="text-[12px] text-muted-foreground hover:text-foreground">Unduh</Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="space-y-5">
          <Section title="Tindakan">
            <div className="space-y-3">
              {!canWrite && <p className="text-[12.5px] text-subtle">Super Admin tidak dapat mengubah akta.</p>}
              {canWrite && status === "draft" && (
                <>
                  <TransitionButton aktaId={akta.id} to="verifikasi" label="Ajukan verifikasi" variant="ink" />
                  {(akta.created_by === me.userId || isNotaris) && (
                    <form action={deleteDraft}>
                      <input type="hidden" name="aktaId" value={akta.id} />
                      <Button variant="danger" size="sm">Hapus draft</Button>
                    </form>
                  )}
                </>
              )}
              {canWrite && status === "verifikasi" && (
                <>
                  <TransitionButton aktaId={akta.id} to="menunggu_ttd" label="Setujui untuk penandatanganan" variant="primary"
                    disabledReason={!isNotaris ? NOTARIS_ONLY : signers === 0 ? "Tambahkan minimal satu penghadap." : undefined} />
                  <TransitionButton aktaId={akta.id} to="draft" label="Kembalikan ke draft" />
                </>
              )}
              {canWrite && status === "menunggu_ttd" && (
                <>
                  <FinalizeForm aktaId={akta.id} today={jakartaToday().date}
                    disabledReason={!isNotaris ? NOTARIS_ONLY : !isOfficial ? `Hanya ${official.display_name} (pejabat akta ini) yang dapat memfinalkan.` : undefined} />
                  <TransitionButton aktaId={akta.id} to="verifikasi" label="Kembalikan ke verifikasi" disabledReason={!isNotaris ? NOTARIS_ONLY : undefined} />
                </>
              )}
              {canWrite && status === "selesai" && (
                <TransitionButton aktaId={akta.id} to="diarsipkan" label="Arsipkan" disabledReason={!isNotaris ? NOTARIS_ONLY : undefined} />
              )}
              {status === "diarsipkan" && <p className="text-[12.5px] text-subtle">Akta telah diarsipkan.</p>}
            </div>
          </Section>

          <Section title="Riwayat status">
            <ol className="space-y-2.5">
              <li className="text-[12.5px]">
                <div>Dibuat sebagai draft</div>
                <div className="text-[11.5px] text-subtle">{nameOf.get(akta.created_by) ?? "—"} · {formatDateTime(akta.created_at)}</div>
              </li>
              {(history ?? []).map((h) => (
                <li key={h.id} className="text-[12.5px]">
                  <div>{AKTA_STATUS_LABEL[h.from_status as AktaStatus]} → {AKTA_STATUS_LABEL[h.to_status as AktaStatus]}</div>
                  <div className="text-[11.5px] text-subtle">{nameOf.get(h.changed_by ?? "") ?? "—"} · {formatDateTime(h.changed_at)}</div>
                </li>
              ))}
            </ol>
          </Section>
        </aside>
      </div>
    </>
  );
}
