import { PRESIGNING_STAGE_LABEL } from "@/lib/labels";

const LABELS: Record<string, string> = {
  "berkas.created": "Membuat berkas",
  "berkas_member.added": "Menambahkan anggota berkas",
  "berkas_member.removed": "Mengeluarkan anggota berkas",
  "tenant_member.added": "Menambahkan pengguna",
  "tenant_member.updated": "Mengubah peran pengguna",
  "tenant.switched": "Berpindah kantor",
  "official.upserted": "Memperbarui data pejabat",
  "akta.insert": "Membuat draft akta",
  "akta.update": "Mengubah akta",
  "akta.delete": "Menghapus draft akta",
  "akta.status_changed": "Mengubah status akta",
  "akta.finalized": "Memfinalkan dan memberi nomor akta",
  "akta_parties.insert": "Menambahkan pihak akta",
  "akta_parties.delete": "Menghapus pihak akta",
  "repertorium.corrected": "Mencatat koreksi repertorium",
  "persons.insert": "Menambahkan data orang",
  "persons.update": "Mengubah data orang",
  "companies.insert": "Menambahkan badan usaha",
  "companies.update": "Mengubah badan usaha",
  "checklist_items.insert": "Menambahkan item checklist",
  "checklist_items.update": "Mengubah item checklist",
  "checklist_items.delete": "Menghapus item checklist",
  "schedules.insert": "Menambahkan jadwal",
  "schedules.update": "Mengubah jadwal",
  "schedules.delete": "Menghapus jadwal",
  "documents.insert": "Mengunggah dokumen",
  "document.read": "Membuka dokumen",
  "protokol_transfers.insert": "Mencatat serah terima protokol",
  "protokol_transfers.update": "Memperbarui serah terima protokol",
  "legal_references.insert": "Menambahkan dasar hukum",
  "legal_references.update": "Mengubah dasar hukum",
  "legal_references.delete": "Menghapus dasar hukum",
  "legal.downloaded": "Mengunduh dasar hukum",
  "tenant_member.renamed": "Mengubah nama pengguna",
  "tenant_settings.updated": "Mengubah pengaturan kantor",
  "auth.login": "Masuk",
  "auth.logout": "Keluar",
  "auth.mfa_verified": "Verifikasi 2FA",
  "auth.password_changed": "Mengganti kata sandi",
  "session.revoked_all": "Mencabut semua sesi kantor",
  "proposal.created": "Agen mengusulkan perubahan",
  "proposal.approved": "Menyetujui usulan agen",
  "proposal.rejected": "Menolak usulan agen",
  "proposal.stale": "Usulan agen kedaluwarsa karena data berubah",
  "agent.presigning_checked": "Agen memeriksa kesiapan penandatanganan",
};

export const auditLabel = (action: string) => LABELS[action] ?? action;

/** Module grouping for the audit filter, by action prefix. */
export const AUDIT_MODULES: { id: string; label: string; prefixes: string[] }[] = [
  { id: "akta", label: "Akta", prefixes: ["akta.", "akta_parties.", "repertorium."] },
  { id: "berkas", label: "Berkas", prefixes: ["berkas.", "berkas_member.", "checklist_items."] },
  { id: "dokumen", label: "Dokumen", prefixes: ["documents.", "document."] },
  { id: "pihak", label: "Data pihak", prefixes: ["persons.", "companies."] },
  { id: "jadwal", label: "Jadwal", prefixes: ["schedules."] },
  { id: "protokol", label: "Protokol", prefixes: ["protokol_transfers."] },
  { id: "hukum", label: "Dasar hukum", prefixes: ["legal_references.", "legal."] },
  { id: "agen", label: "Agen", prefixes: ["proposal.", "agent."] },
  { id: "pengguna", label: "Pengguna", prefixes: ["tenant_member.", "tenant.", "tenant_settings.", "official."] },
  { id: "auth", label: "Autentikasi", prefixes: ["auth.", "session."] },
];

export function auditModule(action: string) {
  return AUDIT_MODULES.find((m) => m.prefixes.some((p) => action.startsWith(p)));
}

const STATUS: Record<string, string> = {
  draft: "Draft", verifikasi: "Verifikasi", menunggu_ttd: "Menunggu TTD", selesai: "Selesai", diarsipkan: "Diarsipkan",
};
const ROLE: Record<string, string> = {
  notaris: "Notaris/PPAT", partner: "Partner", associate: "Associate", staf_admin: "Staf administrasi", super_admin: "Super Admin",
};
const FIELD: Record<string, string> = {
  title: "judul", notes: "keterangan", status: "status", number: "nomor", number_period: "periode", akta_date: "tanggal akta",
  finalized_at: "waktu final", finalized_by: "pemfinal", done: "selesai", due_date: "tenggat", assignee_user_id: "penanggung jawab",
  starts_at: "waktu", location: "lokasi", kind: "jenis", full_name: "nama", nik: "NIK", address: "alamat", occupation: "pekerjaan",
  file_path: "lampiran", source_url: "tautan sumber", verified_by: "verifikasi", verified_at: "verifikasi", done_at: "selesai",
  done_by: "selesai", year: "tahun", category: "kategori", number_label: "nomor", completed_at: "selesai", completed_by: "selesai",
};

/** Short, content-free summary of `details` (ids, statuses, counts only; rule 9). */
export function auditDetail(action: string, details: unknown): string {
  const d = (details ?? {}) as Record<string, unknown>;
  if (action === "akta.status_changed") return `${STATUS[String(d.from)] ?? d.from} → ${STATUS[String(d.to)] ?? d.to}`;
  if (action === "akta.finalized") return `Nomor ${String(d.number).padStart(3, "0")}/${d.period}`;
  if (action.startsWith("tenant_member.") && d.role) return `${ROLE[String(d.role)] ?? d.role}${d.active === false ? " · nonaktif" : ""}`;
  if (action === "tenant_settings.updated") return `Sesi ${d.session_timeout_hours} jam${d.annual_akta_target ? ` · target ${d.annual_akta_target}` : ""}`;
  if (action === "session.revoked_all") return `${d.sessions ?? 0} sesi dicabut`;
  if (action === "agent.presigning_checked") {
    const stage = PRESIGNING_STAGE_LABEL[String(d.stage)] ?? "manual";
    return `${stage} · ${d.findings ?? 0} temuan${d.proposals ? ` · ${d.proposals} usulan` : ""}`;
  }
  if (action.startsWith("auth.")) return d.aal === "aal2" ? "Dengan 2FA" : "";
  if (action === "official.upserted" && d.appointment) return String(d.appointment).toUpperCase();
  if (Array.isArray(d.changed)) {
    const names = [...new Set((d.changed as string[]).map((k) => FIELD[k] ?? k))];
    return names.length ? `Diubah: ${names.slice(0, 4).join(", ")}${names.length > 4 ? "…" : ""}` : "";
  }
  return "";
}
