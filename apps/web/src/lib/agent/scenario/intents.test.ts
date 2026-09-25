import { describe, expect, it } from "vitest";
import { matchIntent } from "./intents";

const berkas = { kind: "berkas", label: "Berkas", berkasId: "b" } as const;
const akta = { kind: "akta", label: "Akta", berkasId: "b", aktaId: "a" } as const;
const kantor = { kind: "kantor", label: "Kantor" } as const;

describe("matchIntent", () => {
  it.each([
    ["Cek kelengkapan dokumen kedua pendiri", berkas, "kelengkapan"],
    ["apa yang kurang sebelum bisa difinalkan?", akta, "readiness"],
    ["siapa saja penghadapnya", akta, "parties"],
    ["ringkasan berkas", berkas, "summary"],
    ["akta menunggu TTD", kantor, "akta_by_status"],
    ["akta final bulan ini", kantor, "akta_final_period"],
    ["jadwal besok", kantor, "schedules"],
    ["tenggat minggu ini", kantor, "deadlines"],
    ["cari Laras di klapper", kantor, "search"],
    ["repertorium PPAT 2026", kantor, "repertorium"],
    ["dasar hukum fidusia", kantor, "legal"],
    ["buka berkas Sinar Kopi", kantor, "navigate"],
    ["tambahkan checklist minta NPWP Laras, tenggat Senin", berkas, "propose_checklist"],
    ["jadwalkan penandatanganan besok 14.00", berkas, "propose_schedule"],
    ["ajukan verifikasi", akta, "propose_akta_step"],
    ["bisa apa?", kantor, "help"],
    ["bagaimana cuaca hari ini", kantor, "fallback"],
  ] as const)("%s → %s", (text, ctx, name) => expect(matchIntent(text, ctx).name).toBe(name));

  it("extracts arguments", () => {
    expect(matchIntent("cari Laras di klapper", kantor)).toEqual({ name: "search", query: "laras" });
    expect(matchIntent("repertorium PPAT 2026", kantor)).toEqual({ name: "repertorium", appointment: "ppat", year: 2026 });
  });
});
