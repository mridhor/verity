#!/usr/bin/env node
// Synthetic demo data for one notary office, written straight into Supabase (never into the
// frontend). All people, companies, numbers and files are fictitious; NIK start with "99".
//
//   node supabase/demo/seed.mjs --local  --notaris sari@kantor.test --staf andi@kantor.test
//   node supabase/demo/seed.mjs --linked --notaris <email> --staf <email>
//
// Runs from an operator machine with the Supabase CLI (no secret keys in the app). Refuses to
// run twice for the same office. Afterwards it uploads a small generated file for every seeded
// document to the exact storage path recorded in `documents`.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const target = args.includes("--linked") ? "--linked" : args.includes("--local") ? "--local" : null;
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const notarisEmail = opt("--notaris");
const stafEmail = opt("--staf");
if (!target || !notarisEmail || !stafEmail) {
  console.error("Usage: node supabase/demo/seed.mjs --local|--linked --notaris <email> --staf <email>");
  process.exit(2);
}

// ─── Deterministic pseudo-random helpers ───
let state = 20260925;
const rand = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const day = (offset) => `(current_date + ${offset})`;
const at = (offset, hhmm) => `((current_date + ${offset})::timestamp + time '${hhmm}') at time zone 'Asia/Jakarta'`;

// ─── People and companies ───
const FIRST = ["Laras", "Rahmat", "Dewi", "Budi", "Siti", "Agus", "Putri", "Hendra", "Rina", "Yusuf", "Mega", "Fajar",
  "Intan", "Bayu", "Nadia", "Rudi", "Wulan", "Arif", "Citra", "Joko", "Ayu", "Taufik", "Sri", "Galih", "Nurul", "Eko",
  "Anisa", "Dimas", "Fitri", "Irfan", "Kartika", "Lukman", "Maria", "Oki", "Pratiwi", "Reza", "Salsabila", "Teguh",
  "Umi", "Vino", "Winda", "Yogi", "Zahra", "Andreas", "Benny", "Clara", "Daniel", "Elisa", "Ferry", "Gita", "Hana",
  "Ilham", "Jessica", "Kevin", "Lestari", "Michael", "Novita", "Olivia", "Paulus", "Qori"];
const LAST = ["Anggraini", "Hidayat", "Saputra", "Wijaya", "Kusuma", "Santoso", "Lestari", "Pratama", "Nugroho",
  "Hartono", "Siregar", "Nasution", "Simanjuntak", "Halim", "Gunawan", "Setiawan", "Rahayu", "Permana", "Utami",
  "Suryadi", "Tanjung", "Harahap", "Wibowo", "Maulana", "Purnomo", "Situmorang", "Hakim", "Susanto", "Kurniawan"];
const PLACES = ["Jakarta", "Bandung", "Surabaya", "Medan", "Semarang", "Yogyakarta", "Malang", "Bogor", "Palembang", "Makassar"];
const STREETS = ["Jl. Wijaya II No. %", "Jl. Kemang Raya No. %", "Jl. Tebet Barat Dalam No. %", "Jl. Cipete Raya No. %",
  "Jl. Pangeran Antasari No. %", "Jl. Fatmawati No. %", "Jl. Kebagusan III No. %", "Jl. Ampera Raya No. %",
  "Jl. Bangka IX No. %", "Jl. Cilandak KKO No. %"];
const AREAS = ["Kebayoran Baru", "Mampang Prapatan", "Tebet", "Cilandak", "Pasar Minggu", "Kebayoran Lama", "Pancoran", "Setiabudi"];
const JOBS = ["Wiraswasta", "Karyawan swasta", "Pegawai negeri sipil", "Dokter", "Guru", "Pedagang", "Konsultan",
  "Arsitek", "Ibu rumah tangga", "Pensiunan", "Dosen", "Pengacara"];

const persons = [];
const usedNames = new Set();
for (let i = 0; persons.length < 64; i++) {
  const name = `${pick(FIRST)} ${pick(LAST)}`.toUpperCase();
  if (usedNames.has(name)) continue;
  usedNames.add(name);
  const born = new Date(Date.UTC(1958 + Math.floor(rand() * 42), Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)));
  const dd = String(born.getUTCDate()).padStart(2, "0");
  const mm = String(born.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(born.getUTCFullYear()).slice(2);
  persons.push({
    key: `p${persons.length}`, name,
    nik: `9971${String(10 + (persons.length % 80)).padStart(2, "0")}${dd}${mm}${yy}${String(persons.length + 1).padStart(4, "0")}`,
    place: pick(PLACES), birth: born.toISOString().slice(0, 10),
    address: `${pick(STREETS).replace("%", String(1 + Math.floor(rand() * 90)))}, ${pick(AREAS)}, Jakarta Selatan`,
    job: pick(JOBS),
  });
}
const COMPANIES = [
  ["PT", "Arunika Kopi Nusantara", "Jakarta Selatan"], ["PT", "Samudra Logistik Indonesia", "Jakarta Utara"],
  ["PT", "Bank Nusa Makmur Tbk", "Jakarta Pusat"], ["PT", "Mitra Dana Finance", "Jakarta Selatan"],
  ["PT", "Griya Asri Properti", "Tangerang Selatan"], ["PT", "Teknologi Cerdas Abadi", "Jakarta Selatan"],
  ["PT", "Sinar Pangan Sejahtera", "Bekasi"], ["PT", "Rekayasa Hijau Mandiri", "Bogor"],
  ["CV", "Karya Bersama Mandiri", "Depok"], ["CV", "Rumah Batik Laweyan", "Surakarta"], ["CV", "Dapur Rempah Kita", "Jakarta Timur"],
  ["Yayasan", "Cahaya Pelita Bangsa", "Jakarta Selatan"], ["Koperasi", "Sejahtera Bersama", "Jakarta Selatan"],
  ["PT", "Bank Pembangunan Kota Tbk", "Jakarta Pusat"], ["PT", "Cipta Karya Konstruksi", "Jakarta Barat"],
].map(([form, name, domicile], i) => ({
  key: `c${i}`, form, name, domicile,
  nib: `99${String(1200000000 + i * 7919).padStart(11, "0")}`.slice(0, 13),
  npwp: `99.${String(100 + i)}.${String(200 + i * 3).padStart(3, "0")}.${i % 10}-${String(400 + i)}.000`,
}));
const company = (name) => COMPANIES.find((c) => c.name === name);
let personCursor = 0;
const nextPerson = () => persons[personCursor++ % persons.length];

// ─── Cases: one berkas each, with its akta ───
// status: target akta status; days: how long ago the case started; finalDaysAgo for final akta.
const STEPS = {
  pendirian_pt: ["Intake", "Pesan nama", "Draft akta", "Penandatanganan", "SK AHU", "NIB OSS"],
  pendirian_cv: ["Intake", "Draft akta", "Penandatanganan", "Pendaftaran SABU", "NIB OSS"],
  perubahan_ad: ["Intake", "Draft akta", "Penandatanganan", "Pemberitahuan AHU"],
  ajb: ["Intake", "Pengecekan sertifikat", "Draft akta", "Penandatanganan", "Pendaftaran"],
  ppjb: ["Intake", "Draft akta", "Penandatanganan"],
  hibah: ["Intake", "Pengecekan sertifikat", "Draft akta", "Penandatanganan", "Pendaftaran"],
  apht: ["Intake", "Pengecekan sertifikat", "Draft akta", "Penandatanganan", "Pendaftaran HT"],
  fidusia: ["Intake", "Draft akta", "Penandatanganan", "Pendaftaran fidusia"],
  waris: ["Intake", "Pengumpulan dokumen", "Draft akta", "Penandatanganan"],
  kuasa: ["Intake", "Draft akta", "Penandatanganan"],
  wasiat: ["Intake", "Draft akta", "Penandatanganan", "Pelaporan wasiat"],
  kredit: ["Intake", "Draft akta", "Penandatanganan"],
};

const cases = [];
function addCase(type, title, akta, { days, team = [] }) { cases.push({ type, title, akta, days, team }); }

const pt = (name, status, finalDaysAgo) => {
  const f = [nextPerson(), nextPerson(), nextPerson()];
  return { appointment: "notaris", type: "Pendirian PT", title: `Akta Pendirian PT ${name}`, status, finalDaysAgo,
    notes: "Modal dasar dan susunan pengurus mengikuti rancangan yang disetujui para pendiri.",
    parties: f.map((p, i) => ({ person: p, role: "penghadap", capacity: i === 0 ? "Calon Direktur Utama" : "Pendiri" })) };
};
const cv = (name, status, finalDaysAgo) => {
  const f = [nextPerson(), nextPerson()];
  return { appointment: "notaris", type: "Pendirian CV", title: `Akta Pendirian CV ${name}`, status, finalDaysAgo,
    parties: f.map((p, i) => ({ person: p, role: "penghadap", capacity: i === 0 ? "Sekutu komanditer" : "Sekutu aktif" })) };
};
const perubahan = (co, status, finalDaysAgo, what) => {
  const d = nextPerson();
  return { appointment: "notaris", type: "Perubahan Anggaran Dasar", title: `Akta Perubahan Anggaran Dasar ${co.form} ${co.name}`,
    status, finalDaysAgo, notes: what,
    parties: [{ company: co, role: "penghadap", capacity: "Diwakili Direktur Utama" }, { person: d, role: "penghadap", capacity: "Direktur Utama" }] };
};
const land = (kind, where, status, finalDaysAgo) => {
  const a = nextPerson(); const b = nextPerson(); const s1 = nextPerson(); const s2 = nextPerson();
  const map = { ajb: ["Akta Jual Beli (AJB)", "Akta Jual Beli"], hibah: ["Hibah", "Akta Hibah"] };
  return { appointment: "ppat", type: map[kind][0], title: `${map[kind][1]} ${where}`, status, finalDaysAgo,
    parties: [{ person: a, role: "pihak_pertama" }, { person: b, role: "pihak_kedua" }, { person: s1, role: "saksi" }, { person: s2, role: "saksi" }] };
};
const apht = (where, bank, status, finalDaysAgo) => {
  const debitur = nextPerson(); const kuasa = nextPerson();
  return { appointment: "ppat", type: "Pembebanan Hak Tanggungan (APHT)", title: `APHT ${where}`, status, finalDaysAgo,
    parties: [{ person: debitur, role: "pihak_pertama", capacity: "Pemberi hak tanggungan" },
      { company: bank, role: "pihak_kedua", capacity: "Penerima hak tanggungan" }, { person: kuasa, role: "kuasa", capacity: `Kuasa ${bank.form} ${bank.name}` }] };
};
const fidusia = (obj, debtor, status, finalDaysAgo) => ({
  appointment: "notaris", type: "Fidusia", title: `Akta Jaminan Fidusia ${obj}`, status, finalDaysAgo,
  parties: [debtor.form ? { company: debtor, role: "pihak_pertama", capacity: "Pemberi fidusia" } : { person: debtor, role: "pihak_pertama", capacity: "Pemberi fidusia" },
    { company: company("Mitra Dana Finance"), role: "pihak_kedua", capacity: "Penerima fidusia" }],
});
const simple = (type, title, roles, status, finalDaysAgo, appointment = "notaris") => ({
  appointment, type, title, status, finalDaysAgo, parties: roles.map((role) => ({ person: nextPerson(), role })),
});

// Final akta, oldest first (numbering follows the akta date).
addCase("pendirian_pt", "Pendirian PT Teknologi Cerdas Abadi", [pt("Teknologi Cerdas Abadi", "selesai", 250)], { days: 262 });
addCase("ajb", "AJB Rumah Jl. Ampera Raya No. 12", [land("ajb", "Rumah Jl. Ampera Raya No. 12, Cilandak", "diarsipkan", 238)], { days: 250 });
addCase("fidusia", "Fidusia Armada PT Samudra Logistik", [fidusia("Armada Truk PT Samudra Logistik Indonesia", company("Samudra Logistik Indonesia"), "diarsipkan", 224)], { days: 230 });
addCase("pendirian_cv", "Pendirian CV Dapur Rempah Kita", [cv("Dapur Rempah Kita", "selesai", 205)], { days: 214 });
addCase("waris", "Keterangan Waris Keluarga Hartono", [simple("Keterangan Waris", "Akta Keterangan Waris Almarhum Soetrisno Hartono", ["penghadap", "penghadap", "penghadap", "saksi"], "selesai", 190)], { days: 205 });
addCase("apht", "APHT Ruko Fatmawati Blok B-7", [apht("Ruko Jl. Fatmawati Blok B-7", company("Bank Nusa Makmur Tbk"), "selesai", 176)], { days: 184 });
addCase("perubahan_ad", "Perubahan AD PT Griya Asri Properti", [
  perubahan(company("Griya Asri Properti"), "selesai", 160, "Peningkatan modal ditempatkan dan perubahan susunan direksi."),
  perubahan(company("Griya Asri Properti"), "selesai", 98, "Perubahan maksud dan tujuan sesuai KBLI 2020."),
], { days: 170 });
addCase("hibah", "Hibah Tanah Keluarga di Bogor", [land("hibah", "Tanah Pekarangan Desa Cibinong, Bogor", "selesai", 147)], { days: 160 });
addCase("kuasa", "Kuasa Menjual Apartemen Kalibata", [simple("Kuasa", "Akta Kuasa Menjual Unit Apartemen Kalibata Tower C", ["pihak_pertama", "pihak_kedua"], "diarsipkan", 133)], { days: 140 });
addCase("ajb", "AJB Kavling 7 Cipete Utara", [land("ajb", "Tanah Kavling 7 Cipete Utara", "selesai", 121)], { days: 132 });
addCase("kredit", "Perjanjian Kredit CV Karya Bersama", [{
  appointment: "notaris", type: "Kredit", title: "Akta Perjanjian Kredit Modal Kerja CV Karya Bersama Mandiri", status: "selesai", finalDaysAgo: 110,
  parties: [{ company: company("Karya Bersama Mandiri"), role: "pihak_pertama", capacity: "Debitur" }, { company: company("Bank Pembangunan Kota Tbk"), role: "pihak_kedua", capacity: "Kreditur" }],
}], { days: 118 });
addCase("pendirian_pt", "Pendirian PT Sinar Pangan Sejahtera", [pt("Sinar Pangan Sejahtera", "selesai", 84)], { days: 96 });
addCase("apht", "APHT Rumah Tebet Barat", [apht("Rumah Jl. Tebet Barat Dalam No. 21", company("Bank Pembangunan Kota Tbk"), "selesai", 71)], { days: 80 });
addCase("ppjb", "PPJB Unit Griya Asri Residence", [{
  appointment: "notaris", type: "Pengikatan Jual Beli (PPJB)", title: "Akta PPJB Unit A-12 Griya Asri Residence", status: "selesai", finalDaysAgo: 58,
  parties: [{ company: company("Griya Asri Properti"), role: "pihak_pertama", capacity: "Pengembang" }, { person: nextPerson(), role: "pihak_kedua" }],
}], { days: 66 });
addCase("wasiat", "Wasiat Ibu Kartika Siregar", [simple("Wasiat", "Akta Wasiat Kartika Siregar", ["penghadap", "saksi", "saksi"], "selesai", 44)], { days: 52 });
addCase("fidusia", "Fidusia Mesin Produksi PT Rekayasa Hijau", [fidusia("Mesin Produksi PT Rekayasa Hijau Mandiri", company("Rekayasa Hijau Mandiri"), "selesai", 30)], { days: 38 });
addCase("ajb", "AJB Rumah Kebagusan III", [land("ajb", "Rumah Jl. Kebagusan III No. 5, Pasar Minggu", "selesai", 19)], { days: 29 });
addCase("pendirian_pt", "Pendirian PT Cipta Karya Konstruksi", [pt("Cipta Karya Konstruksi", "selesai", 11)], { days: 24 });
addCase("kuasa", "Kuasa Pengurusan Balik Nama", [simple("Kuasa", "Akta Kuasa Pengurusan Balik Nama Sertifikat", ["pihak_pertama", "pihak_kedua"], "selesai", 6)], { days: 12 });
addCase("hibah", "Hibah Rumah Mampang kepada Anak", [land("hibah", "Rumah Jl. Bangka IX No. 3, Mampang Prapatan", "selesai", 3)], { days: 16 });

// Work in progress.
addCase("pendirian_pt", "Pendirian PT Arunika Kopi Nusantara", [pt("Arunika Kopi Nusantara", "menunggu_ttd")], { days: 14 });
addCase("ajb", "AJB Kavling 14 Cilandak Timur", [land("ajb", "Tanah Kavling 14 Cilandak Timur", "menunggu_ttd")], { days: 11 });
addCase("apht", "APHT Gudang Cakung", [apht("Gudang Jl. Raya Cakung Cilincing Km 2", company("Bank Nusa Makmur Tbk"), "verifikasi")], { days: 9 });
addCase("perubahan_ad", "Perubahan AD PT Teknologi Cerdas Abadi", [
  perubahan(company("Teknologi Cerdas Abadi"), "verifikasi", undefined, "Masuknya investor baru dan perubahan komposisi saham."),
], { days: 8 });
addCase("pendirian_cv", "Pendirian CV Rumah Batik Laweyan", [cv("Rumah Batik Laweyan", "menunggu_ttd")], { days: 10 });
addCase("fidusia", "Fidusia Kendaraan Operasional Koperasi", [fidusia("Kendaraan Operasional Koperasi Sejahtera Bersama", company("Sejahtera Bersama"), "verifikasi")], { days: 7 });
addCase("waris", "Keterangan Waris Keluarga Nasution", [simple("Keterangan Waris", "Akta Keterangan Waris Almarhum Darwin Nasution", ["penghadap", "penghadap", "saksi"], "draft")], { days: 5 });
addCase("ppjb", "PPJB Ruko Bintaro Sektor 9", [simple("Pengikatan Jual Beli (PPJB)", "Akta PPJB Ruko Bintaro Sektor 9 Blok C", ["pihak_pertama", "pihak_kedua"], "verifikasi")], { days: 6 });
addCase("pendirian_pt", "Pendirian PT Rasa Laut Nusantara", [pt("Rasa Laut Nusantara", "draft")], { days: 4 });
addCase("ajb", "AJB Apartemen Kemang Village", [land("ajb", "Unit Apartemen Kemang Village Tower B", "draft")], { days: 3 });
addCase("hibah", "Hibah Saham PT Sinar Pangan", [simple("Hibah", "Akta Hibah Saham PT Sinar Pangan Sejahtera", ["pihak_pertama", "pihak_kedua"], "menunggu_ttd")], { days: 9 });
addCase("kredit", "Kredit Investasi PT Arunika", [{
  appointment: "notaris", type: "Kredit", title: "Akta Perjanjian Kredit Investasi PT Arunika Kopi Nusantara", status: "draft",
  parties: [{ person: nextPerson(), role: "pihak_pertama", capacity: "Calon Direktur Utama" }, { company: company("Bank Nusa Makmur Tbk"), role: "pihak_kedua", capacity: "Kreditur" }],
}], { days: 2 });
addCase("apht", "APHT Rumah Setiabudi", [apht("Rumah Jl. Setiabudi Tengah No. 8", company("Bank Pembangunan Kota Tbk"), "menunggu_ttd")], { days: 13 });
addCase("kuasa", "Kuasa Khusus RUPS Yayasan", [simple("Kuasa", "Akta Kuasa Khusus Yayasan Cahaya Pelita Bangsa", ["pihak_pertama", "pihak_kedua"], "draft")], { days: 1 });
addCase("wasiat", "Wasiat Bapak Teguh Wibowo", [simple("Wasiat", "Akta Wasiat Teguh Wibowo", ["penghadap", "saksi", "saksi"], "verifikasi")], { days: 6 });
addCase("pendirian_pt", "Pendirian PT Kopi Senja Lestari", [pt("Kopi Senja Lestari", "verifikasi")], { days: 5 });

// ─── SQL ───
const out = [];
const sql = (s) => out.push(s);
sql(`do $seed$
declare
  v_tenant uuid; v_notaris uuid; v_staf uuid; v_retno uuid; v_dimas uuid; v_maya uuid;
  v_off_notaris uuid; v_off_ppat uuid; v_name text;
  b uuid; a uuid;
  p jsonb := '{}'::jsonb; c jsonb := '{}'::jsonb;
begin
  select tm.tenant_id, tm.user_id into v_tenant, v_notaris
    from public.tenant_members tm join auth.users u on u.id = tm.user_id
   where lower(u.email) = lower(${q(notarisEmail)}) and tm.role = 'notaris' and tm.active;
  if v_tenant is null then raise exception 'Akun Notaris % belum terdaftar aktif di kantor mana pun', ${q(notarisEmail)}; end if;
  select tm.user_id into v_staf
    from public.tenant_members tm join auth.users u on u.id = tm.user_id
   where lower(u.email) = lower(${q(stafEmail)}) and tm.tenant_id = v_tenant and tm.active and tm.role <> 'super_admin';
  if v_staf is null then raise exception 'Akun staf % belum terdaftar aktif di kantor yang sama', ${q(stafEmail)}; end if;
  if exists (select 1 from public.berkas where tenant_id = v_tenant and title = 'Pendirian PT Teknologi Cerdas Abadi') then
    raise exception 'Data demo sudah pernah diisi untuk kantor ini';
  end if;

  delete from verity_seed.ctx;
  insert into verity_seed.ctx (tenant, notaris, staf) values (v_tenant, v_notaris, v_staf);

  -- Officials (Notaris and PPAT) for the Notaris, unless the office already recorded them.
  select display_name into v_name from public.tenant_members where tenant_id = v_tenant and user_id = v_notaris;
  insert into public.officials (tenant_id, user_id, appointment, display_name, kedudukan, sk_ref)
  values (v_tenant, v_notaris, 'notaris', v_name || ', S.H., M.Kn.', 'Kota Administrasi Jakarta Selatan', 'AHU-00123.AH.02.01.Tahun 2015'),
         (v_tenant, v_notaris, 'ppat', v_name || ', S.H., M.Kn.', 'Kota Administrasi Jakarta Selatan', '112/KEP-17.3/IV/2016')
  on conflict (tenant_id, user_id, appointment) do nothing;
  select id into v_off_notaris from public.officials where tenant_id = v_tenant and user_id = v_notaris and appointment = 'notaris';
  select id into v_off_ppat from public.officials where tenant_id = v_tenant and user_id = v_notaris and appointment = 'ppat';
  update verity_seed.ctx set off_notaris = v_off_notaris, off_ppat = v_off_ppat;

  insert into public.tenant_settings (tenant_id, annual_akta_target, session_timeout_hours)
  values (v_tenant, 60, 8) on conflict (tenant_id) do nothing;

  v_retno := verity_seed.colleague('retno.wulandari@demo.verity.test', 'Retno Wulandari', 'staf_admin');
  v_dimas := verity_seed.colleague('dimas.prasetyo@demo.verity.test', 'Dimas Prasetyo', 'staf_admin');
  v_maya := verity_seed.colleague('maya.kartika@demo.verity.test', 'Maya Kartika', 'staf_admin');
`);

for (const p of persons) {
  sql(`  p := p || jsonb_build_object(${q(p.key)}, verity_seed.person(${q(p.name)}, ${q(p.nik)}, ${q(p.place)}, ${q(p.birth)}::date, ${q(p.address)}, ${q(p.job)}));`);
}
for (const c of COMPANIES) {
  sql(`  c := c || jsonb_build_object(${q(c.key)}, verity_seed.company(${q(c.form)}, ${q(c.name)}, ${q(c.nib)}, ${q(c.npwp)}, ${q(c.domicile)}));`);
}

const TEAM = ["v_staf", "v_retno", "v_dimas", "v_maya"];
const finals = [];
const docs = [];
cases.forEach((cs, i) => {
  const pic = i % 3 === 0 ? "v_staf" : TEAM[i % TEAM.length];
  const members = [...new Set([pic, "v_staf", TEAM[(i + 1) % TEAM.length]])];
  const steps = STEPS[cs.type];
  const allFinal = cs.akta.every((x) => x.status === "selesai" || x.status === "diarsipkan");
  const anySigning = cs.akta.some((x) => x.status === "menunggu_ttd");
  const step = allFinal ? steps[steps.length - 1] : anySigning ? "Penandatanganan" : cs.akta.some((x) => x.status === "verifikasi") ? "Draft akta" : steps[1];
  const status = allFinal && cs.days > 60 ? "selesai" : "aktif";
  sql(`  b := verity_seed.berkas(${q(cs.type)}, ${q(cs.title)}, ${pic}, array[${members.join(", ")}]::uuid[], ${q(steps.includes(step) ? step : steps[1])}, ${q(status)}, now() - interval '${cs.days} days');`);
  cs.akta.forEach((ak, j) => {
    const parties = ak.parties.map((pt) => pt.person
      ? `jsonb_build_object('person', p ->> ${q(pt.person.key)}, 'role', ${q(pt.role)}, 'capacity', ${q(pt.capacity ?? null)})`
      : `jsonb_build_object('company', c ->> ${q(pt.company.key)}, 'role', ${q(pt.role)}, 'capacity', ${q(pt.capacity ?? null)})`);
    const target = ak.status === "diarsipkan" ? "selesai" : ak.status;
    sql(`  a := verity_seed.akta(b, ${q(ak.appointment)}, ${q(ak.type)}, ${q(ak.title)}, ${q(ak.notes ?? null)}, jsonb_build_array(${parties.join(", ")}), ${q(target)}, ${pic}, now() - interval '${Math.max(1, cs.days - j * 3)} days');`);
    const ref = `a_${i}_${j}`;
    sql(`  perform set_config('verity_seed.${ref}', a::text, true);`);
    if (ak.finalDaysAgo !== undefined) finals.push({ ref, daysAgo: ak.finalDaysAgo, archive: ak.status === "diarsipkan" });
    // Documents: identity cards of the people, land certificate, minuta of final akta.
    const seenKtp = new Set();
    for (const pt of ak.parties) {
      if (pt.person && pt.role !== "saksi" && !seenKtp.has(pt.person.key)) {
        seenKtp.add(pt.person.key);
        docs.push({ berkas: "b", akta: "a", type: "ktp", title: `KTP ${pt.person.name}`, file: `KTP_${pt.person.name.replace(/\s+/g, "_")}.png`, mime: "image/png", days: cs.days - 1, by: pic });
        if (rand() < 0.35) docs.push({ berkas: "b", akta: "a", type: "npwp", title: `NPWP ${pt.person.name}`, file: `NPWP_${pt.person.name.replace(/\s+/g, "_")}.pdf`, mime: "application/pdf", days: cs.days - 2, by: pic });
      }
    }
    if (["ajb", "hibah", "apht"].includes(cs.type)) docs.push({ berkas: "b", akta: "a", type: "sertifikat", title: `Sertifikat ${ak.title.replace(/^(Akta Jual Beli|Akta Hibah|APHT) /, "")}`, file: "Sertifikat_SHM.pdf", mime: "application/pdf", days: cs.days - 2, by: pic });
    if (ak.type === "Kuasa") docs.push({ berkas: "b", akta: "a", type: "surat_kuasa", title: "Draft surat kuasa dari klien", file: "Draft_Surat_Kuasa.pdf", mime: "application/pdf", days: cs.days - 1, by: pic });
    if (ak.finalDaysAgo !== undefined) docs.push({ berkas: "b", akta: "a", type: "minuta", title: `Minuta ${ak.title}`, file: "Minuta_Akta.pdf", mime: "application/pdf", days: ak.finalDaysAgo, by: pic, afterFinal: ref });
    for (const d of docs.filter((x) => !x.emitted && !x.afterFinal)) {
      d.emitted = true;
      sql(`  perform verity_seed.document(${d.berkas}, ${d.akta}, ${q(d.type)}, ${q(d.title)}, ${q(d.file)}, ${q(d.mime)}, ${20000 + Math.floor(rand() * 900000)}, now() - interval '${Math.max(0, d.days)} days', ${d.by});`);
    }
  });
  // Checklist for work in progress.
  if (!allFinal) {
    const lead = cs.akta[0].parties.find((x) => x.person)?.person.name ?? "klien";
    const items = [
      [`Minta NPWP ${lead}`, 3, false], ["Konfirmasi jadwal penandatanganan dengan klien", 1, false],
      [cs.type === "pendirian_pt" ? "Pengecekan dan pemesanan nama PT di AHU" : cs.type === "ajb" || cs.type === "apht" || cs.type === "hibah" ? "Pengecekan sertifikat ke BPN" : "Kumpulkan dokumen pendukung", -2, rand() < 0.5],
      ["Kirim draft akta ke klien untuk dibaca", -4, true],
    ].slice(0, 2 + Math.floor(rand() * 3));
    for (const [title, due, done] of items) {
      sql(`  perform verity_seed.checklist(b, ${q(title)}, ${pick(TEAM)}, current_date + ${due}, ${done});`);
    }
    if (cs.akta.some((x) => x.status === "menunggu_ttd")) {
      const offset = 1 + Math.floor(rand() * 6);
      sql(`  perform verity_seed.schedule(b, 'penandatanganan', ${q(`Penandatanganan ${cs.akta[0].title}`)}, ${at(offset, pick(["10:00", "13:30", "15:00"]))}, 'Ruang Utama', 'Para pihak membawa KTP asli.', ${pic});`);
    }
  }
  sql(`  perform set_config('verity_seed.b_${i}', b::text, true);`);
});

// Finalize in date order so numbers follow the akta dates.
finals.sort((x, y) => y.daysAgo - x.daysAgo);
for (const f of finals) {
  sql(`  perform verity_seed.finalize(current_setting('verity_seed.${f.ref}')::uuid, current_date - ${f.daysAgo}, ${f.archive});`);
  for (const d of docs.filter((x) => x.afterFinal === f.ref)) {
    const [, i] = f.ref.split("_");
    sql(`  perform verity_seed.document(current_setting('verity_seed.b_${i}')::uuid, current_setting('verity_seed.${f.ref}')::uuid, ${q(d.type)}, ${q(d.title)}, ${q(d.file)}, ${q(d.mime)}, ${200000 + Math.floor(rand() * 2000000)}, now() - interval '${Math.max(0, d.days)} days', ${d.by});`);
  }
}

// Office agenda.
const AGENDA = [
  [-13, "09:00", "internal", "Rapat mingguan kantor", "Ruang Meeting 1"], [-11, "10:00", "pertemuan_klien", "Konsultasi pendirian yayasan — Ibu Gita Halim", "Ruang Meeting 2"],
  [-9, "14:00", "pertemuan_klien", "Konsultasi waris keluarga Nasution", "Ruang Meeting 1"], [-6, "09:00", "internal", "Rapat mingguan kantor", "Ruang Meeting 1"],
  [-5, "13:00", "internal", "Pelatihan UU Pelindungan Data Pribadi", "Ruang Utama"], [-3, "11:00", "pertemuan_klien", "Pembahasan draft PPJB Ruko Bintaro", "Kantor klien, Bintaro"],
  [-1, "15:30", "pertemuan_klien", "Pengecekan sertifikat bersama pembeli", "Kantor BPN Jakarta Selatan"],
  [0, "09:00", "internal", "Rapat mingguan kantor", "Ruang Meeting 1"], [0, "11:00", "pertemuan_klien", "Konsultasi perubahan AD PT Teknologi Cerdas Abadi", "Ruang Meeting 2"],
  [0, "14:00", "pertemuan_klien", "Pembacaan draft akta pendirian PT Kopi Senja Lestari", "Ruang Utama"],
  [2, "10:00", "pertemuan_klien", "Konsultasi hibah saham", "Ruang Meeting 1"], [4, "09:30", "internal", "Pemeriksaan protokol oleh MPD", "Ruang Arsip"],
  [7, "09:00", "internal", "Rapat mingguan kantor", "Ruang Meeting 1"], [8, "13:00", "pertemuan_klien", "Konsultasi APHT gudang Cakung", "Ruang Meeting 2"],
  [10, "10:00", "pertemuan_klien", "Konsultasi wasiat — Bapak Teguh Wibowo", "Ruang Meeting 1"], [12, "14:00", "internal", "Evaluasi target akta kuartal IV", "Ruang Meeting 1"],
  [14, "09:00", "internal", "Rapat mingguan kantor", "Ruang Meeting 1"], [16, "11:00", "pertemuan_klien", "Pertemuan dengan tim legal Bank Nusa Makmur", "Kantor Bank Nusa Makmur, Sudirman"],
  [19, "13:30", "pertemuan_klien", "Konsultasi pendirian koperasi", "Ruang Meeting 2"], [21, "09:00", "internal", "Rapat mingguan kantor", "Ruang Meeting 1"],
];
for (const [off, time, kind, title, loc] of AGENDA) {
  sql(`  perform verity_seed.schedule(null, ${q(kind)}, ${q(title)}, ${at(off, time)}, ${q(loc)}, null, ${pick(["v_staf", "v_retno", "v_maya"])});`);
}

// Protokol received from other notaries (fictitious names).
sql(`  perform verity_seed.act(v_notaris);`);
const PROTOKOL = [
  ["Notaris Hendra Gunawan, S.H.", "C-1021.HT.03.01-Th.1998", "Jakarta Selatan", -410, 1840, "1998–2019", "diterima"],
  ["Notaris Ratna Dewi Kusuma, S.H., M.Kn.", "AHU-0045.AH.02.02.Tahun 2008", "Jakarta Selatan", -300, 962, "2008–2023", "diterima"],
  ["Notaris Bambang Sutejo, S.H.", "C-557.HT.03.01-Th.1991", "Depok", -180, 2310, "1991–2024", "diterima"],
  ["Notaris Liliana Tanjung, S.H., M.Kn.", "AHU-0112.AH.02.02.Tahun 2011", "Jakarta Timur", -20, 745, "2011–2025", "dalam_proses"],
  ["Notaris Agustinus Halim, S.H.", "AHU-0078.AH.02.02.Tahun 2005", "Tangerang Selatan", -6, 1203, "2005–2025", "dalam_proses"],
];
for (const [name, sk, wil, off, count, range, st] of PROTOKOL) {
  sql(`  insert into public.protokol_transfers (source_notaris_name, sk_ref, wilayah, handover_date, akta_count, year_range, status, notes)
  values (${q(name)}, ${q(sk)}, ${q(wil)}, current_date + ${off}, ${count}, ${q(range)}, ${q(st)}, ${q(st === "diterima" ? "Berita acara serah terima ditandatangani; protokol disimpan di Ruang Arsip." : "Menunggu penghitungan ulang dan berita acara dari MPD.")});`);
}

// Additional well-known legal references (all left "belum terverifikasi" for the Notaris to check).
const LEGAL = [
  ["undang_undang", "UU 16/2001", "Undang-Undang Nomor 16 Tahun 2001 tentang Yayasan", 2001, "diubah"],
  ["undang_undang", "UU 28/2004", "Undang-Undang Nomor 28 Tahun 2004 tentang Perubahan atas Undang-Undang Nomor 16 Tahun 2001 tentang Yayasan", 2004, "berlaku"],
  ["undang_undang", "UU 25/1992", "Undang-Undang Nomor 25 Tahun 1992 tentang Perkoperasian", 1992, "berlaku"],
  ["undang_undang", "UU 1/1974", "Undang-Undang Nomor 1 Tahun 1974 tentang Perkawinan", 1974, "diubah"],
  ["undang_undang", "UU 11/2008", "Undang-Undang Nomor 11 Tahun 2008 tentang Informasi dan Transaksi Elektronik", 2008, "diubah"],
  ["undang_undang", "UU 8/2010", "Undang-Undang Nomor 8 Tahun 2010 tentang Pencegahan dan Pemberantasan Tindak Pidana Pencucian Uang", 2010, "berlaku"],
  ["undang_undang", "UU 6/2023", "Undang-Undang Nomor 6 Tahun 2023 tentang Penetapan Peraturan Pemerintah Pengganti Undang-Undang Nomor 2 Tahun 2022 tentang Cipta Kerja menjadi Undang-Undang", 2023, "berlaku"],
  ["peraturan_pemerintah", "PP 24/2016", "Peraturan Pemerintah Nomor 24 Tahun 2016 tentang Perubahan atas Peraturan Pemerintah Nomor 37 Tahun 1998 tentang Peraturan Jabatan Pejabat Pembuat Akta Tanah", 2016, "berlaku"],
  ["peraturan_pemerintah", "PP 18/2021", "Peraturan Pemerintah Nomor 18 Tahun 2021 tentang Hak Pengelolaan, Hak Atas Tanah, Satuan Rumah Susun, dan Pendaftaran Tanah", 2021, "berlaku"],
  ["peraturan_pemerintah", "PP 43/2015", "Peraturan Pemerintah Nomor 43 Tahun 2015 tentang Pihak Pelapor dalam Pencegahan dan Pemberantasan Tindak Pidana Pencucian Uang", 2015, "diubah"],
  ["peraturan_presiden", "Perpres 13/2018", "Peraturan Presiden Nomor 13 Tahun 2018 tentang Penerapan Prinsip Mengenali Pemilik Manfaat dari Korporasi dalam rangka Pencegahan dan Pemberantasan Tindak Pidana Pencucian Uang dan Tindak Pidana Pendanaan Terorisme", 2018, "berlaku"],
];
for (const [cat, num, title, year, st] of LEGAL) {
  sql(`  if not exists (select 1 from public.legal_references where tenant_id = v_tenant and number_label = ${q(num)}) then
    insert into public.legal_references (category, number_label, title, year, status) values (${q(cat)}, ${q(num)}, ${q(title)}, ${year}, ${q(st)});
  end if;`);
}
sql(`  insert into public.legal_bookmarks (user_id, reference_id)
  select u, r.id from public.legal_references r cross join unnest(array[v_notaris, v_staf]) u
   where r.tenant_id = v_tenant and r.number_label in ('UU 2/2014', 'UU 40/2007', 'PP 24/1997', 'UU 27/2022')
  on conflict do nothing;
  perform set_config('request.jwt.claims', '', true);
end $seed$;
drop schema verity_seed cascade;`);

// ─── Run ───
const work = mkdtempSync(join(tmpdir(), "verity-seed-"));
const file = join(work, "seed.sql");
writeFileSync(file, `${(await import("node:fs")).readFileSync(join(here, "helpers.sql"), "utf8")}\n${out.join("\n")}\n`);
if (opt("--sql-out")) { writeFileSync(opt("--sql-out"), (await import("node:fs")).readFileSync(file)); console.log(`SQL ditulis ke ${opt("--sql-out")}`); process.exit(0); }
const cli = (...a) => execFileSync("supabase", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
console.log(`Seeding ${cases.length} berkas, ${cases.reduce((n, c) => n + c.akta.length, 0)} akta (${finals.length} final), ${persons.length} orang, ${COMPANIES.length} badan usaha…`);
// psql for the local stack (the CLI drops errors of large scripts); the Management API for --linked.
const PSQL = ["/opt/homebrew/opt/postgresql@17/bin/psql", "/usr/bin/psql"].find((p) => { try { execFileSync(p, ["--version"]); return true; } catch { return false; } });
try {
  if (args.includes("--files-only")) { /* data already seeded: only upload missing files */ }
  else if (target === "--local" && PSQL) {
    execFileSync(PSQL, ["postgresql://postgres:postgres@127.0.0.1:54322/postgres", "-v", "ON_ERROR_STOP=1", "-1", "-q", "-f", file],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } else {
    const r = cli("db", "query", target, "-f", file);
    if (/error/i.test(r) && !/"rows"/.test(r)) throw Object.assign(new Error(r), { stdout: r });
  }
} catch (e) {
  console.error((e.stderr || e.stdout || String(e)).toString().slice(0, 2000));
  rmSync(work, { recursive: true, force: true });
  process.exit(1);
}

// ─── Files: a small generated file for each seeded document without a stored object ───
const res = JSON.parse(cli("db", "query", target,
  `select d.storage_path, d.mime_type, d.title from public.documents d
    where not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = d.storage_path)`));
const rows = res.rows ?? res;
const root = join(work, "files");
for (const r of rows) {
  const path = join(root, r.storage_path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, r.mime_type === "image/png" ? png(r.title) : pdf(r.title));
}
console.log(`Uploading ${rows.length} files…`);
// One `storage cp` per file to the exact recorded path (a recursive copy nests the folder name).
const { execFile } = await import("node:child_process");
const upload = (r) => new Promise((resolve) => execFile("supabase",
  ["storage", "cp", target, "--experimental", "--content-type", r.mime_type === "image/png" ? "image/png" : "application/pdf",
   join(root, r.storage_path), `ss:///documents/${r.storage_path}`],
  { encoding: "utf8" }, (err, _o, stderr) => resolve(err ? `${r.storage_path}: ${stderr || err.message}` : null)));
const failures = [];
for (let i = 0; i < rows.length; i += 8) {
  failures.push(...(await Promise.all(rows.slice(i, i + 8).map(upload))).filter(Boolean));
  process.stdout.write(`\r  ${Math.min(i + 8, rows.length)}/${rows.length}`);
}
process.stdout.write("\n");
if (failures.length) console.error(`${failures.length} file gagal diunggah:\n${failures.slice(0, 5).join("\n")}`);
if (!args.includes("--keep")) rmSync(work, { recursive: true, force: true }); else console.log(`Berkas kerja: ${work}`);
console.log("Selesai.");

// Minimal one-page PDF stating the document is a synthetic sample.
function pdf(title) {
  const text = (s) => s.replace(/[()\\]/g, " ").replace(/[^\x20-\x7E]/g, "-");
  const stream = `BT /F1 16 Tf 60 760 Td (${text(title)}) Tj 0 -28 Td /F1 11 Tf (DOKUMEN CONTOH - DATA FIKTIF UNTUK DEMO VERITY) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

// Small grey card-shaped PNG (no real identity data).
function png() {
  const w = 320, h = 200;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = y * (w * 3 + 1) + 1 + x * 3;
      const border = x < 6 || y < 6 || x >= w - 6 || y >= h - 6;
      const photo = x > 230 && x < 300 && y > 40 && y < 150;
      const line = x > 24 && x < 200 && (y % 24 > 14 && y % 24 < 20) && y > 50 && y < 170;
      const v = border ? 120 : photo ? 175 : line ? 150 : 222;
      raw[i] = v; raw[i + 1] = v + (border ? 20 : 8); raw[i + 2] = v + (border ? 40 : 14);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return crc ^ 0xffffffff;
}
