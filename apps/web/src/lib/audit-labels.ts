const LABELS: Record<string, string> = {
  "berkas.created": "Membuat berkas",
  "berkas_member.added": "Menambahkan anggota berkas",
  "berkas_member.removed": "Mengeluarkan anggota berkas",
  "tenant_member.added": "Menambahkan pengguna",
  "tenant_member.updated": "Mengubah peran pengguna",
  "tenant.switched": "Berpindah kantor",
  "official.upserted": "Memperbarui data pejabat",
};

export const auditLabel = (action: string) => LABELS[action] ?? action;
