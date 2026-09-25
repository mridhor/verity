# PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Produk:** Verity, sistem kerja internal berbasis agen AI untuk kantor Notaris/PPAT dan firma hukum non-litigasi
**Versi:** 1.0
**Dokumen terkait:** `docs/TRD.md` (v1.2), `docs/design/berkas-workspace.jsx` (mockup arah desain)
**Status:** Draft untuk ditinjau notaris dan partner. Butir bertanda **[KEPUTUSAN]** harus diputuskan sebelum rilis 1 dimulai.

---

## 1. Ringkasan

Kantor notaris dan firma non-litigasi mengerjakan transaksi yang berulang dan padat dokumen: pendirian PT, AJB, waris, fidusia, review kontrak. Hari ini pekerjaan itu tersebar di folder, spreadsheet, WhatsApp, dan buku register manual.

Verity menyatukan semua itu dalam **Berkas**: satu ruang kerja per pekerjaan klien, dengan agen AI yang membaca data kantor, menjawab dengan sumber, menyiapkan draf dari template kantor, dan mengusulkan perubahan yang diputuskan oleh manusia.

## 2. Masalah

1. **Pemeriksaan dokumen manual dan rawan salah.** Ketidakcocokan nama, alamat, atau NIK antara KTP, formulir intake, dan sertifikat sering baru ketahuan saat penandatanganan atau saat ditolak AHU/BPN.
2. **Drafting berulang.** Draf disusun dengan menyalin akta lama, sehingga klausul usang dan data pihak sebelumnya ikut terbawa.
3. **Status dan tenggat tidak terlihat.** Sulit menjawab "berkas mana yang tenggat AHU-nya minggu ini?" tanpa menanyai staf satu per satu.
4. **Register terpisah dari pekerjaan.** Repertorium dan klapper diisi terpisah dari data akta, sehingga bisa tidak sinkron.
5. **Alat AI umum tidak bisa dipakai.** Tidak mengenal data kantor, tidak memberi sumber, dan menimbulkan risiko kerahasiaan.

## 3. Tujuan dan non-tujuan

**Tujuan rilis 1**

1. Semua pekerjaan aktif tercatat sebagai berkas, dengan pihak, dokumen, status akta, checklist, dan tenggat di satu tempat.
2. Staf dapat bertanya kepada agen tentang isi berkas dan database kantor, dan setiap jawaban memuat sumber yang bisa diklik.
3. Ketidakcocokan data antar dokumen terdeteksi otomatis sebelum draf akta dikirim ke notaris.
4. Tidak ada perubahan pada system of record yang terjadi tanpa persetujuan manusia yang berhak.
5. Repertorium dan klapper terbentuk otomatis dari data akta.

**Non-tujuan rilis 1**

- Portal atau akses untuk klien.
- Integrasi otomatis ke AHU, OSS, BPN, atau DJP (tetap manual; sistem hanya melacak).
- Tanda tangan elektronik akta.
- Pekerjaan litigasi.
- Penjualan sebagai SaaS ke kantor lain (skema tetap disiapkan multi-tenant, lihat TRD).

## 4. Pengguna dan peran

| Peran | Siapa | Kebutuhan utama | Hak khusus |
| --- | --- | --- | --- |
| Notaris/PPAT | Pejabat yang bertanggung jawab atas akta | Meninjau draf dengan cepat, yakin data benar, melihat semua berkas | Menyetujui perubahan draf akta, status akta, dan register; memfinalkan dan memberi nomor akta |
| Partner | Advokat senior firma non-litigasi | Review kontrak, supervisi associate | Menyetujui perubahan pada berkas firma |
| Associate | Advokat/konsultan | Drafting dan riset dengan sumber | Menyetujui perubahan administratif pada berkasnya |
| Staf administrasi | Intake, dokumen, jadwal | Mengumpulkan dokumen, tahu apa yang kurang, melacak tenggat | Menyetujui perubahan administratif (checklist, jadwal) pada berkasnya |
| Super Admin | Pengelola sistem | Mengatur pengguna, peran, keanggotaan berkas, audit | Tidak otomatis dapat menyetujui perubahan akta |

Akses data ditentukan oleh keanggotaan berkas. Notaris melihat semua berkas di kantornya; peran lain hanya berkas tempat mereka ditugaskan.

## 5. Prinsip produk

1. **Berkas adalah pusat.** Semua hal, termasuk percakapan dengan agen, terjadi di dalam konteks berkas.
2. **Agen mengusulkan, manusia memutuskan.** Agen tidak pernah mengubah data secara langsung.
3. **Tanpa sumber, tidak dipakai.** Setiap klaim faktual dari agen bisa ditelusuri ke dokumen atau record.
4. **Register adalah kebenaran hukum.** Repertorium, klapper, dan protokol tidak bisa diubah; koreksi selalu berupa entri baru.
5. **Keyakinan ditampilkan, bukan disembunyikan.** Ketika sistem ragu (jenis dokumen, tingkat risiko, keterlandasan jawaban), keraguan itu terlihat dan diteruskan ke manusia.
6. **Pengetahuan hukum diverifikasi manusia.** Tenggat dan aturan berbasis peraturan tidak berlaku sebelum diverifikasi notaris.
7. **Tenang secara visual.** Warna aksen (ungu cap notaris) hanya untuk hal yang berotoritas: sitasi, persetujuan, langkah aktif.

## 6. Lingkup per rilis

| Rilis | Isi | Hasil yang bisa diperiksa |
| --- | --- | --- |
| R1 | Berkas, pihak, akta dan siklus statusnya, dokumen dan ekstraksi, Vault tabular, agen baca-saja dengan sitasi, usulan perubahan dan persetujuan, register, audit log | Satu berkas pendirian PT dan satu AJB bisa dikerjakan dari intake sampai akta final sepenuhnya di sistem |
| R2 | Editor draf akta (Lexical) dengan saran AI sebagai track changes, template berversi, workflow dan checklist per jenis berkas, aturan tenggat terverifikasi, Beranda dengan antrian persetujuan | Draf akta pendirian PT disusun dari template kantor dan diekspor ke `.docx` dalam format kantor |
| R3 | Review kontrak, riset hukum dari pustaka peraturan, pemantauan perubahan regulasi, analitik penggunaan | Associate dapat mereview kontrak terhadap playbook kantor dengan sitasi per klausul |

Jenis berkas prioritas untuk R1 **[KEPUTUSAN]**: usulan awal Pendirian PT dan AJB, karena volumenya tinggi dan alurnya paling terdefinisi.

## 7. Kebutuhan fungsional

Setiap kebutuhan ditulis sebagai cerita pengguna dengan kriteria penerimaan.

### 7.1 Berkas

**PRD-B-01.** Sebagai staf, saya membuat berkas baru dengan memilih jenisnya, sehingga workflow, checklist, dan dokumen wajib muncul otomatis.
- Berkas memiliki jenis, klien, penanggung jawab, anggota, dan status.
- Checklist awal dibentuk dari template workflow jenis tersebut (R2); pada R1 checklist boleh manual.

**PRD-B-02.** Sebagai notaris, saya membuka satu berkas dan melihat seluruh konteksnya dalam tiga panel: navigasi, percakapan/tab, dan penampil dokumen.
- Tab: Percakapan, Dokumen, Checklist, Aktivitas.
- Kepala berkas menampilkan nomor akta (jika ada), klien, penanggung jawab, dan tenggat terdekat.
- Langkah workflow ditampilkan berurutan dengan langkah aktif ditandai.

**PRD-B-03.** Sebagai staf, saya menambahkan pihak (penghadap, pihak kedua, kuasa, saksi) yang terhubung ke data orang atau badan usaha yang sudah ada, sehingga data tidak diketik ulang.
- Pencarian berdasarkan nama, NIK, atau NIB.
- Jika orang yang sama sudah ada, sistem menyarankan menghubungkan, bukan membuat duplikat.

### 7.2 Agen

**PRD-A-01.** Sebagai pengguna, saya bertanya dalam bahasa sehari-hari tentang berkas atau database kantor dan mendapat jawaban dengan sitasi yang bisa diklik.
- Klik sitasi membuka dokumen di panel kanan dan menyorot bagian yang dikutip.
- Jika informasi tidak ada di berkas, agen mengatakan tidak ada, bukan menebak.
- Langkah yang dijalankan agen (dokumen yang dibaca, query yang dijalankan) bisa dilihat.
- Klaim yang tidak terverifikasi terlandas pada sumbernya ditandai, bukan disembunyikan.

**PRD-A-02.** Sebagai staf, saya meminta agen memeriksa kelengkapan dan konsistensi dokumen berkas, dan hasilnya berupa tabel per pihak dengan catatan ketidakcocokan.
- Ketidakcocokan menyebut kedua sumber yang berbeda, masing-masing dengan sitasi.
- Tingkat keparahan ditampilkan: menghalangi penandatanganan, perlu dikonfirmasi, atau informatif.

**PRD-A-03.** Sebagai pengguna, ketika agen perlu mengubah data, saya melihat kartu "Perubahan yang diusulkan" berisi daftar perubahan yang jelas dan tombol setujui/tolak.
- Pengguna tanpa hak melihat usulan tetapi tombol persetujuan tidak aktif, dengan keterangan peran yang dibutuhkan.
- Setelah disetujui, perubahan diterapkan, dicatat di Aktivitas dan audit log, dan kartu menampilkan cap persetujuan dengan nama dan waktu.
- Setelah ditolak, tidak ada perubahan dan agen diberi tahu penolakannya.
- Usulan yang dinilai berisiko tinggi ditandai dan selalu membutuhkan peran tertinggi yang relevan, berapa pun penilaian otomatisnya.

**PRD-A-04.** Sebagai notaris, saya yakin agen tidak bisa memfinalkan, memberi nomor, menandatangani, atau mengirim akta ke luar sistem dalam kondisi apa pun.

**PRD-A-05.** Sebagai pengguna, saya tidak pernah melihat data dari berkas yang bukan milik saya melalui agen, termasuk lewat pertanyaan tidak langsung.

### 7.3 Dokumen dan Vault

**PRD-D-01.** Sebagai staf, saya mengunggah pindaian atau file (KTP, KK, NPWP, sertifikat, akta lama, surat kuasa), dan sistem mengenali jenis dokumennya.
- Jenis dokumen ditampilkan dengan tingkat keyakinan; bila keyakinan di bawah ambang, staf diminta memilih jenisnya.

**PRD-D-02.** Sebagai staf, saya melihat hasil ekstraksi data dari dokumen dan memverifikasinya sebelum dipakai.
- Setiap field punya status: belum diverifikasi, terverifikasi, dikoreksi.
- Field yang tidak terbaca ditampilkan kosong dengan alasannya, bukan diisi tebakan.
- Hanya field terverifikasi yang boleh mengisi draf akta.

**PRD-D-03.** Sebagai staf, saya membuka Vault dan melihat banyak dokumen sekaligus dalam tabel (satu baris per dokumen) dengan kolom hasil ekstraksi dan penanda ketidakcocokan.

### 7.4 Editor draf akta (R2)

**PRD-E-01.** Sebagai associate atau staf, saya menyusun draf dari template kantor, dan data pihak dalam draf terhubung ke data terverifikasi, bukan teks bebas.
- Data pihak tampil sebagai elemen terkunci di editor; mengubahnya dilakukan di data pihak (lewat persetujuan), lalu draf yang belum final ikut diperbarui.
- Draf mencatat versi template yang dipakai.

**PRD-E-02.** Sebagai notaris, saya melihat saran agen pada draf sebagai track changes dan menerima atau menolak per saran.

**PRD-E-03.** Sebagai notaris, saya mengekspor draf atau akta final ke `.docx` dan `.pdf` dengan format kantor (margin, huruf, penomoran pasal, pengisian ruang kosong) yang ditetapkan per template.

### 7.5 Workflow, checklist, dan tenggat (R2)

**PRD-W-01.** Setiap berkas memiliki langkah berurutan dengan penanggung jawab, dokumen wajib, dan tenggat.

**PRD-W-02.** Sebagai notaris, saya memverifikasi aturan tenggat berbasis peraturan sebelum berlaku; aturan yang belum diverifikasi tampil dengan tanda "belum terverifikasi".

**PRD-W-03.** Agen dapat mengusulkan item checklist baru dari isi dokumen (misalnya dokumen yang kurang), yang masuk ke checklist setelah disetujui.

### 7.6 Knowledge (R2)

**PRD-K-01.** Sebagai notaris, saya mengelola template akta berversi dan klausul standar; draf yang ada tidak berubah ketika template diperbarui.

**PRD-K-02.** Sebagai pengguna, saya mencari peraturan dan putusan di pustaka hukum dengan metadata (jenis, nomor, tahun, status berlaku).

### 7.7 Register

**PRD-R-01.** Repertorium, klapper, dan daftar protokol terbentuk otomatis dari data akta dan pihak.

**PRD-R-02.** Entri register tidak bisa diubah atau dihapus oleh siapa pun; koreksi dilakukan dengan entri baru yang merujuk entri lama.

**PRD-R-03.** Nomor akta diberikan hanya saat finalisasi, berurutan per tahun, dan tidak pernah dipakai ulang.

### 7.8 Beranda, admin, dan audit

**PRD-H-01.** Beranda menampilkan kotak perintah untuk bertanya atau memulai pekerjaan, berkas terbaru, usulan yang menunggu persetujuan saya, dan tenggat terdekat.

**PRD-H-02.** Super Admin mengelola pengguna, peran, dan keanggotaan berkas, dan melihat audit log yang tidak bisa diubah.

**PRD-H-03.** Notaris dapat melihat siapa (manusia atau agen) membaca dokumen apa dan kapan, untuk setiap berkas.

## 8. Kebutuhan non-fungsional (ringkas)

Detail di TRD. Yang harus dipahami semua pihak:

- Kerahasiaan: data klien dilindungi kewajiban kerahasiaan jabatan dan UU PDP. Lokasi penyimpanan dan pemrosesan data **[KEPUTUSAN]** harus disetujui penasihat hukum sebelum R1.
- Setiap layanan AI pihak ketiga yang menerima isi dokumen (LLM, OCR, embedding, model keputusan) harus memiliki jaminan tertulis tanpa retensi dan tanpa pelatihan, dan tercatat sebagai pemroses data.
- UI berbahasa Indonesia; berfungsi di layar laptop kantor (≥ 1280 px); tampilan ponsel untuk membaca dan menyetujui saja.
- Aksesibilitas dasar: navigasi keyboard, fokus terlihat, kontras memadai.

## 9. Metrik keberhasilan

Baseline diukur pada 4 minggu pertama sebelum sistem dipakai penuh; target ditetapkan setelah baseline.

| Metrik | Cara ukur |
| --- | --- |
| Waktu intake sampai draf siap review | Selisih waktu status di berkas |
| Ketidakcocokan data yang ditemukan sebelum vs sesudah penandatanganan | Catatan koreksi akta dan temuan agen |
| Proporsi jawaban agen dengan sitasi valid dan terlandas | Validasi server dan sampling manual mingguan |
| Tenggat yang terlewat | Aturan tenggat vs tanggal pengajuan |
| Adopsi | Pengguna aktif mingguan per peran; berkas yang dikerjakan di sistem |
| Perubahan tanpa persetujuan | Harus nol; diperiksa dari audit log |

## 10. Asumsi dan risiko

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Staf tetap bekerja di luar sistem | Data tidak lengkap, agen tidak berguna | Mulai dari dua jenis berkas; Beranda dan checklist jadi tempat kerja harian |
| Kualitas OCR dokumen Indonesia rendah | Ekstraksi salah | Verifikasi manusia wajib; evaluasi OCR pada dokumen nyata sebelum memilih vendor |
| Agen memberi jawaban yang terdengar benar tapi salah | Kesalahan hukum | Sitasi wajib, pemeriksaan keterlandasan, agen tidak bisa menulis |
| Residensi data tidak sesuai UU PDP | Risiko hukum dan reputasi | Keputusan region sebelum R1, dengan konsultasi hukum |
| Vendor AI yang sangat baru berubah harga, perilaku, atau berhenti | Fitur berhenti atau berubah perilaku | Semua model di belakang antarmuka yang bisa diganti, dengan fallback ke LLM utama |
| Format akta hasil ekspor tidak sesuai kebiasaan kantor | Draf tidak dipakai | Format sebagai parameter template, divalidasi notaris dengan contoh akta nyata |

## 11. Pertanyaan terbuka

1. Satu notaris atau beberapa notaris/PPAT dalam satu kantor? Ini menentukan penomoran dan register.
2. Apakah ada data lama (spreadsheet, aplikasi lama, pindaian repertorium) yang harus dimigrasikan pada R1?
3. Apakah template akta kantor tersedia dalam `.docx` yang bisa diimpor?
4. Siapa yang memverifikasi aturan tenggat dan format akta, dan berapa lama waktunya?
5. Apakah pekerjaan firma non-litigasi dan kantor notaris berbagi klien dan data, atau harus dipisah ketat?