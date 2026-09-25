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
  { id: "hukum", label: "Dasar hukum", prefixes: ["legal_references."] },
  { id: "pengguna", label: "Pengguna", prefixes: ["tenant_member.", "tenant.", "official."] },
];

export function auditModule(action: string) {
  return AUDIT_MODULES.find((m) => m.prefixes.some((p) => action.startsWith(p)));
}
