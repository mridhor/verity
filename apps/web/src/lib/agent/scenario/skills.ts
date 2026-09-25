import "server-only";
import { berkasType } from "@/lib/berkas-types";
import { addDays, parseDate, parseTime } from "./dates";
import { jakartaInstant, jakartaToday, formatTime, formatLongDate, jakartaDateOf } from "@/lib/jakarta-time";
import {
  AKTA_STATUS_LABEL, APPOINTMENT_LABEL, DOCUMENT_TYPE_LABEL, LEGAL_CATEGORY_LABEL, PARTY_ROLE_LABEL, SCHEDULE_KIND_LABEL,
  formatAktaNumber, type AktaStatus, type DocumentType, type LegalCategory, type PartyRole, type ScheduleKind,
} from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { ReadonlyDb } from "../readonly-db";
import type { AgentContext, AgentRunInput } from "../types";
import type { Intent } from "./intents";
import type { RunBuilder } from "./run";

type Ctx = { db: ReadonlyDb; run: RunBuilder; input: AgentRunInput; context: AgentContext };

type AktaRow = { id: string; title: string; akta_type: string; status: AktaStatus; number: number | null; number_period: string | null; berkas_id: string; appointment: "notaris" | "ppat"; akta_date: string | null };
type PartyRow = {
  id: string; akta_id: string; role: PartyRole; capacity: string | null;
  persons: { id: string; full_name: string; nik: string | null; address: string | null; occupation: string | null } | null;
  companies: { id: string; name: string; legal_form: string; nib: string | null } | null;
};
type DocRow = { id: string; title: string; file_name: string; doc_type: DocumentType; berkas_id: string; akta_id: string | null };

const rows = <T>(r: { data: unknown }) => (r.data ?? []) as T[];
const aktaLabel = (a: Pick<AktaRow, "number" | "number_period" | "title">) =>
  formatAktaNumber(a.number, a.number_period) ? `Akta ${formatAktaNumber(a.number, a.number_period)}` : a.title;
const partyName = (p: PartyRow) => p.persons?.full_name ?? `${p.companies?.legal_form} ${p.companies?.name}`;
const nameTokens = (name: string) => name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
const esc = (s: string) => s.replace(/[%,()*]/g, " ").trim();

// ─── Shared loaders ───

async function loadBerkas(c: Ctx, berkasId: string) {
  const [b, akta, docs] = await Promise.all([
    c.db.select("berkas", "id, title, type, workflow_step, pic_user_id").eq("id", berkasId).maybeSingle(),
    c.db.select("akta", "id, title, akta_type, status, number, number_period, berkas_id, appointment, akta_date").eq("berkas_id", berkasId).order("created_at"),
    c.db.select("documents", "id, title, file_name, doc_type, berkas_id, akta_id").eq("berkas_id", berkasId),
  ]);
  const aktaRows = rows<AktaRow>(akta);
  const parties = aktaRows.length
    ? rows<PartyRow>(await c.db.select("akta_parties", "id, akta_id, role, capacity, persons(id, full_name, nik, address, occupation), companies(id, name, legal_form, nib)")
        .in("akta_id", aktaRows.map((a) => a.id)).order("sort_order"))
    : [];
  return { berkas: b.data as { id: string; title: string; type: string; workflow_step: string | null } | null, akta: aktaRows, docs: rows<DocRow>(docs), parties };
}

function citeAkta(c: Ctx, a: AktaRow) {
  return c.run.cite({ kind: "akta", id: a.id, label: aktaLabel(a), href: `/akta/${a.id}` });
}
function citeParty(c: Ctx, p: PartyRow, field?: string) {
  if (p.persons) {
    return c.run.cite({ kind: "person", id: p.persons.id, label: `${p.persons.full_name}${field ? `, ${field === "nik" ? "NIK" : field === "address" ? "alamat" : field}` : ""}`, href: `/akta/${p.akta_id}`, ...(field ? { field } : {}) });
  }
  return c.run.cite({ kind: "company", id: p.companies!.id, label: `${p.companies!.legal_form} ${p.companies!.name}`, href: `/akta/${p.akta_id}` });
}
function citeDoc(c: Ctx, d: DocRow) {
  return c.run.cite({ kind: "document", id: d.id, label: d.title, href: `/berkas/${d.berkas_id}?tab=dokumen` });
}

function requireBerkas(c: Ctx): string | null {
  if (c.context.kind === "kantor") {
    c.run.say("Pertanyaan ini tentang satu berkas. Buka berkasnya lalu tanyakan dari sana, atau sebutkan nama berkasnya, misalnya \"buka berkas Sinar Kopi\".");
    c.run.suggest(["akta menunggu TTD", "tenggat minggu ini"]);
    return null;
  }
  return c.context.berkasId;
}

async function proposeItems(c: Ctx, berkasId: string, items: { op: string; label: string; params: Record<string, unknown> }[], salt: string) {
  const { data, error } = await c.db.rpc("create_proposed_changes", {
    p_berkas: berkasId, p_items: items, p_idempotency_key: `${c.input.threadId}:${c.input.userMessageId}:${salt}`, p_thread: c.input.threadId,
  });
  if (error) {
    c.run.say(`Usulan tidak dapat dibuat: ${error.message}.`);
    return [];
  }
  const ids = (data ?? []) as unknown as string[];
  c.run.proposal(ids);
  return ids;
}

// ─── Skills ───

export async function summary(c: Ctx) {
  const id = requireBerkas(c);
  if (!id) return;
  c.run.step("Membaca data berkas, akta, dan dokumen");
  const { berkas, akta, docs } = await loadBerkas(c, id);
  if (!berkas) return void c.run.say("Berkas ini tidak dapat saya baca.");
  const [check, sched] = await Promise.all([
    c.db.select("checklist_items", "id, title, done, due_date").eq("berkas_id", id),
    c.db.select("schedules", "id, title, starts_at, kind").eq("berkas_id", id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(1),
  ]);
  c.run.step("Memeriksa checklist dan jadwal");
  const cite = c.run.cite({ kind: "berkas", id, label: berkas.title, href: `/berkas/${id}` });
  const type = berkasType(berkas.type);
  c.run.say(`${berkas.title} adalah berkas ${type?.label ?? berkas.type}${berkas.workflow_step ? `, saat ini di langkah ${berkas.workflow_step}` : ""} ${cite}.`);
  if (akta.length === 0) c.run.say("Belum ada akta di berkas ini.");
  else c.run.say(`Akta: ${akta.map((a) => `${aktaLabel(a)} berstatus ${AKTA_STATUS_LABEL[a.status]} ${citeAkta(c, a)}`).join("; ")}.`);
  const items = rows<{ id: string; title: string; done: boolean; due_date: string | null }>(check);
  if (items.length) {
    const open = items.filter((i) => !i.done).sort((a, b) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9"));
    const next = open[0];
    c.run.say(`Checklist ${items.length - open.length}/${items.length} selesai.${next ? ` Berikutnya: ${next.title}${next.due_date ? `, tenggat ${formatDate(next.due_date)}` : ""} ${c.run.cite({ kind: "checklist", id: next.id, label: next.title, href: `/berkas/${id}?tab=checklist` })}.` : ""}`);
  }
  const s = rows<{ id: string; title: string; starts_at: string; kind: ScheduleKind }>(sched)[0];
  if (s) c.run.say(`Jadwal berikutnya: ${s.title}, ${formatLongDate(jakartaDateOf(s.starts_at))} pukul ${formatTime(s.starts_at)} ${c.run.cite({ kind: "schedule", id: s.id, label: s.title, href: "/jadwal" })}.`);
  c.run.say(`${docs.length} dokumen tersimpan di berkas ini.`);
  c.run.suggest(["cek kelengkapan dokumen pendiri", "apa yang kurang sebelum difinalkan?", "siapa saja penghadapnya?"]);
}

export async function parties(c: Ctx) {
  const id = requireBerkas(c);
  if (!id) return;
  c.run.step("Membaca pihak pada akta di berkas ini");
  const { akta, parties } = await loadBerkas(c, id);
  const scoped = c.context.kind === "akta" ? parties.filter((p) => p.akta_id === (c.context as { aktaId: string }).aktaId) : parties;
  if (scoped.length === 0) return void c.run.say("Belum ada pihak yang tercatat.");
  c.run.table(["Nama", "Kedudukan", "Akta", "NIK / NIB"], scoped.map((p) => {
    const a = akta.find((x) => x.id === p.akta_id)!;
    return { cells: [`${partyName(p)} ${citeParty(c, p)}`, PARTY_ROLE_LABEL[p.role] + (p.capacity ? `, ${p.capacity}` : ""), aktaLabel(a), p.persons?.nik ?? p.companies?.nib ?? "—"] };
  }));
}

/** PRD-A-02: per-party completeness and consistency, with both sources cited. */
export async function kelengkapan(c: Ctx) {
  const id = requireBerkas(c);
  if (!id) return;
  c.run.step("Membaca pihak pada akta di berkas ini");
  const { berkas, akta, docs, parties } = await loadBerkas(c, id);
  c.run.step(`Membaca ${docs.length} dokumen di berkas`);
  const openChecklist = rows<{ title: string }>(await c.db.select("checklist_items", "title").eq("berkas_id", id).eq("done", false));
  c.run.step("Mencocokkan data pihak dengan dokumen identitas");

  const people = new Map<string, PartyRow>();
  for (const p of parties) if (p.role !== "saksi") people.set(p.persons?.id ?? p.companies!.id, p);
  if (people.size === 0) {
    c.run.say("Belum ada pihak (selain saksi) pada akta di berkas ini, jadi belum ada yang bisa saya periksa.");
    return;
  }
  const findDoc = (p: PartyRow, types: DocumentType[]) => {
    const tokens = nameTokens(partyName(p));
    return docs.find((d) => types.includes(d.doc_type) && tokens.some((t) => `${d.title} ${d.file_name}`.toLowerCase().includes(t)));
  };

  const proposals: { op: string; label: string; params: Record<string, unknown> }[] = [];
  const findings: string[] = [];
  const due = addDays(jakartaToday().date, 4);
  const addTodo = (title: string) => {
    if (!openChecklist.some((o) => o.title.toLowerCase() === title.toLowerCase())) {
      proposals.push({ op: "checklist.add", label: `Tambah ke checklist: ${title}, tenggat ${formatDate(due)}`, params: { title, due_date: due } });
    }
  };

  const table = [...people.values()].map((p) => {
    const name = partyName(p);
    if (p.companies) {
      return { cells: [`${name} ${citeParty(c, p)}`, p.companies.nib ? "NIB ada" : "NIB belum ada", "—", "—", p.companies.nib ? "Cocok" : "Lengkapi NIB"], tone: (p.companies.nib ? "ok" : "warn") as "ok" | "warn" };
    }
    const person = p.persons!;
    const ktp = findDoc(p, ["ktp"]);
    const npwp = findDoc(p, ["npwp"]);
    const notes: string[] = [];
    if (!person.nik) { notes.push("NIK belum diisi"); findings.push(`NIK ${name} belum tercatat ${citeParty(c, p, "nik")}.`); addTodo(`Lengkapi NIK ${name}`); }
    if (!person.address) { notes.push("alamat belum diisi"); findings.push(`Alamat ${name} belum tercatat ${citeParty(c, p, "address")}.`); }
    if (!ktp) { notes.push("KTP belum diunggah"); findings.push(`Pindaian KTP ${name} belum ada di berkas ${citeParty(c, p)}. Ini perlu sebelum penandatanganan.`); addTodo(`Minta KTP ${name}`); }
    if (!npwp) { notes.push("NPWP belum ada"); findings.push(`NPWP ${name} belum ada di berkas ${citeParty(c, p)}. Tidak menghalangi penandatanganan, tetapi dibutuhkan untuk pendaftaran NIB di OSS.`); addTodo(`Minta NPWP ${name}`); }
    const tone: "ok" | "warn" | "bad" = !person.nik || !ktp ? "bad" : notes.length ? "warn" : "ok";
    return {
      cells: [
        `${name} ${citeParty(c, p)}`,
        person.nik ? `${person.nik} ${citeParty(c, p, "nik")}` : "Belum ada",
        ktp ? `Ada ${citeDoc(c, ktp)}` : "Belum ada",
        npwp ? `Ada ${citeDoc(c, npwp)}` : "Belum ada",
        notes.length ? `${notes.length} catatan` : "Cocok",
      ],
      tone,
    };
  });

  c.run.say(`Saya memeriksa ${people.size} pihak pada ${akta.length} akta dan ${docs.length} dokumen di berkas ${berkas?.title ?? "ini"}.`);
  c.run.table(["Pihak", "NIK", "KTP", "NPWP", "Hasil cek"], table);
  if (findings.length === 0) c.run.say("Semua pihak memiliki NIK, alamat, KTP, dan NPWP yang tercatat.");
  for (const f of findings) c.run.say(f);
  c.run.say("Catatan: pencocokan dokumen memakai judul dan nama file. Pembacaan isi dokumen (OCR) belum tersedia, jadi isi KTP belum dibandingkan dengan data pihak.");
  if (berkas?.type === "ajb" && !docs.some((d) => d.doc_type === "sertifikat")) {
    c.run.say("Sertifikat tanah belum diunggah di berkas AJB ini.");
    addTodo("Minta salinan sertifikat tanah");
  }
  if (proposals.length) await proposeItems(c, id, proposals, "kelengkapan");
  c.run.suggest(["apa yang kurang sebelum difinalkan?", "ringkasan berkas"]);
}

/** Akta readiness; proposes the next workflow step. Never finalizes (rule 2). */
export async function readiness(c: Ctx) {
  const id = requireBerkas(c);
  if (!id) return;
  c.run.step("Membaca akta, pihak, dan dokumen");
  const { akta, docs, parties } = await loadBerkas(c, id);
  const targets = c.context.kind === "akta" ? akta.filter((a) => a.id === (c.context as { aktaId: string }).aktaId) : akta.filter((a) => a.status !== "selesai" && a.status !== "diarsipkan");
  if (targets.length === 0) return void c.run.say(akta.length ? "Semua akta di berkas ini sudah final." : "Belum ada akta di berkas ini.");
  c.run.step("Memeriksa syarat setiap langkah");
  const proposals: { op: string; label: string; params: Record<string, unknown> }[] = [];
  for (const a of targets) {
    const ps = parties.filter((p) => p.akta_id === a.id && p.role !== "saksi");
    const missingNik = ps.filter((p) => p.persons && !p.persons.nik);
    const minuta = docs.find((d) => d.akta_id === a.id && d.doc_type === "minuta");
    const rows: { cells: string[]; tone: "ok" | "warn" | "bad" }[] = [
      { cells: ["Status", AKTA_STATUS_LABEL[a.status]], tone: "ok" },
      { cells: ["Penghadap / pihak", ps.length ? `${ps.length} tercatat` : "Belum ada"], tone: ps.length ? "ok" : "bad" },
      { cells: ["NIK pihak perorangan", missingNik.length ? `${missingNik.map((p) => `${partyName(p)} ${citeParty(c, p, "nik")}`).join(", ")} belum ada` : "Lengkap"], tone: missingNik.length ? "bad" : "ok" },
      { cells: ["Minuta bertanda tangan", minuta ? `Ada ${citeDoc(c, minuta)}` : "Belum diunggah"], tone: minuta ? "ok" : "warn" },
    ];
    c.run.say(`${aktaLabel(a)} (${APPOINTMENT_LABEL[a.appointment]}) ${citeAkta(c, a)}:`);
    c.run.table(["Syarat", "Keadaan"], rows);
    const blockers = !ps.length || missingNik.length > 0;
    if (a.status === "draft") {
      c.run.say(blockers ? "Lengkapi pihak dan NIK dulu, lalu draft bisa diajukan untuk verifikasi." : "Draft siap diajukan untuk verifikasi. Saya siapkan usulannya di bawah.");
      if (!blockers) proposals.push({ op: "akta.submit_verification", label: `Ajukan ${aktaLabel(a)} untuk verifikasi`, params: { akta_id: a.id } });
    } else if (a.status === "verifikasi") {
      c.run.say(blockers ? "Masih ada kekurangan sebelum akta bisa disetujui untuk penandatanganan." : "Akta siap disetujui untuk penandatanganan. Persetujuan ini hanya dapat diberikan oleh Notaris.");
      if (!blockers) proposals.push({ op: "akta.approve_for_signing", label: `Setujui ${aktaLabel(a)} untuk penandatanganan`, params: { akta_id: a.id } });
    } else if (a.status === "menunggu_ttd") {
      c.run.say("Akta menunggu tanda tangan. Setelah ditandatangani, Notaris memfinalkan dan memberi nomor dari halaman akta. Saya tidak dapat memfinalkan, memberi nomor, atau menandatangani akta.");
    }
  }
  if (proposals.length) await proposeItems(c, id, proposals, "readiness");
}

export async function proposeAktaStep(c: Ctx) {
  if (c.context.kind !== "akta") {
    c.run.say("Buka halaman aktanya dulu, lalu minta saya mengajukan langkah berikutnya.");
    return;
  }
  return readiness(c);
}

export async function proposeChecklist(c: Ctx, text: string) {
  const id = requireBerkas(c);
  if (!id) return;
  const due = parseDate(text);
  const title = text.replace(/[,;]?\s*(tenggat|batas|deadline|paling lambat|sebelum)\b.*$/i, "").replace(/[.,;\s]+$/, "").trim();
  if (title.length < 3) return void c.run.say("Sebutkan item checklist-nya, misalnya \"tambahkan checklist minta NPWP Laras, tenggat Senin\".");
  const nice = title.charAt(0).toUpperCase() + title.slice(1);
  c.run.step("Menyiapkan usulan checklist");
  c.run.say(`Saya siapkan usulan item checklist "${nice}"${due ? ` dengan tenggat ${formatDate(due)}` : ""}. Item baru ditambahkan setelah disetujui.`);
  await proposeItems(c, id, [{ op: "checklist.add", label: `Tambah ke checklist: ${nice}${due ? `, tenggat ${formatDate(due)}` : ""}`, params: { title: nice, ...(due ? { due_date: due } : {}) } }], "checklist");
}

export async function proposeSchedule(c: Ctx, text: string) {
  const id = requireBerkas(c);
  if (!id) return;
  const date = parseDate(text);
  const time = parseTime(text);
  if (!date || !time) return void c.run.say("Sebutkan tanggal dan jamnya, misalnya \"jadwalkan penandatanganan besok 14.00 di Ruang Utama\".");
  const kind: ScheduleKind = /(tanda ?tangan|penandatangan|ttd)/.test(text) ? "penandatanganan" : /(internal|rapat)/.test(text) ? "internal" : "pertemuan_klien";
  const location = text.match(/\bdi\s+(ruang[^,.;]*|kantor[^,.;]*)/i)?.[1]?.trim();
  const title = (text.replace(/\b(hari ini|besok|lusa|senin|selasa|rabu|kamis|jumat|sabtu|minggu)\b.*$/i, "").trim() || SCHEDULE_KIND_LABEL[kind]);
  const nice = title.charAt(0).toUpperCase() + title.slice(1);
  c.run.step("Menyiapkan usulan jadwal");
  c.run.say(`Saya siapkan usulan jadwal ${SCHEDULE_KIND_LABEL[kind].toLowerCase()} pada ${formatLongDate(date)} pukul ${time.replace(":", ".")} WIB${location ? ` di ${location}` : ""}.`);
  await proposeItems(c, id, [{
    op: "schedule.add", label: `Jadwalkan: ${nice}, ${formatLongDate(date)} ${time.replace(":", ".")} WIB${location ? `, ${location}` : ""}`,
    params: { title: nice, kind, starts_at: jakartaInstant(date, time), ...(location ? { location } : {}) },
  }], "schedule");
}

export async function aktaByStatus(c: Ctx, status: AktaStatus) {
  c.run.step(`Mencari akta berstatus ${AKTA_STATUS_LABEL[status]}`);
  const list = rows<AktaRow>(await c.db.select("akta", "id, title, akta_type, status, number, number_period, berkas_id, appointment, akta_date").eq("status", status).order("updated_at", { ascending: false }).limit(15));
  if (list.length === 0) return void c.run.say(`Tidak ada akta berstatus ${AKTA_STATUS_LABEL[status]} yang dapat Anda lihat.`);
  c.run.say(`Ada ${list.length} akta berstatus ${AKTA_STATUS_LABEL[status]}:`);
  c.run.table(["Akta", "Jenis", "Pejabat"], list.map((a) => ({ cells: [`${aktaLabel(a)} ${citeAkta(c, a)}`, a.akta_type, APPOINTMENT_LABEL[a.appointment]] })));
}

export async function aktaFinalPeriod(c: Ctx, period: "bulan" | "tahun") {
  const t = jakartaToday();
  const from = period === "bulan" ? `${t.year}-${String(t.month).padStart(2, "0")}-01` : `${t.year}-01-01`;
  c.run.step(`Menghitung akta final ${period === "bulan" ? "bulan" : "tahun"} ini`);
  const list = rows<AktaRow>(await c.db.select("akta", "id, title, akta_type, status, number, number_period, berkas_id, appointment, akta_date").in("status", ["selesai", "diarsipkan"]).gte("akta_date", from).order("akta_date", { ascending: false }));
  c.run.say(`${list.length} akta difinalkan sejak ${formatDate(from)}.`);
  if (list.length) c.run.table(["Nomor", "Tanggal", "Judul"], list.slice(0, 15).map((a) => ({ cells: [`${formatAktaNumber(a.number, a.number_period)} ${citeAkta(c, a)}`, a.akta_date ? formatDate(a.akta_date) : "—", a.title] })));
}

export async function schedules(c: Ctx, range: "hari_ini" | "besok" | "minggu") {
  const today = jakartaToday().date;
  const start = range === "besok" ? addDays(today, 1) : today;
  const end = range === "minggu" ? addDays(today, 7) : addDays(start, 1);
  c.run.step("Membaca jadwal");
  let q = c.db.select("schedules", "id, title, kind, starts_at, location, berkas_id").gte("starts_at", jakartaInstant(start)).lt("starts_at", jakartaInstant(end)).order("starts_at");
  if (c.context.kind !== "kantor") q = q.eq("berkas_id", c.context.berkasId);
  const list = rows<{ id: string; title: string; kind: ScheduleKind; starts_at: string; location: string | null }>(await q);
  const label = range === "hari_ini" ? "hari ini" : range === "besok" ? "besok" : "7 hari ke depan";
  if (list.length === 0) return void c.run.say(`Tidak ada jadwal ${label}.`);
  c.run.say(`Jadwal ${label}:`);
  c.run.table(["Waktu", "Agenda", "Jenis", "Lokasi"], list.map((s) => ({
    cells: [`${range === "minggu" ? `${formatDate(jakartaDateOf(s.starts_at))} ` : ""}${formatTime(s.starts_at)}`, `${s.title} ${c.run.cite({ kind: "schedule", id: s.id, label: s.title, href: "/jadwal" })}`, SCHEDULE_KIND_LABEL[s.kind], s.location ?? "—"],
  })));
}

export async function deadlines(c: Ctx) {
  const today = jakartaToday().date;
  c.run.step("Membaca checklist yang belum selesai");
  let q = c.db.select("checklist_items", "id, title, due_date, berkas_id, berkas(title)").eq("done", false).not("due_date", "is", null).lte("due_date", addDays(today, 7)).order("due_date");
  if (c.context.kind !== "kantor") q = q.eq("berkas_id", c.context.berkasId);
  const list = rows<{ id: string; title: string; due_date: string; berkas_id: string; berkas: { title: string } | null }>(await q);
  if (list.length === 0) return void c.run.say("Tidak ada tenggat checklist dalam 7 hari ke depan.");
  c.run.say(`${list.length} tenggat dalam 7 hari ke depan (termasuk yang terlambat):`);
  c.run.table(["Tenggat", "Item", "Berkas"], list.map((i) => ({
    cells: [formatDate(i.due_date), `${i.title} ${c.run.cite({ kind: "checklist", id: i.id, label: i.title, href: `/berkas/${i.berkas_id}?tab=checklist` })}`, i.berkas?.title ?? "—"],
    tone: i.due_date < today ? "bad" : "warn",
  })));
  c.run.say("Tenggat ini diisi manual. Tenggat berbasis peraturan belum aktif sampai aturannya diverifikasi Notaris.");
}

export async function repertorium(c: Ctx, appointment: "notaris" | "ppat", year?: number) {
  const y = String(year ?? jakartaToday().year);
  c.run.step(`Membaca repertorium ${APPOINTMENT_LABEL[appointment]} ${y}`);
  const list = rows<{ id: string; entry_no: number; akta_number: number; period: string; akta_date: string; title: string; parties_summary: string }>(
    await c.db.select("repertorium_entries", "id, entry_no, akta_number, period, akta_date, title, parties_summary").eq("appointment", appointment).eq("period", y).is("corrects_entry_id", null).order("entry_no"));
  if (list.length === 0) return void c.run.say(`Belum ada entri repertorium ${APPOINTMENT_LABEL[appointment]} tahun ${y} yang dapat Anda lihat.`);
  c.run.table(["No.", "Tanggal", "Judul", "Penghadap"], list.slice(0, 20).map((r) => ({
    cells: [`${formatAktaNumber(r.akta_number, r.period)} ${c.run.cite({ kind: "repertorium", id: r.id, label: `Repertorium ${formatAktaNumber(r.akta_number, r.period)}`, href: `/register/repertorium?pejabat=${appointment}&tahun=${y}` })}`, formatDate(r.akta_date), r.title, r.parties_summary],
  })));
  c.run.navigate(`/register/repertorium?pejabat=${appointment}&tahun=${y}`, `Buka repertorium ${APPOINTMENT_LABEL[appointment]} ${y}`);
}

export async function search(c: Ctx, query: string) {
  const q = esc(query);
  if (q.length < 2) return void c.run.say("Sebutkan nama yang ingin dicari.");
  c.run.step(`Mencari "${q}" di data pihak, klapper, dan berkas`);
  const [people, companies, klapper, berkas] = await Promise.all([
    c.db.select("persons", "id, full_name, nik").ilike("full_name", `%${q}%`).limit(8),
    c.db.select("companies", "id, name, legal_form, nib").ilike("name", `%${q}%`).limit(8),
    c.db.select("klapper_entries", "id, indexed_name, akta_id, akta_number, period, akta_date, party_role").ilike("indexed_name", `%${q}%`).order("akta_date", { ascending: false }).limit(10),
    c.db.select("berkas", "id, title, type").ilike("title", `%${q}%`).limit(8),
  ]);
  const P = rows<{ id: string; full_name: string; nik: string | null }>(people);
  const C = rows<{ id: string; name: string; legal_form: string; nib: string | null }>(companies);
  const K = rows<{ id: string; indexed_name: string; akta_id: string | null; akta_number: number; period: string; akta_date: string; party_role: PartyRole }>(klapper);
  const B = rows<{ id: string; title: string; type: string }>(berkas);
  if (!P.length && !C.length && !K.length && !B.length) return void c.run.say(`Tidak ada data yang cocok dengan "${q}" yang dapat Anda lihat.`);
  if (K.length) {
    c.run.say(`Di buku klapper, "${q}" tercatat pada:`);
    c.run.table(["Nama", "Akta", "Kedudukan", "Tanggal"], K.map((k) => ({
      cells: [k.indexed_name, `${formatAktaNumber(k.akta_number, k.period)} ${c.run.cite({ kind: "klapper", id: k.id, label: `Klapper: ${k.indexed_name}`, href: `/register/klapper?nama=${encodeURIComponent(k.indexed_name)}` })}`, PARTY_ROLE_LABEL[k.party_role], formatDate(k.akta_date)],
    })));
  }
  if (P.length || C.length) {
    c.run.say(`Data pihak: ${[...P.map((p) => `${p.full_name}${p.nik ? ` (NIK ${p.nik})` : ""} ${c.run.cite({ kind: "person", id: p.id, label: p.full_name, href: `/register/klapper?q=${encodeURIComponent(p.full_name)}` })}`), ...C.map((x) => `${x.legal_form} ${x.name} ${c.run.cite({ kind: "company", id: x.id, label: `${x.legal_form} ${x.name}`, href: `/register/klapper?q=${encodeURIComponent(x.name)}` })}`)].join("; ")}.`);
  }
  if (B.length) c.run.say(`Berkas: ${B.map((b) => `${b.title} ${c.run.cite({ kind: "berkas", id: b.id, label: b.title, href: `/berkas/${b.id}` })}`).join("; ")}.`);
}

export async function legal(c: Ctx, query: string) {
  const q = esc(query);
  c.run.step(q ? `Mencari dasar hukum "${q}"` : "Membaca pustaka dasar hukum");
  let sel = c.db.select("legal_references", "id, category, number_label, title, year, status, verified_by").order("year", { ascending: false }).limit(10);
  if (q) sel = sel.or(`title.ilike.%${q}%,number_label.ilike.%${q}%`);
  const list = rows<{ id: string; category: LegalCategory; number_label: string; title: string; year: number | null; status: string; verified_by: string | null }>(await sel);
  if (list.length === 0) return void c.run.say(`Tidak ada referensi dasar hukum yang cocok dengan "${q}". Referensi baru bisa ditambahkan di halaman Dasar hukum.`);
  c.run.table(["Peraturan", "Kategori", "Status", "Verifikasi"], list.map((r) => ({
    cells: [`${r.number_label}: ${r.title} ${c.run.cite({ kind: "legal", id: r.id, label: r.number_label, href: `/dasar-hukum/${r.id}` })}`, LEGAL_CATEGORY_LABEL[r.category], r.status === "berlaku" ? "Berlaku" : r.status === "diubah" ? "Telah diubah" : "Dicabut", r.verified_by ? "Terverifikasi" : "Belum terverifikasi"],
    tone: r.verified_by ? "ok" : "warn",
  })));
  if (list.some((r) => !r.verified_by)) c.run.say("Referensi yang belum terverifikasi belum diperiksa Notaris; jangan diandalkan sebelum diverifikasi.");
}

export async function documents(c: Ctx, query: string) {
  const q = esc(query.replace(/^(dokumen|file)\s+/, ""));
  c.run.step(`Mencari dokumen "${q}"`);
  let sel = c.db.select("documents", "id, title, file_name, doc_type, berkas_id, akta_id").or(`title.ilike.%${q}%,file_name.ilike.%${q}%`).order("uploaded_at", { ascending: false }).limit(10);
  if (c.context.kind !== "kantor") sel = sel.eq("berkas_id", c.context.berkasId);
  const list = rows<DocRow>(await sel);
  if (list.length === 0) return void c.run.say(`Tidak ada dokumen yang cocok dengan "${q}" yang dapat Anda lihat.`);
  c.run.table(["Dokumen", "Jenis"], list.map((d) => ({ cells: [`${d.title} ${citeDoc(c, d)}`, DOCUMENT_TYPE_LABEL[d.doc_type]] })));
}

const PAGES: [RegExp, string, string][] = [
  [/^beranda|dashboard/, "/beranda", "Beranda"],
  [/^(daftar )?berkas$/, "/berkas", "Berkas"],
  [/^(daftar |manajemen )?akta$/, "/akta", "Akta"],
  [/^jadwal|agenda/, "/jadwal", "Jadwal"],
  [/^(minuta|dokumen)/, "/dokumen", "Minuta & dokumen"],
  [/^repertorium/, "/register/repertorium", "Repertorium"],
  [/^(buku )?klapper/, "/register/klapper", "Buku klapper"],
  [/^protokol/, "/protokol", "Protokol notaris"],
  [/^dasar hukum|peraturan/, "/dasar-hukum", "Dasar hukum"],
  [/^keamanan/, "/keamanan", "Keamanan"],
  [/^audit/, "/admin/audit", "Audit log"],
  [/^pengguna/, "/admin/pengguna", "Pengguna"],
];

export async function navigate(c: Ctx, target: string) {
  const t = target.replace(/^halaman\s+/, "").trim();
  const page = PAGES.find(([re]) => re.test(t));
  if (page) {
    c.run.say(`Membuka ${page[2]}.`);
    return void c.run.navigate(page[1], page[2]);
  }
  const q = esc(t.replace(/^(berkas|akta)\s+/, ""));
  c.run.step(`Mencari "${q}"`);
  const [berkas, akta] = await Promise.all([
    c.db.select("berkas", "id, title").ilike("title", `%${q}%`).limit(3),
    c.db.select("akta", "id, title, number, number_period").ilike("title", `%${q}%`).limit(3),
  ]);
  const B = rows<{ id: string; title: string }>(berkas);
  const A = rows<{ id: string; title: string; number: number | null; number_period: string | null }>(akta);
  if (!B.length && !A.length) return void c.run.say(`Saya tidak menemukan berkas atau akta "${q}".`);
  for (const b of B) c.run.navigate(`/berkas/${b.id}`, `Berkas: ${b.title}`);
  for (const a of A) c.run.navigate(`/akta/${a.id}`, `Akta: ${aktaLabel({ ...a, title: a.title })}`);
  c.run.say(B.length + A.length === 1 ? "Ini yang saya temukan:" : "Beberapa yang cocok:");
}

export function help(c: Ctx) {
  const common = ["akta menunggu TTD", "jadwal besok", "tenggat minggu ini", "cari Laras di klapper", "dasar hukum fidusia"];
  const scoped = c.context.kind === "akta"
    ? ["apa yang kurang sebelum difinalkan?", "siapa saja penghadapnya?", "jadwalkan penandatanganan besok 14.00"]
    : c.context.kind === "berkas"
      ? ["cek kelengkapan dokumen pendiri", "ringkasan berkas", "tambahkan checklist minta NPWP Laras, tenggat Senin"]
      : [];
  c.run.say("Saya agen baca-saja dalam mode uji: saya menjawab dari data kantor yang boleh Anda lihat, memberi sumber untuk setiap fakta, dan menyiapkan usulan perubahan yang baru berlaku setelah disetujui orang yang berwenang. Saya tidak dapat memfinalkan, memberi nomor, atau menandatangani akta.");
  c.run.suggest([...scoped, ...common].slice(0, 6));
}

export function fallback(c: Ctx) {
  c.run.say("Maaf, pertanyaan itu belum bisa saya jawab dalam mode uji. Saya tidak mengarang jawaban; coba salah satu pertanyaan berikut.");
  help(c);
}

export async function runIntent(c: Ctx, intent: Intent) {
  switch (intent.name) {
    case "help": return help(c);
    case "navigate": return navigate(c, intent.target);
    case "propose_checklist": return proposeChecklist(c, intent.text);
    case "propose_schedule": return proposeSchedule(c, intent.text);
    case "propose_akta_step": return proposeAktaStep(c);
    case "kelengkapan": return kelengkapan(c);
    case "readiness": return readiness(c);
    case "parties": return parties(c);
    case "summary": return summary(c);
    case "akta_by_status": return aktaByStatus(c, intent.status);
    case "akta_final_period": return aktaFinalPeriod(c, intent.period);
    case "schedules": return schedules(c, intent.range);
    case "deadlines": return deadlines(c);
    case "repertorium": return repertorium(c, intent.appointment, intent.year);
    case "search": return search(c, intent.query);
    case "legal": return legal(c, intent.query);
    case "documents": return documents(c, intent.query);
    default: return fallback(c);
  }
}
