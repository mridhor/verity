/**
 * The agent's tools as a model sees them (OpenAI function format, which OpenRouter accepts).
 * Each maps onto an existing read-only skill; the two `usul_*` tools only create proposals.
 * Kept free of server code so the fine-tuning dataset script can reuse it.
 */
type Param = { type: "string" | "integer"; description: string; enum?: readonly string[] };
type Spec = { name: string; description: string; params: Record<string, Param>; required?: string[] };

const berkas: Param = { type: "string", description: "Nama berkas (sebagian judul cukup), hanya bila pengguna bertanya dari tampilan seluruh kantor." };
const date: Param = { type: "string", description: "Tanggal YYYY-MM-DD (WIB). Kosongkan bila pengguna tidak menyebutnya." };

export const TOOL_SPECS: Spec[] = [
  { name: "ringkasan_berkas", description: "Ringkasan satu berkas: jenis, langkah, akta dan statusnya, checklist, jadwal berikutnya, jumlah dokumen.", params: { berkas } },
  { name: "cek_kelengkapan", description: "Periksa kelengkapan data dan dokumen identitas setiap pihak di berkas (NIK, alamat, KTP, NPWP). Menampilkan pilihan usulan checklist untuk kekurangannya.", params: { berkas } },
  { name: "kesiapan_akta", description: "Periksa apa yang masih kurang sebelum akta bisa diajukan verifikasi, disetujui, atau difinalkan. Tidak mengubah status akta.", params: { berkas } },
  { name: "pihak_akta", description: "Daftar penghadap/pihak pada akta di berkas yang sedang dibuka.", params: {} },
  { name: "akta_per_status", description: "Daftar akta yang dapat dilihat pengguna dengan status tertentu.", params: { status: { type: "string", description: "Status akta.", enum: ["draft", "verifikasi", "menunggu_ttd", "selesai", "diarsipkan"] } }, required: ["status"] },
  { name: "akta_final", description: "Akta yang difinalkan bulan ini atau tahun ini.", params: { periode: { type: "string", description: "Rentang.", enum: ["bulan", "tahun"] } }, required: ["periode"] },
  { name: "jadwal", description: "Jadwal kantor (atau berkas yang dibuka) untuk hari ini, besok, atau 7 hari ke depan.", params: { rentang: { type: "string", description: "Rentang.", enum: ["hari_ini", "besok", "minggu"] } }, required: ["rentang"] },
  { name: "tenggat", description: "Item checklist yang belum selesai dengan tenggat dalam 7 hari (termasuk yang terlambat).", params: {} },
  { name: "cari", description: "Cari nama orang atau badan di data pihak, buku klapper, dan judul berkas.", params: { nama: { type: "string", description: "Nama yang dicari." } }, required: ["nama"] },
  { name: "repertorium", description: "Entri repertorium Notaris atau PPAT untuk satu tahun.", params: { pejabat: { type: "string", description: "Jenis pejabat.", enum: ["notaris", "ppat"] }, tahun: { type: "integer", description: "Tahun, misalnya 2026." } }, required: ["pejabat"] },
  { name: "dasar_hukum", description: "Cari referensi dasar hukum di pustaka kantor (beserta status verifikasinya).", params: { topik: { type: "string", description: "Topik atau nomor peraturan, misalnya 'fidusia' atau 'UU 2/2014'." } }, required: ["topik"] },
  { name: "dokumen", description: "Cari dokumen berdasarkan judul atau nama file.", params: { kata_kunci: { type: "string", description: "Kata kunci." } }, required: ["kata_kunci"] },
  { name: "buka_halaman", description: "Beri tautan ke halaman aplikasi (beranda, berkas, akta, jadwal, repertorium, klapper, dasar hukum, dokumen) atau ke berkas/akta bernama tertentu.", params: { tujuan: { type: "string", description: "Nama halaman atau nama berkas/akta." } }, required: ["tujuan"] },
  {
    name: "usul_checklist",
    description: "Siapkan usulan item checklist untuk berkas. Tanpa judul, formulir checklist ditampilkan ke pengguna. Usulan perlu disetujui.",
    params: { berkas, judul: { type: "string", description: "Isi item, misalnya 'Minta NPWP Laras'. Kosongkan bila pengguna belum menyebutnya." }, tenggat: date },
  },
  {
    name: "usul_jadwal",
    description: "Siapkan usulan jadwal untuk berkas (penandatanganan, pertemuan klien, atau internal). Bila berkas, tanggal, atau jam belum jelas, formulir jadwal ditampilkan ke pengguna. Usulan perlu disetujui; penandatanganan yang disetujui langsung diperiksa kesiapannya di latar belakang.",
    params: {
      berkas,
      jenis: { type: "string", description: "Jenis jadwal.", enum: ["penandatanganan", "pertemuan_klien", "internal"] },
      tanggal: date,
      jam: { type: "string", description: "Jam HH:MM (24 jam, WIB). Kosongkan bila pengguna tidak menyebutnya." },
      tempat: { type: "string", description: "Tempat, misalnya 'Ruang Utama'." },
      judul: { type: "string", description: "Judul jadwal bila pengguna menyebutnya." },
    },
    required: ["jenis"],
  },
];

export type ToolName = (typeof TOOL_SPECS)[number]["name"];

/** Tool definitions in the request format. */
export function toolDefinitions() {
  return TOOL_SPECS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: { type: "object", properties: t.params, required: t.required ?? [], additionalProperties: false },
    },
  }));
}

/** Short label for the step list while a tool runs. */
export const TOOL_STEP: Record<string, string> = {
  ringkasan_berkas: "Membaca ringkasan berkas",
  cek_kelengkapan: "Memeriksa kelengkapan pihak dan dokumen",
  kesiapan_akta: "Memeriksa kesiapan akta",
  pihak_akta: "Membaca pihak pada akta",
  akta_per_status: "Mencari akta",
  akta_final: "Menghitung akta final",
  jadwal: "Membaca jadwal",
  tenggat: "Membaca tenggat checklist",
  cari: "Mencari nama",
  repertorium: "Membaca repertorium",
  dasar_hukum: "Mencari dasar hukum",
  dokumen: "Mencari dokumen",
  buka_halaman: "Mencari halaman",
  usul_checklist: "Menyiapkan usulan checklist",
  usul_jadwal: "Menyiapkan usulan jadwal",
};
