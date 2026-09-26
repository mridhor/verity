import { matchIntent, type Intent } from "../scenario/intents";
import { parseDate } from "../scenario/dates";
import { parseScheduleText } from "../scenario/schedule-args";
import { systemPrompt } from "../openrouter/system-prompt";
import { toolDefinitions } from "../openrouter/tool-specs";
import type { AgentContext } from "../types";

/**
 * Synthetic fine-tuning examples (ADR 0007): which tool, with which arguments, for a request in
 * Bahasa Indonesia. Built from the scenario agent's own parser so the two never disagree. All
 * names are fictional (seed data). No database content is involved.
 */
export const DATASET_NOW = new Date("2026-09-25T03:00:00Z"); // Friday 10:00 WIB

const kantor: AgentContext = { kind: "kantor", label: "Seluruh kantor", page: "beranda" };
const berkas: AgentContext = { kind: "berkas", label: "Pendirian PT Arunika Kopi Nusantara", berkasId: "00000000-0000-4000-8000-000000000001" };
const akta: AgentContext = { kind: "akta", label: "Akta Pendirian PT Arunika Kopi Nusantara", berkasId: berkas.berkasId, aktaId: "00000000-0000-4000-8000-000000000002" };

const NAMES = ["Laras Anggraini", "Rahmat Hidayat", "Nadia Halim", "Paulus Suryadi", "Dewi Kartika", "Hans Mueller", "Sari Wulandari", "Budi Santoso"];
const BERKAS = ["Arunika Kopi", "Kebagusan", "Setiabudi", "Sinar Pangan", "Koperasi Nelayan", "Rumah Batik Laweyan", "Samudra Logistik", "Cahaya Pelita"];
const WHEN = ["besok 10.00", "lusa jam 14", "Senin 09.30", "tanggal 12 Oktober pukul 13.00", "Jumat depan 15.00", "2026-10-20 11:00", "3/11 10.00"];
const ROOMS = ["", " di Ruang Utama", " di Ruang Meeting 1"];
const TOPICS = ["fidusia", "jabatan notaris", "hak tanggungan", "perseroan terbatas", "UU 2/2014", "yayasan", "BPHTB"];

type Example = { context: AgentContext; text: string };

function prompts(): Example[] {
  const out: Example[] = [];
  const add = (context: AgentContext, ...texts: string[]) => texts.forEach((text) => out.push({ context, text }));
  NAMES.forEach((n, i) => {
    add(kantor, `cari ${n}`, `cari ${n.split(" ")[0]} di klapper`);
    add(berkas, `tambahkan checklist minta NPWP ${n}${i % 2 ? ", tenggat " + ["Senin", "Rabu", "30 September", "besok"][i % 4] : ""}`);
  });
  BERKAS.forEach((b, i) => {
    add(kantor, `jadwalkan penandatanganan ${b} ${WHEN[i % WHEN.length]}${ROOMS[i % ROOMS.length]}`);
    add(kantor, `jadwalkan penandatanganan ${b}`, `tolong jadwalkan TTD ${b} ${WHEN[(i + 3) % WHEN.length]}`);
    add(kantor, `cek kelengkapan berkas ${b}`, `ringkasan berkas ${b}`, `buka berkas ${b}`);
  });
  WHEN.forEach((w, i) => add(i % 2 ? berkas : akta, `jadwalkan penandatanganan ${w}${ROOMS[i % ROOMS.length]}`, `jadwalkan pertemuan klien ${w}`));
  TOPICS.forEach((t) => add(kantor, `dasar hukum ${t}`, `peraturan tentang ${t}`));
  add(kantor,
    "akta menunggu TTD", "akta mana yang masih verifikasi?", "daftar akta draft", "akta yang sudah diarsipkan", "akta final bulan ini", "akta selesai tahun ini",
    "jadwal hari ini", "jadwal besok", "agenda minggu ini", "tenggat minggu ini", "checklist yang terlambat",
    "repertorium PPAT 2026", "repertorium notaris 2025", "repertorium tahun ini",
    "buka jadwal", "ke halaman dasar hukum", "buka repertorium", "tambah jadwal");
  add(berkas,
    "cek kelengkapan dokumen kedua pendiri", "apa saja yang kurang?", "ringkasan berkas", "bagaimana progres berkas ini", "siapa saja pihaknya",
    "apa yang kurang sebelum bisa difinalkan?", "tambahkan checklist", "jadwalkan penandatanganan", "tenggat berkas ini", "jadwal minggu ini", "dokumen ktp laras");
  add(akta, "siapa saja penghadapnya", "apa yang kurang sebelum difinalkan?", "ajukan verifikasi", "setujui untuk tanda tangan", "cek kelengkapan data pihak");
  return out;
}

/** Requests the agent must not act on, and what it says instead (rules 2 and 8, ADR 0006). */
const REFUSALS: { context: AgentContext; text: string; answer: string }[] = [
  { context: akta, text: "finalkan akta ini sekarang", answer: "Saya tidak dapat memfinalkan akta. Finalisasi dan penomoran dilakukan Notaris sendiri di halaman akta setelah akta ditandatangani." },
  { context: akta, text: "beri nomor akta ini", answer: "Saya tidak dapat memberi nomor akta. Nomor diberikan saat Notaris memfinalkan akta di halaman akta." },
  { context: akta, text: "tandatangani akta ini atas nama notaris", answer: "Saya tidak dapat menandatangani akta. Penandatanganan dilakukan secara langsung oleh para pihak dan Notaris." },
  { context: berkas, text: "ubah NIK Laras jadi 3171010101010001", answer: "Saya tidak mengubah data pihak. Perbaikan NIK dilakukan staf di halaman akta; bila perlu, saya bisa menyiapkan usulan checklist untuk memeriksanya." },
  { context: kantor, text: "berapa saksi minimal untuk akta hibah?", answer: "Saya tidak menjawab syarat hukum dari ingatan. Aturannya belum terverifikasi di Verity; silakan rujuk pustaka Dasar hukum atau tanyakan kepada Notaris." },
  { context: kantor, text: "bagaimana cuaca hari ini", answer: "Maaf, saya hanya membantu pekerjaan kantor di Verity: berkas, akta, jadwal, register, dokumen, dan dasar hukum." },
];

type ToolCall = { name: string; arguments: Record<string, unknown> };

/** The tool call the agent should make for a request, or null when it answers without one. */
export function toolCallFor(intent: Intent, text: string, context: AgentContext): ToolCall | null {
  const t = text.toLowerCase();
  // The parser works on lower case; arguments keep the user's own spelling.
  const orig = (s: string) => { const i = t.indexOf(s); return i >= 0 ? text.slice(i, i + s.length) : s; };
  const m = t.match(/\bberkas\s+(.+)$/)?.[1];
  const berkasArg = context.kind === "kantor" && m ? orig(m) : undefined;
  const withBerkas = (a: Record<string, unknown> = {}) => ({ ...a, ...(berkasArg ? { berkas: berkasArg } : {}) });
  switch (intent.name) {
    case "navigate": return { name: "buka_halaman", arguments: { tujuan: orig(intent.target) } };
    case "propose_checklist": {
      const due = parseDate(intent.text, DATASET_NOW);
      const title = intent.text.replace(/[,;]?\s*(tenggat|batas|deadline|paling lambat|sebelum)\b.*$/i, "").trim();
      const judul = orig(title);
      return { name: "usul_checklist", arguments: { ...(title.length >= 3 ? { judul: judul.charAt(0).toUpperCase() + judul.slice(1) } : {}), ...(due ? { tenggat: due } : {}) } };
    }
    case "propose_schedule": {
      const a = parseScheduleText(intent.text, DATASET_NOW);
      return { name: "usul_jadwal", arguments: {
        jenis: a.kind, ...(context.kind === "kantor" && a.berkasQuery ? { berkas: orig(a.berkasQuery) } : {}),
        ...(a.date ? { tanggal: a.date } : {}), ...(a.time ? { jam: a.time } : {}), ...(a.location ? { tempat: a.location } : {}),
      } };
    }
    case "propose_akta_step":
    case "readiness": return { name: "kesiapan_akta", arguments: withBerkas() };
    case "kelengkapan": return { name: "cek_kelengkapan", arguments: withBerkas() };
    case "summary": return { name: "ringkasan_berkas", arguments: withBerkas() };
    case "parties": return { name: "pihak_akta", arguments: {} };
    case "akta_by_status": return { name: "akta_per_status", arguments: { status: intent.status } };
    case "akta_final_period": return { name: "akta_final", arguments: { periode: intent.period } };
    case "schedules": return { name: "jadwal", arguments: { rentang: intent.range } };
    case "deadlines": return { name: "tenggat", arguments: {} };
    case "repertorium": return { name: "repertorium", arguments: { pejabat: intent.appointment, ...(intent.year ? { tahun: intent.year } : {}) } };
    case "search": return { name: "cari", arguments: { nama: orig(intent.query) } };
    case "legal": return { name: "dasar_hukum", arguments: { topik: orig(intent.query) } };
    case "documents": return { name: "dokumen", arguments: { kata_kunci: orig(intent.query.replace(/^(dokumen|file)\s+/, "")) } };
    default: return null;
  }
}

/** One JSON line per example, in the OpenAI chat fine-tuning format (with tools). */
export function buildDataset(): string {
  const tools = toolDefinitions();
  const lines: string[] = [];
  let n = 0;
  for (const p of prompts()) {
    const call = toolCallFor(matchIntent(p.text, p.context), p.text, p.context);
    if (!call) continue;
    n++;
    lines.push(JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt(p.context, DATASET_NOW) },
        { role: "user", content: p.text },
        { role: "assistant", content: null, tool_calls: [{ id: `call_${n}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } }] },
      ],
      tools,
    }));
  }
  for (const r of REFUSALS) {
    lines.push(JSON.stringify({
      messages: [{ role: "system", content: systemPrompt(r.context, DATASET_NOW) }, { role: "user", content: r.text }, { role: "assistant", content: r.answer }],
      tools,
    }));
  }
  return lines.join("\n") + "\n";
}
