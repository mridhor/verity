import "server-only";
import { berkasType } from "@/lib/berkas-types";
import { addDays, parseDate } from "./dates";
import { parseScheduleText, subjectWords, type ScheduleArgs } from "./schedule-args";
import { jakartaInstant, jakartaToday, formatTime, formatLongDate, jakartaDateOf } from "@/lib/jakarta-time";
import {
  AKTA_STATUS_LABEL, APPOINTMENT_LABEL, DOCUMENT_TYPE_LABEL, LEGAL_CATEGORY_LABEL, PARTY_ROLE_LABEL, SCHEDULE_KIND_LABEL,
  formatAktaNumber, type AktaStatus, type DocumentType, type LegalCategory, type PartyRole, type ScheduleKind,
} from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { ReadonlyDb } from "../readonly-db";
import type { AgentAction, AgentContext, AgentRunInput } from "../types";
import type { Intent } from "./intents";
import type { RunBuilder } from "./run";

export type Ctx = { db: ReadonlyDb; run: RunBuilder; input: AgentRunInput; context: AgentContext };

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

export async function summary(c: Ctx, text = "") {
  const id = await targetBerkas(c, text, "summary");
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
export async function kelengkapan(c: Ctx, text = "") {
  const id = await targetBerkas(c, text, "kelengkapan");
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

  const todos: { title: string; dueDate: string; reason: string }[] = [];
  const findings: string[] = [];
  // Due the day before the next signing, if one is booked; otherwise in four days.
  const today = jakartaToday().date;
  const signing = rows<{ starts_at: string }>(await c.db.select("schedules", "starts_at").eq("berkas_id", id).eq("kind", "penandatanganan")
    .gte("starts_at", new Date().toISOString()).order("starts_at").limit(1))[0];
  const beforeSigning = signing ? addDays(jakartaDateOf(signing.starts_at), -1) : null;
  const due = beforeSigning && beforeSigning > today ? beforeSigning : addDays(today, 4);
  const addTodo = (title: string, reason: string) => {
    if (!openChecklist.some((o) => o.title.toLowerCase() === title.toLowerCase()) && !todos.some((t) => t.title === title)) {
      todos.push({ title, dueDate: due, reason });
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
    if (!person.nik) { notes.push("NIK belum diisi"); findings.push(`NIK ${name} belum tercatat ${citeParty(c, p, "nik")}.`); addTodo(`Lengkapi NIK ${name}`, "NIK belum tercatat"); }
    if (!person.address) { notes.push("alamat belum diisi"); findings.push(`Alamat ${name} belum tercatat ${citeParty(c, p, "address")}.`); }
    if (!ktp) { notes.push("KTP belum diunggah"); findings.push(`Pindaian KTP ${name} belum ada di berkas ${citeParty(c, p)}. Ini perlu sebelum penandatanganan.`); addTodo(`Minta KTP ${name}`, "KTP belum diunggah"); }
    if (!npwp) { notes.push("NPWP belum ada"); findings.push(`NPWP ${name} belum ada di berkas ${citeParty(c, p)}. Tidak menghalangi penandatanganan, tetapi dibutuhkan untuk pendaftaran NIB di OSS.`); addTodo(`Minta NPWP ${name}`, "NPWP belum ada"); }
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
    addTodo("Minta salinan sertifikat tanah", "Sertifikat belum diunggah");
  }
  if (todos.length && berkas) {
    c.run.say(`Pilih kekurangan yang ingin dijadikan usulan checklist${signing ? " (tenggat sehari sebelum penandatanganan)" : ""}:`);
    c.run.widget({ kind: "checklist_batch", berkas: { id, title: berkas.title }, items: todos });
  }
  c.run.suggest(["apa yang kurang sebelum difinalkan?", "ringkasan berkas"]);
}

/** Akta readiness; proposes the next workflow step. Never finalizes (rule 2). */
export async function readiness(c: Ctx, text = "") {
  const id = await targetBerkas(c, text, "readiness");
  if (!id) return;
  c.run.step("Membaca akta, pihak, dan dokumen");
  const { akta, docs, parties } = await loadBerkas(c, id);
  const targets = c.context.kind === "akta" ? akta.filter((a) => a.id === (c.context as { aktaId: string }).aktaId) : akta.filter((a) => a.status !== "selesai" && a.status !== "diarsipkan");
  if (targets.length === 0) return void c.run.say(akta.length ? "Semua akta di berkas ini sudah final." : "Belum ada akta di berkas ini.");
  c.run.step("Memeriksa syarat setiap langkah");
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
    // Verifying and approving an akta stay manual on the akta page (ADR 0006): no proposals here.
    if (a.status === "draft") {
      c.run.say(blockers ? "Lengkapi pihak dan NIK dulu, lalu draft bisa diajukan untuk verifikasi."
        : "Data draft tampak lengkap. Pengajuan verifikasi dilakukan sendiri dari halaman akta setelah Anda memeriksanya.");
    } else if (a.status === "verifikasi") {
      c.run.say(blockers ? "Masih ada kekurangan sebelum akta bisa disetujui untuk penandatanganan."
        : "Data tampak lengkap. Persetujuan untuk penandatanganan diberikan Notaris langsung di halaman akta setelah memeriksanya.");
    } else if (a.status === "menunggu_ttd") {
      c.run.say("Akta menunggu tanda tangan. Setelah ditandatangani, Notaris memfinalkan dan memberi nomor dari halaman akta. Saya tidak dapat memfinalkan, memberi nomor, atau menandatangani akta.");
    }
    if (a.status !== "menunggu_ttd") c.run.navigate(`/akta/${a.id}`, `Buka ${aktaLabel(a)}`);
  }
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
  if (title.length < 3) {
    const berkas = await readBerkas(c, id);
    if (!berkas) return void c.run.say("Berkas ini tidak dapat saya baca.");
    c.run.say("Isi item checklist yang ingin ditambahkan:");
    return void c.run.widget({ kind: "checklist_form", berkas, defaults: due ? { dueDate: due } : {} });
  }
  return checklistSkill(c, id, [{ title: title.charAt(0).toUpperCase() + title.slice(1), ...(due ? { dueDate: due } : {}) }]);
}

/** A checklist request in structured form (a model's tool call); asks with a form when the item is missing. */
export async function checklistRequest(c: Ctx, args: { berkas?: string; title?: string; dueDate?: string }) {
  let berkas: BerkasRef | null = null;
  if (c.context.kind !== "kantor") berkas = await readBerkas(c, c.context.berkasId);
  else if (args.berkas) {
    const { list } = await findBerkas(c, args.berkas);
    if (list.length > 1) return void c.run.say(`Ada ${list.length} berkas yang cocok dengan "${args.berkas}": ${list.slice(0, 5).map((b) => b.title).join("; ")}. Sebutkan lebih lengkap.`);
    berkas = list[0] ?? null;
  }
  if (!berkas) return void requireBerkas(c);
  const title = args.title?.trim();
  if (!title || title.length < 3) {
    c.run.say("Isi item checklist yang ingin ditambahkan:");
    return void c.run.widget({ kind: "checklist_form", berkas, defaults: args.dueDate ? { dueDate: args.dueDate } : {} });
  }
  return checklistSkill(c, berkas.id, [{ title: title.charAt(0).toUpperCase() + title.slice(1), ...(args.dueDate ? { dueDate: args.dueDate } : {}) }]);
}

/** Proposes checklist items (staff tier); nothing is added until someone approves. */
export async function checklistSkill(c: Ctx, berkasId: string, items: { title: string; dueDate?: string }[]) {
  c.run.step("Menyiapkan usulan checklist");
  c.run.say(items.length === 1
    ? `Saya siapkan usulan item checklist "${items[0]!.title}"${items[0]!.dueDate ? ` dengan tenggat ${formatDate(items[0]!.dueDate)}` : ""}. Item baru ditambahkan setelah disetujui.`
    : `Saya siapkan usulan ${items.length} item checklist. Item baru ditambahkan setelah disetujui.`);
  await proposeItems(c, berkasId, items.map((i) => ({
    op: "checklist.add", label: `Tambah ke checklist: ${i.title}${i.dueDate ? `, tenggat ${formatDate(i.dueDate)}` : ""}`,
    params: { title: i.title, ...(i.dueDate ? { due_date: i.dueDate } : {}) },
  })), "checklist");
}

type BerkasRef = { id: string; title: string };

async function readBerkas(c: Ctx, id: string) {
  const { data } = await c.db.select("berkas", "id, title").eq("id", id).maybeSingle();
  return (data as BerkasRef | null) ?? null;
}

/** Active berkas whose title holds every meaningful word of the request (RLS decides what is visible). */
async function findBerkas(c: Ctx, query: string) {
  const words = subjectWords(query.toLowerCase());
  if (!words.length) return { words, list: [] as BerkasRef[] };
  let q = c.db.select("berkas", "id, title").eq("status", "aktif");
  for (const w of words) q = q.ilike("title", `%${w}%`);
  return { words, list: rows<BerkasRef>(await q.order("updated_at", { ascending: false }).limit(20)) };
}

async function activeBerkas(c: Ctx) {
  return rows<BerkasRef>(await c.db.select("berkas", "id, title").eq("status", "aktif").order("updated_at", { ascending: false }).limit(20));
}

/**
 * The berkas a question is about. Inside a berkas that is the berkas; from the office view it is
 * found by the words of the request. Several matches: the user picks (widget), and the request
 * continues as `then`.
 */
async function targetBerkas(c: Ctx, text: string, then: "summary" | "kelengkapan" | "readiness"): Promise<string | null> {
  if (c.context.kind !== "kantor") return c.context.berkasId;
  const subject = text.toLowerCase().match(/\bberkas\s+(.+)$/)?.[1] ?? "";
  c.run.step("Mencari berkasnya");
  const { list } = await findBerkas(c, subject);
  if (list.length === 1) return list[0]!.id;
  if (list.length > 1) {
    c.run.say(`Ada ${list.length} berkas aktif yang cocok. Pilih salah satu:`);
    c.run.widget({ kind: "berkas_picker", options: list, then, text });
    return null;
  }
  return requireBerkas(c);
}

/** Runs a berkas skill as if it were asked from inside that berkas. */
function inBerkas(c: Ctx, berkas: BerkasRef): Ctx {
  return { ...c, context: { kind: "berkas", label: berkas.title, berkasId: berkas.id } };
}

export async function proposeSchedule(c: Ctx, text: string) {
  return scheduleSkill(c, parseScheduleText(text));
}

/**
 * A schedule proposal. What is missing (berkas, date or time) is asked for with a form instead of
 * guessed; the form answer comes back through `runAction`.
 */
export async function scheduleSkill(c: Ctx, args: ScheduleArgs) {
  let berkas: BerkasRef | null = null;
  let options: BerkasRef[] = [];
  if (args.berkasId) berkas = await readBerkas(c, args.berkasId);
  else if (c.context.kind !== "kantor") berkas = await readBerkas(c, c.context.berkasId);
  else {
    c.run.step("Mencari berkasnya");
    const found = args.berkasQuery ? (await findBerkas(c, args.berkasQuery)).list : [];
    if (found.length === 1) berkas = found[0]!;
    else options = found.length ? found : await activeBerkas(c);
  }
  if (!berkas && !options.length) return void c.run.say("Tidak ada berkas aktif yang dapat Anda lihat untuk dijadwalkan.");

  const own = subjectWords((args.title ?? "").toLowerCase()).length > 0 && c.context.kind !== "kantor";
  const title = berkas ? (own ? args.title! : `${SCHEDULE_KIND_LABEL[args.kind]} ${berkas.title}`) : undefined;
  // A date in the past is never proposed; the form asks again.
  if (args.date && args.date < jakartaToday().date) args = { ...args, date: undefined };
  if (!berkas || !args.date || !args.time) {
    const missing = [!berkas && "berkasnya", !args.date && "tanggal", !args.time && "jam"].filter(Boolean).join(", ").replace(/, ([^,]*)$/, " dan $1");
    c.run.say(`Lengkapi ${missing} untuk jadwal ${SCHEDULE_KIND_LABEL[args.kind].toLowerCase()} ini:`);
    c.run.widget({
      kind: "schedule_form",
      ...(berkas ? { berkas } : { berkasOptions: options }),
      defaults: {
        kind: args.kind,
        ...(args.date ? { date: args.date } : {}), ...(args.time ? { time: args.time } : {}),
        ...(args.location ? { location: args.location } : {}), ...(title ? { title } : {}),
      },
    });
    return;
  }

  const time = args.time.replace(":", ".");
  const when = `${formatLongDate(args.date)} pukul ${time} WIB${args.location ? ` di ${args.location}` : ""}`;
  const cite = c.run.cite({ kind: "berkas", id: berkas.id, label: berkas.title, href: `/berkas/${berkas.id}` });
  c.run.step("Menyiapkan usulan jadwal");
  c.run.say(`Saya siapkan usulan jadwal ${SCHEDULE_KIND_LABEL[args.kind].toLowerCase()} untuk berkas ${berkas.title} ${cite} pada ${when}.`);
  const ids = await proposeItems(c, berkas.id, [{
    op: "schedule.add", label: `Jadwalkan: ${title}, ${formatLongDate(args.date)} ${time} WIB${args.location ? `, ${args.location}` : ""}`,
    params: { title, kind: args.kind, starts_at: jakartaInstant(args.date, args.time), ...(args.location ? { location: args.location } : {}) },
  }], "schedule");
  if (ids.length && args.kind === "penandatanganan") {
    c.run.say("Setelah disetujui, saya langsung memeriksa kesiapan berkas di latar belakang, lalu memeriksa lagi H-3 dan H-1. "
      + "Hasilnya saya tulis di Percakapan berkas dan saya kabarkan ke tim beserta usulan checklist bila ada yang kurang. "
      + "Verifikasi dan persetujuan akta tetap dilakukan Notaris di halaman akta.");
  }
}

/** The answer to a widget. Deterministic: the values are the user's own, never a model's. */
export async function runAction(c: Ctx, action: AgentAction) {
  const berkas = await readBerkas(c, action.berkasId);
  if (!berkas) return void c.run.say("Berkas itu tidak dapat saya baca.");
  switch (action.kind) {
    case "schedule_form":
      return scheduleSkill(c, { berkasId: berkas.id, date: action.date, time: action.time, kind: action.scheduleKind, title: action.title.trim(), ...(action.location?.trim() ? { location: action.location.trim() } : {}) });
    case "checklist_form":
      return checklistSkill(c, berkas.id, [{ title: action.title.trim(), ...(action.dueDate ? { dueDate: action.dueDate } : {}) }]);
    case "checklist_batch":
      return checklistSkill(c, berkas.id, action.items.map((i) => ({ title: i.title.trim(), ...(i.dueDate ? { dueDate: i.dueDate } : {}) })));
    case "berkas_picker": {
      const cb = inBerkas(c, berkas);
      if (action.then === "schedule") return scheduleSkill(cb, { ...parseScheduleText(action.text), berkasId: berkas.id });
      if (action.then === "summary") return summary(cb);
      if (action.then === "kelengkapan") return kelengkapan(cb);
      return readiness(cb);
    }
  }
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
    case "kelengkapan": return kelengkapan(c, intent.text);
    case "readiness": return readiness(c, intent.text);
    case "parties": return parties(c);
    case "summary": return summary(c, intent.text);
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
