import "server-only";
import type { ScheduleKind } from "@/lib/labels";
import {
  aktaByStatus, aktaFinalPeriod, checklistRequest, deadlines, documents, kelengkapan, legal, navigate, parties,
  readiness, repertorium, scheduleSkill, schedules, search, summary, type Ctx,
} from "../scenario/skills";

type Args = Record<string, unknown>;

const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const hhmm = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : undefined);
/** Skills that take a berkas from the office view read it from "berkas <name>". */
const berkasText = (a: Args) => (str(a.berkas) ? `berkas ${str(a.berkas)}` : "");

/**
 * Runs one tool call through the same skills as the scenario agent: reads under the user's RLS,
 * citations re-validated, and writes only as proposals. Arguments from the model are coerced;
 * anything unexpected falls back to a safe default or is dropped.
 */
export async function runTool(c: Ctx, name: string, a: Args): Promise<boolean> {
  switch (name) {
    case "ringkasan_berkas": await summary(c, berkasText(a)); return true;
    case "cek_kelengkapan": await kelengkapan(c, berkasText(a)); return true;
    case "kesiapan_akta": await readiness(c, berkasText(a)); return true;
    case "pihak_akta": await parties(c); return true;
    case "akta_per_status": await aktaByStatus(c, oneOf(a.status, ["draft", "verifikasi", "menunggu_ttd", "selesai", "diarsipkan"] as const, "menunggu_ttd")); return true;
    case "akta_final": await aktaFinalPeriod(c, oneOf(a.periode, ["bulan", "tahun"] as const, "bulan")); return true;
    case "jadwal": await schedules(c, oneOf(a.rentang, ["hari_ini", "besok", "minggu"] as const, "hari_ini")); return true;
    case "tenggat": await deadlines(c); return true;
    case "cari": await search(c, str(a.nama, 100) ?? ""); return true;
    case "repertorium": {
      const year = typeof a.tahun === "number" && a.tahun >= 1990 && a.tahun <= 2100 ? a.tahun : undefined;
      await repertorium(c, oneOf(a.pejabat, ["notaris", "ppat"] as const, "notaris"), year);
      return true;
    }
    case "dasar_hukum": await legal(c, str(a.topik, 100) ?? ""); return true;
    case "dokumen": await documents(c, str(a.kata_kunci, 100) ?? ""); return true;
    case "buka_halaman": await navigate(c, (str(a.tujuan, 100) ?? "beranda").toLowerCase()); return true;
    case "usul_checklist":
      await checklistRequest(c, { berkas: str(a.berkas), title: str(a.judul), dueDate: isoDate(a.tenggat) });
      return true;
    case "usul_jadwal": {
      const kind = oneOf<ScheduleKind>(a.jenis, ["penandatanganan", "pertemuan_klien", "internal"], "penandatanganan");
      await scheduleSkill(c, {
        kind,
        ...(str(a.berkas) ? { berkasQuery: str(a.berkas) } : {}),
        ...(isoDate(a.tanggal) ? { date: isoDate(a.tanggal) } : {}),
        ...(hhmm(a.jam) ? { time: hhmm(a.jam) } : {}),
        ...(str(a.tempat) ? { location: str(a.tempat) } : {}),
        ...(str(a.judul) ? { title: str(a.judul) } : {}),
      });
      return true;
    }
    default: return false;
  }
}
