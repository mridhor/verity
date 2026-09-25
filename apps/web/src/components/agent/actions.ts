"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { contextKey } from "@/lib/agent/context-key";
import type { AgentContext, AgentEvent } from "@/lib/agent/types";
import { requirePrincipal } from "@/lib/auth";
import { dbMessage } from "@/lib/db-errors";
import { APPOINTMENT_LABEL, AKTA_STATUS_LABEL, DOCUMENT_TYPE_LABEL, formatAktaNumber, type AktaStatus, type DocumentType } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/utils";

export type StoredMessage = { id: number; role: "user" | "agent"; body: string | null; events: AgentEvent[]; author: string; createdAt: string };

/** Latest thread for this page context. Berkas threads are shared with berkas members. */
export async function loadThread(context: AgentContext): Promise<{ threadId: string | null; messages: StoredMessage[] }> {
  const me = await requirePrincipal();
  const supabase = await createClient();
  let q = supabase.from("agent_threads").select("id").eq("context->>key", contextKey(context)).order("updated_at", { ascending: false }).limit(1);
  if (context.kind === "kantor") q = q.eq("owner_user_id", me.userId);
  const { data: thread } = await q.maybeSingle();
  if (!thread) return { threadId: null, messages: [] };
  const [{ data: msgs }, { data: people }] = await Promise.all([
    supabase.from("agent_messages").select("id, role, body, events, author_user_id, created_at").eq("thread_id", thread.id).order("id").limit(200),
    supabase.from("tenant_members").select("user_id, display_name").eq("tenant_id", me.tenantId),
  ]);
  const nameOf = new Map((people ?? []).map((p) => [p.user_id, p.display_name]));
  return {
    threadId: thread.id,
    messages: (msgs ?? []).map((m) => ({
      id: m.id, role: m.role, body: m.body, events: (m.events ?? []) as AgentEvent[],
      author: nameOf.get(m.author_user_id) ?? "—", createdAt: formatDateTime(m.created_at),
    })),
  };
}

export type ProposalView = {
  id: string; tier: "staf" | "notaris"; status: "pending" | "applied" | "rejected" | "stale" | "expired";
  items: { op: string; label: string }[]; decidedBy: string | null; decidedAt: string | null;
  canDecide: boolean; reason: string | null;
};

export async function getProposals(ids: string[]): Promise<ProposalView[]> {
  const me = await requirePrincipal();
  const clean = z.array(z.uuid()).max(20).parse(ids);
  if (!clean.length) return [];
  const supabase = await createClient();
  const [{ data }, { data: people }] = await Promise.all([
    supabase.from("proposed_changes").select("id, tier, status, items, decided_by, decided_at, berkas_id").in("id", clean),
    supabase.from("tenant_members").select("user_id, display_name, role").eq("tenant_id", me.tenantId),
  ]);
  const person = new Map((people ?? []).map((p) => [p.user_id, p]));
  const isNotaris = me.role === "notaris" || me.role === "partner";
  const order = new Map(clean.map((id, i) => [id, i]));
  return (data ?? [])
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((p) => {
      const decider = p.decided_by ? person.get(p.decided_by) : undefined;
      const canDecide = p.status === "pending" && me.role !== "super_admin" && (p.tier === "staf" || (isNotaris && me.aal === "aal2"));
      return {
        id: p.id, tier: p.tier, status: p.status,
        items: (p.items as { op: string; label: string }[]).map((i) => ({ op: i.op, label: i.label })),
        decidedBy: decider ? `${decider.display_name}${decider.role === "notaris" ? ", Notaris" : ""}` : null,
        decidedAt: p.decided_at ? formatDateTime(p.decided_at) : null,
        canDecide,
        reason: p.status === "pending" && !canDecide
          ? p.tier === "notaris" ? "Perlu persetujuan Notaris" : "Super Admin tidak dapat menyetujui"
          : null,
      };
    });
}

export async function decideProposal(id: string, decision: "approve" | "reject"): Promise<{ status?: string; error?: string }> {
  await requirePrincipal();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_proposed_change", { p_proposal: z.uuid().parse(id), p_decision: decision });
  if (error) return { error: dbMessage(error, "Keputusan gagal disimpan.") };
  revalidatePath("/", "layout");
  return { status: data as string };
}

export type SearchHit = { group: string; label: string; sub?: string; href: string };

/** Navigator (⌘K) search across entities, under RLS, 5 per kind. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  const me = await requirePrincipal();
  const q = query.replace(/[%,()*]/g, " ").trim().slice(0, 80);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const like = `%${q}%`;
  const content = me.role !== "super_admin";
  const [berkas, akta, persons, companies, docs, legal] = await Promise.all([
    supabase.from("berkas").select("id, title").ilike("title", like).limit(5),
    content ? supabase.from("akta").select("id, title, number, number_period, status").ilike("title", like).limit(5) : Promise.resolve({ data: [] }),
    content ? supabase.from("persons").select("id, full_name, nik").ilike("full_name", like).limit(5) : Promise.resolve({ data: [] }),
    content ? supabase.from("companies").select("id, name, legal_form").ilike("name", like).limit(5) : Promise.resolve({ data: [] }),
    content ? supabase.from("documents").select("id, title, doc_type, berkas_id").ilike("title", like).limit(5) : Promise.resolve({ data: [] }),
    supabase.from("legal_references").select("id, number_label, title").or(`title.ilike.${like},number_label.ilike.${like}`).limit(5),
  ]);
  const list = <T>(r: { data: unknown }) => (r.data ?? []) as T[];
  return [
    ...list<{ id: string; title: string }>(berkas).map((b) => ({ group: "Berkas", label: b.title, href: `/berkas/${b.id}` })),
    ...list<{ id: string; title: string; number: number | null; number_period: string | null; status: AktaStatus }>(akta)
      .map((a) => ({ group: "Akta", label: a.title, sub: `${formatAktaNumber(a.number, a.number_period) ?? "Belum bernomor"} · ${AKTA_STATUS_LABEL[a.status]}`, href: `/akta/${a.id}` })),
    ...list<{ id: string; full_name: string; nik: string | null }>(persons)
      .map((p) => ({ group: "Orang", label: p.full_name, sub: p.nik ? `NIK ${p.nik}` : undefined, href: `/register/klapper?q=${encodeURIComponent(p.full_name)}` })),
    ...list<{ id: string; name: string; legal_form: string }>(companies)
      .map((c) => ({ group: "Badan usaha", label: `${c.legal_form} ${c.name}`, href: `/register/klapper?q=${encodeURIComponent(c.name)}` })),
    ...list<{ id: string; title: string; doc_type: DocumentType; berkas_id: string }>(docs)
      .map((d) => ({ group: "Dokumen", label: d.title, sub: DOCUMENT_TYPE_LABEL[d.doc_type], href: `/berkas/${d.berkas_id}?tab=dokumen` })),
    ...list<{ id: string; number_label: string; title: string }>(legal)
      .map((l) => ({ group: "Dasar hukum", label: l.number_label, sub: l.title, href: `/dasar-hukum/${l.id}` })),
  ];
}

export type CitationDetail = { title: string; subtitle: string; fields: { key: string; label: string; value: string }[]; href: string; download?: string };

/** Detail shown in the berkas document pane when a citation is opened (REQ-FE-02). */
export async function getCitationDetail(kind: string, id: string): Promise<CitationDetail | null> {
  await requirePrincipal();
  const uid = z.uuid().parse(id);
  const supabase = await createClient();
  if (kind === "person") {
    const { data: p } = await supabase.from("persons").select("full_name, nik, birth_place, birth_date, address, occupation, updated_at").eq("id", uid).maybeSingle();
    if (!p) return null;
    return {
      title: p.full_name, subtitle: `Data pihak, diperbarui ${formatDate(p.updated_at)}`, href: `/register/klapper?q=${encodeURIComponent(p.full_name)}`,
      fields: [
        { key: "nik", label: "NIK", value: p.nik ?? "Belum ada" },
        { key: "ttl", label: "Tempat/tgl lahir", value: [p.birth_place, p.birth_date && formatDate(p.birth_date)].filter(Boolean).join(", ") || "Belum ada" },
        { key: "address", label: "Alamat", value: p.address ?? "Belum ada" },
        { key: "occupation", label: "Pekerjaan", value: p.occupation ?? "Belum ada" },
      ],
    };
  }
  if (kind === "company") {
    const { data: c } = await supabase.from("companies").select("name, legal_form, nib, npwp, domicile").eq("id", uid).maybeSingle();
    if (!c) return null;
    return { title: `${c.legal_form} ${c.name}`, subtitle: "Data badan usaha", href: `/register/klapper?q=${encodeURIComponent(c.name)}`,
      fields: [{ key: "nib", label: "NIB", value: c.nib ?? "Belum ada" }, { key: "npwp", label: "NPWP", value: c.npwp ?? "Belum ada" }, { key: "domicile", label: "Kedudukan", value: c.domicile ?? "—" }] };
  }
  if (kind === "document") {
    const { data: d } = await supabase.from("documents").select("title, doc_type, file_name, size_bytes, uploaded_at, berkas_id").eq("id", uid).maybeSingle();
    if (!d) return null;
    return { title: d.title, subtitle: `${DOCUMENT_TYPE_LABEL[d.doc_type as DocumentType]}, diunggah ${formatDate(d.uploaded_at)}`, href: `/berkas/${d.berkas_id}?tab=dokumen`, download: `/dokumen/${uid}/unduh`,
      fields: [{ key: "file", label: "File", value: d.file_name }, { key: "type", label: "Jenis", value: DOCUMENT_TYPE_LABEL[d.doc_type as DocumentType] }] };
  }
  if (kind === "akta") {
    const { data: a } = await supabase.from("akta").select("title, akta_type, status, number, number_period, akta_date, appointment").eq("id", uid).maybeSingle();
    if (!a) return null;
    return { title: a.title, subtitle: `${a.akta_type} · ${APPOINTMENT_LABEL[a.appointment as "notaris" | "ppat"]}`, href: `/akta/${uid}`,
      fields: [
        { key: "number", label: "Nomor", value: formatAktaNumber(a.number, a.number_period) ?? "Belum bernomor" },
        { key: "status", label: "Status", value: AKTA_STATUS_LABEL[a.status as AktaStatus] },
        { key: "date", label: "Tanggal akta", value: a.akta_date ? formatDate(a.akta_date) : "—" },
      ] };
  }
  if (kind === "checklist") {
    const { data: i } = await supabase.from("checklist_items").select("title, due_date, done, berkas_id").eq("id", uid).maybeSingle();
    if (!i) return null;
    return { title: i.title, subtitle: "Item checklist", href: `/berkas/${i.berkas_id}?tab=checklist`,
      fields: [{ key: "due", label: "Tenggat", value: i.due_date ? formatDate(i.due_date) : "—" }, { key: "done", label: "Status", value: i.done ? "Selesai" : "Belum selesai" }] };
  }
  return null;
}
