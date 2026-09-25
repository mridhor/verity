import type { AgentContext } from "../types";

export type Intent =
  | { name: "help" }
  | { name: "navigate"; target: string }
  | { name: "propose_checklist"; text: string }
  | { name: "propose_schedule"; text: string }
  | { name: "propose_akta_step" }
  | { name: "kelengkapan" }
  | { name: "readiness" }
  | { name: "parties" }
  | { name: "summary" }
  | { name: "akta_by_status"; status: "draft" | "verifikasi" | "menunggu_ttd" | "selesai" | "diarsipkan" }
  | { name: "akta_final_period"; period: "bulan" | "tahun" }
  | { name: "schedules"; range: "hari_ini" | "besok" | "minggu" }
  | { name: "deadlines" }
  | { name: "repertorium"; appointment: "notaris" | "ppat"; year?: number }
  | { name: "search"; query: string }
  | { name: "legal"; query: string }
  | { name: "documents"; query: string }
  | { name: "fallback" };

const norm = (s: string) => s.toLowerCase().replace(/[“”"'`]/g, "").replace(/\s+/g, " ").trim();

/** Deterministic intent matcher for the scenario agent (Bahasa Indonesia). Order matters. */
export function matchIntent(raw: string, ctx: AgentContext): Intent {
  const t = norm(raw);
  if (!t || /^(bantuan|help|bisa apa|apa yang bisa|contoh pertanyaan)/.test(t)) return { name: "help" };

  let m = t.match(/^(?:buka|pergi ke|ke halaman|ke|tampilkan halaman)\s+(.+)$/);
  if (m) return { name: "navigate", target: m[1]! };

  m = t.match(/(?:tambah(?:kan)?|buat(?:kan)?|catat(?:kan)?)\s+(?:item\s+)?checklist\s*:?\s*(.+)$/);
  if (m) return { name: "propose_checklist", text: m[1]! };

  if (/^(jadwalkan|buat(?:kan)? jadwal|tambah(?:kan)? jadwal|atur jadwal)\b/.test(t)) {
    return { name: "propose_schedule", text: t.replace(/^(jadwalkan|buat(?:kan)? jadwal|tambah(?:kan)? jadwal|atur jadwal)\s*/, "") };
  }

  if (/(ajukan|setujui|naikkan|lanjutkan).*(verifikasi|tanda ?tangan|ttd|status)/.test(t)) return { name: "propose_akta_step" };

  if (/(cek|periksa|check).*(kelengkapan|konsistensi|dokumen|data)|dokumen.*(kurang|lengkap)|apa (saja )?yang kurang(?!.*final)/.test(t)
      && ctx.kind !== "kantor") return { name: "kelengkapan" };

  if (/(kurang|siap|syarat|bisa).*(final|difinalkan|tanda ?tangan|ttd)/.test(t)) return { name: "readiness" };

  if (/(siapa|daftar|sebutkan).*(penghadap|pihak|pendiri|para pihak)/.test(t)) return { name: "parties" };

  if (/repertorium/.test(t)) {
    const year = t.match(/\b(20\d{2})\b/);
    return { name: "repertorium", appointment: /ppat/.test(t) ? "ppat" : "notaris", year: year ? Number(year[1]) : undefined };
  }

  if (/akta.*(final|selesai).*(bulan ini)/.test(t)) return { name: "akta_final_period", period: "bulan" };
  if (/akta.*(final|selesai).*(tahun ini|\b20\d{2}\b)/.test(t)) return { name: "akta_final_period", period: "tahun" };
  if (/akta/.test(t)) {
    if (/(menunggu (ttd|tanda ?tangan)|belum (di)?tanda ?tangan)/.test(t)) return { name: "akta_by_status", status: "menunggu_ttd" };
    if (/verifikasi/.test(t)) return { name: "akta_by_status", status: "verifikasi" };
    if (/draft|draf/.test(t)) return { name: "akta_by_status", status: "draft" };
    if (/arsip/.test(t)) return { name: "akta_by_status", status: "diarsipkan" };
    if (/(final|selesai)/.test(t)) return { name: "akta_by_status", status: "selesai" };
  }

  if (/(jadwal|agenda|penandatanganan)/.test(t)) {
    return { name: "schedules", range: /besok/.test(t) ? "besok" : /(minggu|pekan|7 hari)/.test(t) ? "minggu" : "hari_ini" };
  }
  if (/(tenggat|deadline|jatuh tempo|terlambat)/.test(t)) return { name: "deadlines" };

  m = t.match(/(?:dasar hukum|peraturan|undang-undang|regulasi|uu|pp)\s*(?:tentang|soal|mengenai)?\s*(.*)$/);
  if (m && /(dasar hukum|peraturan|undang|regulasi|\buu\b|\bpp\b)/.test(t)) return { name: "legal", query: m[1]!.trim() };

  m = t.match(/(?:dokumen|file|minuta|ktp|npwp|sertifikat)\s+(.+)$/);
  if (m && /^(cari |tampilkan |mana |)(dokumen|file|minuta|ktp|npwp|sertifikat)/.test(t)) return { name: "documents", query: t.replace(/^(cari|tampilkan|mana)\s+/, "") };

  m = t.match(/^(?:cari|temukan|siapa|di mana)\s+(?:nama\s+)?(.+?)(?:\s+di\s+klapper)?$/);
  if (m) return { name: "search", query: m[1]!.replace(/\s+(di\s+)?(klapper|kantor)$/, "") };
  if (/klapper/.test(t)) return { name: "search", query: t.replace(/.*klapper\s*/, "") };

  if (/(ringkas|ringkasan|status|gambaran|bagaimana|progres|perkembangan)/.test(t) && ctx.kind !== "kantor") return { name: "summary" };

  return { name: "fallback" };
}
