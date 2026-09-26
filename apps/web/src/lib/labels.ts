/** Display labels (Bahasa Indonesia) for database enums. */

export const AKTA_STATUSES = ["draft", "verifikasi", "menunggu_ttd", "selesai", "diarsipkan"] as const;
export type AktaStatus = (typeof AKTA_STATUSES)[number];
export const AKTA_STATUS_LABEL: Record<AktaStatus, string> = {
  draft: "Draft",
  verifikasi: "Verifikasi",
  menunggu_ttd: "Menunggu TTD",
  selesai: "Selesai",
  diarsipkan: "Diarsipkan",
};

/** Akta types offered in forms (from the earlier prototype). The appointment is chosen separately. */
export const AKTA_TYPES = [
  "Pendirian PT",
  "Perubahan Anggaran Dasar",
  "Pendirian CV",
  "Akta Jual Beli (AJB)",
  "Pengikatan Jual Beli (PPJB)",
  "Hibah",
  "Kuasa",
  "Pembebanan Hak Tanggungan (APHT)",
  "Kredit",
  "Fidusia",
  "Keterangan Waris",
  "Wasiat",
  "Pendirian Yayasan",
  "Pendirian Koperasi",
  "Jual Beli Saham",
  "Pembubaran",
  "Pembagian Hak Bersama (APHB)",
  "Tukar Menukar",
  "Perjanjian Kawin",
  "Sewa-menyewa",
  "Lainnya",
] as const;

export const PARTY_ROLES = ["penghadap", "pihak_pertama", "pihak_kedua", "kuasa", "saksi"] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];
export const PARTY_ROLE_LABEL: Record<PartyRole, string> = {
  penghadap: "Penghadap",
  pihak_pertama: "Pihak pertama",
  pihak_kedua: "Pihak kedua",
  kuasa: "Kuasa",
  saksi: "Saksi",
};

export const COMPANY_FORMS = ["PT", "CV", "Firma", "Yayasan", "Koperasi", "Perkumpulan", "Lainnya"] as const;

export const APPOINTMENT_LABEL = { notaris: "Notaris", ppat: "PPAT" } as const;

export const SCHEDULE_KINDS = ["pertemuan_klien", "penandatanganan", "internal"] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];
export const SCHEDULE_KIND_LABEL: Record<ScheduleKind, string> = {
  pertemuan_klien: "Pertemuan klien",
  penandatanganan: "Penandatanganan",
  internal: "Internal",
};

export const DOCUMENT_TYPES = [
  "minuta", "salinan", "ktp", "kk", "npwp", "sertifikat", "akta_lama", "surat_kuasa", "lainnya",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  minuta: "Minuta akta",
  salinan: "Salinan akta",
  ktp: "KTP",
  kk: "Kartu Keluarga",
  npwp: "NPWP",
  sertifikat: "Sertifikat",
  akta_lama: "Akta lama",
  surat_kuasa: "Surat kuasa",
  lainnya: "Lainnya",
};

export const LEGAL_CATEGORIES = [
  "undang_undang", "peraturan_pemerintah", "peraturan_presiden", "peraturan_menteri", "peraturan_daerah",
  "putusan_pengadilan", "surat_edaran", "lainnya",
] as const;
export type LegalCategory = (typeof LEGAL_CATEGORIES)[number];
export const LEGAL_CATEGORY_LABEL: Record<LegalCategory, string> = {
  undang_undang: "Undang-Undang",
  peraturan_pemerintah: "Peraturan Pemerintah",
  peraturan_presiden: "Peraturan Presiden",
  peraturan_menteri: "Peraturan Menteri",
  peraturan_daerah: "Peraturan Daerah",
  putusan_pengadilan: "Putusan Pengadilan",
  surat_edaran: "Surat Edaran",
  lainnya: "Lainnya",
};
export const LEGAL_STATUS_LABEL = { berlaku: "Berlaku", diubah: "Telah diubah", dicabut: "Dicabut" } as const;

export const PROTOKOL_STATUS_LABEL = { dalam_proses: "Dalam proses", diterima: "Diterima" } as const;

/**
 * Printed akta number. The office format is still to be confirmed by the Notaris (PLAN.md N-01);
 * until then numbers show as 001/2026.
 */
export function formatAktaNumber(number: number | null | undefined, period: string | null | undefined) {
  if (!number || !period) return null;
  return `${String(number).padStart(3, "0")}/${period}`;
}

export function fileFormat(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/jpeg") return "JPG";
  if (mime === "image/png") return "PNG";
  if (mime.includes("word")) return "DOCX";
  return "Lainnya";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
