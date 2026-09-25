# TECHNICAL REQUIREMENTS DOCUMENT (TRD)

**Nama Proyek:** NotarisDigital, sistem agentic AI internal untuk kantor Notaris/PPAT dan firma hukum non-litigasi
**Versi:** 1.2
**Dokumen terkait:** `docs/PRD.md` (v1.0), `docs/design/berkas-workspace.jsx`
**Tipe Arsitektur:** Decoupled polyglot (TypeScript frontend + Python AI engine)
**Status:** Draft untuk ditinjau. Butir bertanda **[KEPUTUSAN]** harus diputuskan sebelum implementasi.

---

## 0. Riwayat perubahan

### v1.2 (dari v1.1)

| Area | v1.1 | v1.2 | Alasan |
| --- | --- | --- | --- |
| TypeSafe AI / Jev | Dianggap tidak dapat diverifikasi, diganti Pydantic | **Dipakai sebagai lapisan keputusan** (routing, klasifikasi, gating, verifikasi keterlandasan). Validasi skema tetap Pydantic | Jev ternyata model nyata dari TypeSafe AI (rilis early access 15 Sep 2026), tetapi fungsinya adalah model keputusan bertipe (Choice, Score, Noul) dengan probabilitas terkalibrasi, bukan validator skema output LLM seperti yang ditulis di v1.0 |
| Editor | Tiptap | **Lexical** | Keputusan pemilik produk. Konsekuensi teknis dijelaskan di §3.1 |

### v1.1 (dari v1.0)

| Area | v1.0 | v1.1 |
| --- | --- | --- |
| Model bisnis | SaaS B2B multi-tenant | Internal satu kantor, skema siap multi-tenant **[KEPUTUSAN]** |
| Kontrol akses | Isolasi per tenant | Per tenant **dan** per berkas (membership) |
| Sumber `tenant_id` | Header permintaan | Klaim JWT, diverifikasi server |
| Akses DB AI engine | Tidak diatur | JWT pengguna; `service_role` hanya untuk worker sistem yang terdefinisi sempit |
| Vector DB privat | Pinecone | pgvector di Supabase (RLS berlaku); Pinecone opsional untuk korpus publik |
| Model LLM | Nama model dikunci di TRD | Lapisan abstraksi; model dipilih dari katalog terkini |
| HITL | Hanya draf final | Semua penulisan oleh agen lewat `ProposedChange` |
| Register & audit | Tidak ada | Append-only |
| Sitasi | Tidak ada | Wajib, divalidasi server |
| Kriteria ekstraksi | "100% tanpa null" | Skema valid; `null` + alasan diperbolehkan; verifikasi manusia |
| TTFT | 1,5 dtk token pertama | 1,5 dtk event pertama; target terpisah untuk token teks |
| Format `.docx` | Hardcode | Parameter template, diverifikasi notaris |

---

## 1. Lingkup

Platform internal untuk staf kantor Notaris/PPAT dan firma non-litigasi, tanpa akses klien pada rilis pertama. Kebutuhan produk, peran, dan lingkup rilis ada di PRD. TRD ini menetapkan cara membangunnya.

---

## 2. Stack & komponen

| Layer | Teknologi | Fungsi & catatan |
| --- | --- | --- |
| Frontend UI | Next.js 15 (App Router), TailwindCSS, shadcn/ui | Tema mengikuti mockup (§8). Konsumsi SSE |
| Editor dokumen | Lexical (`lexical`, `@lexical/react`, `@lexical/mark`, `@lexical/yjs` bila kolaborasi) | Lihat §3.1 untuk node kustom, track changes, dan ekspor |
| Edge | Cloudflare (WAF, DDoS, rate limit) | Meneruskan SSE; bukan satu-satunya titik validasi auth |
| Auth & DB | Supabase (PostgreSQL, Auth, Storage) | RLS untuk tenant dan membership berkas. Region **[KEPUTUSAN]** |
| Vector privat | pgvector di Supabase + full-text Postgres | Chunk per anchor dokumen; RLS sama dengan tabel dokumen |
| Vector publik | pgvector atau Pinecone **[KEPUTUSAN]** | Hanya korpus peraturan/putusan publik, tanpa data klien |
| AI engine | Python 3.11+, FastAPI, LangGraph | Orkestrasi, interrupt HITL, checkpoint Postgres |
| LLM (generatif) | Provider enterprise dengan ZDR, di belakang lapisan abstraksi **[KEPUTUSAN]** | Menjawab, menyusun draf, ekstraksi field. Model dipilih dari katalog terkini dan dicatat di konfigurasi |
| Model keputusan | Jev (TypeSafe AI), via API TypeSafe atau OpenRouter **[KEPUTUSAN]** | Klasifikasi, routing, gating, verifikasi. Lihat §3.4 |
| Validasi skema | Pydantic v2 (Python), Zod (TS), skema tunggal via JSON Schema | Untuk output LLM generatif yang mengisi DB atau struktur dokumen |
| OCR & parsing | **[KEPUTUSAN]** | Dievaluasi pada dokumen Indonesia nyata sebelum dipilih |
| Job queue | Worker Python (Celery/RQ/Arq) | OCR, ekstraksi, embedding, klasifikasi batch |

---

## 3. Persyaratan fungsional

### 3.1 Frontend & editor (Lexical)

- **REQ-FE-01 (SSE):** Menampilkan langkah agen dan teks secara bertahap; stream dapat dilanjutkan setelah koneksi putus.
- **REQ-FE-02 (Berkas Workspace):** Tiga panel sesuai mockup. Klik sitasi membuka dokumen dan menyorot anchor.
- **REQ-FE-03 (Vault tabular):** Satu baris per dokumen, kolom hasil ekstraksi, penanda ketidakcocokan dan tingkat keparahannya.
- **REQ-FE-04 (Antrian persetujuan):** Beranda menampilkan `ProposedChange` yang menunggu pengguna sesuai perannya.
- **REQ-ED-01 (Node akta kustom):** Lexical tidak menyediakan struktur akta; bangun node kustom minimal:
  - `PasalNode` (nomor pasal otomatis, judul, subjudul) dengan penomoran bertingkat.
  - `PartyFieldNode`: elemen inline terkunci yang merender data pihak (nama, NIK, alamat, dsb.) dari `ExtractedField` terverifikasi. Tidak dapat diedit sebagai teks; perubahan hanya lewat data pihak.
  - `ClauseNode`: blok klausul yang merujuk `Clause` dan versi template asalnya.
- **REQ-ED-02 (Track changes):** Lexical tidak memiliki track changes bawaan. Implementasikan node `SuggestionInsertNode` dan `SuggestionDeleteNode` (atau mark kustom) yang membawa `proposed_change_id`, penulis (agen/manusia), dan waktu. Terima/tolak per saran memanggil API persetujuan; editor tidak mengubah draf final secara lokal tanpa persetujuan server.
- **REQ-ED-03 (Sorotan sitasi & komentar):** Gunakan `@lexical/mark` untuk menandai rentang yang dikutip agen dan komentar reviewer.
- **REQ-ED-04 (Penyimpanan):** Sumber kebenaran draf adalah JSON `EditorState` Lexical yang diserialisasi dan berversi di Postgres, bukan HTML.
- **REQ-ED-05 (Ekspor .docx/.pdf):** Lexical tidak mengekspor `.docx`. Ekspor dilakukan di server dari JSON `EditorState` ke `.docx` (mis. `python-docx` di AI engine atau pustaka `docx` di Node) memakai parameter format per template (margin, huruf, penomoran pasal, pengisian ruang kosong) yang diverifikasi notaris. PDF dihasilkan dari `.docx` yang sama agar identik. Akta final hanya diekspor dari akta berstatus final.
- **REQ-ED-06 (Impor):** Template kantor dalam `.docx` diimpor lewat konversi HTML ke node Lexical, lalu ditinjau manual; hasil impor tidak langsung dipakai.
- **REQ-ED-07 (Kolaborasi):** Jika dibutuhkan penyuntingan bersamaan **[KEPUTUSAN]**, gunakan `@lexical/yjs`; saran agen tetap lewat mekanisme REQ-ED-02, bukan menulis langsung ke dokumen Yjs.

### 3.2 Gateway & autentikasi

- **REQ-GW-01:** JWT Supabase divalidasi di edge dan di FastAPI.
- **REQ-GW-02:** Rate limit per pengguna dan per tenant (awal 60 req/menit per pengguna, dapat dikonfigurasi); batas terpisah untuk endpoint agen.
- **REQ-GW-03:** `tenant_id`, `user_id`, dan peran diambil dari klaim JWT, tidak dari header klien.
- **REQ-GW-04:** AI engine mengakses Supabase dengan JWT pengguna yang meminta sehingga RLS berlaku. `service_role` hanya untuk worker sistem, operasi terdefinisi sempit, tercatat di audit log.
- **REQ-GW-05:** 2FA wajib untuk Notaris, Partner, dan Admin.

### 3.3 AI engine & workflow agen

- **REQ-AI-01 (Routing):** Permintaan dipilah ke: tanya-jawab berkas/SoR, pemeriksaan dan ekstraksi dokumen, drafting dari template, review kontrak, riset hukum. Klasifikasi routing memakai Jev (§3.4); jika confidence di bawah ambang, fallback ke LLM utama atau minta klarifikasi pengguna. Rilis pertama boleh memakai satu agen dengan banyak tool.
- **REQ-AI-02 (HITL untuk semua penulisan):** Agen tidak pernah menulis langsung ke SoR. Setiap mutasi menjadi `ProposedChange` berisi diff terstruktur. LangGraph `interrupt()` menghentikan graf sampai ada keputusan; keputusan disimpan di tabel `approvals` lalu diterapkan dalam satu transaksi DB.
- **REQ-AI-03 (Matriks persetujuan):** Staf menyetujui perubahan administratif. Hanya Notaris (akta) atau Partner (firma) yang menyetujui perubahan draf akta, status akta, dan register. Agen tidak pernah memfinalkan, memberi nomor, menandatangani, atau mengirim ke luar sistem. Skor risiko dari Jev hanya bisa **menaikkan** persyaratan persetujuan, tidak pernah menurunkannya atau melewati persetujuan.
- **REQ-AI-04 (State persistence):** Checkpoint LangGraph di Postgres, dilindungi RLS, dengan kebijakan retensi, diperlakukan sebagai data pribadi.
- **REQ-AI-05 (Validasi skema output generatif):** Output LLM yang mengisi DB atau struktur dokumen divalidasi Pydantic, retry dengan pesan error maksimal N kali, lalu gagal eksplisit. Tidak ada default diam-diam.
- **REQ-AI-06 (Sitasi):** Setiap klaim faktual memuat sitasi ke `document_anchor` atau record ID. Server memeriksa (a) anchor ada, (b) pengguna berhak mengaksesnya, dan (c) klaim terlandas pada isi anchor (§3.4, pola verifikasi). Sitasi gagal (a) atau (b) dihapus; gagal (c) ditandai di UI.
- **REQ-AI-07 (Tool set minimum):** `search_berkas`, `get_berkas`, `list_documents`, `read_document`, `search_documents`, `query_register`, `search_knowledge`, `get_template`, `compare_fields`, `draft_from_template` (menghasilkan proposal), `propose_changes`. Setiap tool memeriksa izin secara independen.

### 3.4 Lapisan keputusan (Jev)

**Apa Jev.** Jev adalah model keputusan dari TypeSafe AI. Model ini tidak menghasilkan teks; ia menerima `state` (teks atau JSON) dan pertanyaan bertipe, lalu mengembalikan jawaban bertipe dengan probabilitas. Tiga tipe pertanyaan: **Choice** (pilih satu dari opsi tetap), **Score** (tingkat pada skala berurutan, maks. 10 level), **Noul** (probabilitas pernyataan ya/tidak benar). Banyak pertanyaan dapat dijawab dalam satu permintaan.

**Penggunaan yang ditetapkan**

| ID | Kegunaan | Tipe | Input `state` | Tindakan sistem |
| --- | --- | --- | --- | --- |
| DEC-01 | Routing permintaan ke alur agen | Choice | Pesan pengguna + ringkasan berkas | Pilih alur; di bawah ambang → LLM utama atau klarifikasi |
| DEC-02 | Klasifikasi jenis dokumen hasil OCR (KTP, KK, NPWP, SHM/SHGB, akta, surat kuasa, lainnya) | Choice | Teks OCR | Isi jenis dokumen; di bawah ambang → minta staf memilih |
| DEC-03 | Tingkat keparahan ketidakcocokan antar dokumen | Score | Dua nilai field + konteks field | Tampilkan keparahan; level tertinggi memblokir langkah penandatanganan sampai diselesaikan |
| DEC-04 | Risiko `ProposedChange` | Score + Noul | Diff terstruktur + konteks berkas | Hanya menaikkan persyaratan persetujuan (REQ-AI-03) |
| DEC-05 | Keterlandasan klaim terhadap sumber | Noul | Klaim + teks anchor yang dikutip | Tandai klaim yang tidak terlandas di UI |
| DEC-06 | Gating tool call sebelum eksekusi (terutama tool yang mengambil data lintas berkas) | Noul | Permintaan pengguna + rencana tool call | Blokir di bawah ambang dan catat di audit log; tidak menggantikan pemeriksaan izin RLS |

**Batasan yang harus dihormati**

- Jev hanya menerima teks. Dokumen pindaian harus melewati OCR lebih dulu.
- Jev tidak melakukan aritmatika pasti, perhitungan tanggal, atau perbandingan ambang. Tenggat, selisih tanggal, dan perbandingan nominal dihitung di kode.
- Jev tidak menghasilkan teks, tidak memanggil tool, dan tidak menggantikan LLM untuk ekstraksi nilai field, jawaban, atau drafting.
- Batas `state` sekitar 32k token per permintaan; dokumen panjang dipotong per anchor.
- Probabilitas sedikit berbeda antar panggilan. Ambang ditetapkan sebagai pita (bertindak otomatis / tampilkan dengan tanda / serahkan ke manusia), bukan angka tunggal.
- Kalibrasi berlaku rata-rata; ambang setiap DEC ditetapkan dari set data berlabel milik kantor (target awal beberapa ratus contoh per DEC) sebelum diaktifkan.
- Confidence pada Choice/Score mengukur konsentrasi distribusi, bukan kebenaran jawaban.
- Hasil Jev tidak pernah menjadi satu-satunya dasar keputusan yang menyangkut akta, register, atau izin akses.

**Integrasi**

- Dipanggil dari node LangGraph atau middleware lewat klien TypeSafe (Python SDK, atau `langchain-typesafe`), di belakang antarmuka `DecisionProvider` agar bisa diganti.
- Fallback: jika Jev tidak tersedia atau gagal, gunakan LLM utama dengan structured output untuk pertanyaan yang sama, dan tandai hasilnya berasal dari fallback.
- Audit: catat ID permintaan, nama pertanyaan, probabilitas, ambang yang diterapkan, dan tindakan. **Jangan** mencatat `state` karena berisi data klien.
- Versi model di-pin (bukan alias `latest`) dan perubahan versi melalui evaluasi ulang ambang.

**Keputusan yang harus diambil sebelum mengaktifkan Jev [KEPUTUSAN]**

1. **Kepatuhan data.** Jev dirilis dalam early access pada 15 Sep 2026. Sebelum mengirim data klien, dapatkan secara tertulis ketentuan retensi, pelatihan, dan lokasi pemrosesan dari TypeSafe, dan dari OpenRouter bila jalur itu dipakai (OpenRouter menambah satu pemroses data). Sampai itu selesai, Jev hanya boleh dipakai pada data sintetis atau teranonimkan.
2. **Jalur akses.** API TypeSafe langsung (satu pemroses) atau OpenRouter (satu tagihan dengan model lain, tetapi pemroses tambahan).
3. **Ruang lingkup awal.** Usulan: mulai dengan DEC-01 dan DEC-02 (tidak memuat banyak PII sensitif setelah pemotongan state), lalu DEC-05 setelah evaluasi.

### 3.5 Retrieval

- **REQ-VEC-01 (Hybrid):** Dense embedding + pencarian leksikal (full-text Postgres untuk privat; sparse/BM25 untuk korpus publik).
- **REQ-VEC-02 (Isolasi):** Data privat difilter RLS (tenant + membership) di database. Korpus publik terpisah secara fisik. Hasil retrieval diperiksa ulang terhadap izin sebelum masuk konteks model.
- **REQ-VEC-03 (Chunk = anchor):** Chunk mengikuti anchor dokumen agar sitasi menunjuk lokasi nyata.
- **REQ-VEC-04 (Penghapusan):** Menghapus dokumen/berkas menghapus chunk dan embedding sesuai kebijakan retensi dan kewajiban penyimpanan protokol.

### 3.6 System of record & register

- **REQ-SOR-01:** Entitas inti: Berkas, Party, Person (NIK), Company (NIB), Akta dengan status Draft → Verifikasi → Menunggu TTD → Selesai → Diarsipkan.
- **REQ-SOR-02 (Penomoran):** Berurutan per notaris per tahun, tidak dipakai ulang, diberikan saat finalisasi di dalam transaksi dengan lock.
- **REQ-SOR-03 (Register append-only):** Repertorium, klapper, daftar protokol dibentuk dari SoR; UPDATE/DELETE ditolak lewat hak DB dan trigger.
- **REQ-SOR-04 (Audit log append-only):** Mencatat baca dokumen oleh agen, tool call, keputusan Jev, proposal, persetujuan/penolakan, dan penulisan manusia.
- **REQ-SOR-05 (Workflow & tenggat):** Aturan tenggat berbasis peraturan disimpan dengan rujukan peraturan dan kolom "diverifikasi oleh"; yang belum diverifikasi tampil sebagai belum terverifikasi.
- **REQ-SOR-06 (Knowledge):** Template akta berversi (JSON Lexical), klausul, SOP, pustaka peraturan. Draf mencatat versi template.

---

## 4. Alur data

```
[ Pengguna: pesan / unggah dokumen ]
        │
        ▼
[ Next.js + Lexical ] ──login──► [ Supabase Auth ] ──► JWT (tenant_id, user_id, role)
        │ (JWT)
        ▼
[ Cloudflare: WAF, rate limit, SSE ]
        │ (JWT)
        ▼
[ FastAPI: validasi JWT ulang ]
        │
        ├─► [ Worker ] OCR ─► Jev DEC-02 (jenis dokumen) ─► LLM ekstraksi ─► Pydantic ─► ExtractedField (belum diverifikasi)
        │
        └─► [ LangGraph ]  (semua akses data memakai JWT pengguna)
                │
                ├─► Jev DEC-01: routing
                ├─► retrieval privat (pgvector + full-text, RLS) / publik
                ├─► baca SoR (Postgres, RLS)
                ├─► LLM: jawaban / draf
                ├─► validasi sitasi: ada? berhak? ─► Jev DEC-05: terlandas?
                ├─► SSE ke UI
                │
                └─► mutasi? ─► ProposedChange ─► Jev DEC-04 (hanya menaikkan tingkat persetujuan) ─► interrupt()
                                         │
                                         ▼
                              [ UI: antrian persetujuan / track changes di Lexical ]
                                         │ disetujui peran yang berhak
                                         ▼
                        [ Transaksi DB: terapkan diff + audit log ] ─► graf dilanjutkan dari checkpoint
```

---

## 5. Persyaratan non-fungsional

### 5.1 Keamanan & privasi

- **NFR-SEC-01 (ZDR):** Semua layanan pihak ketiga yang menerima isi dokumen (LLM, OCR, embedding, Jev, gateway model) memiliki jaminan tertulis tanpa retensi dan tanpa pelatihan, dan tercantum dalam daftar pemroses data.
- **NFR-SEC-02 (RLS):** Pada semua tabel berisi data klien, termasuk chunk vektor, checkpoint, versi draf Lexical, dan audit log.
- **NFR-SEC-03 (Residensi) [KEPUTUSAN]:** Tentukan lokasi DB, storage, vektor, dan setiap pemrosesan model. Transfer data pribadi ke luar negeri di bawah UU PDP punya syarat tersendiri; konfirmasi dengan penasihat hukum dan dokumentasikan dasar transfernya per pemroses.
- **NFR-SEC-04 (Enkripsi):** TLS saat transit; enkripsi at rest. Pertimbangkan enkripsi tingkat aplikasi untuk KTP, KK, dan sertifikat.
- **NFR-SEC-05 (Log):** Redaksi PII di log aplikasi; isi prompt dan `state` Jev tidak dicatat di sistem pihak ketiga.
- **NFR-SEC-06 (Retensi):** Kebijakan terpisah untuk checkpoint, thread, dokumen kerja, dan minuta/protokol.

### 5.2 Keandalan & performa

- **NFR-PERF-01:** Event SSE pertama ≤ 1,5 dtk p95. Token teks pertama p50 ≤ 4 dtk untuk tanya-jawab berkas; tugas panjang menampilkan progres.
- **NFR-PERF-02:** Panggilan keputusan (Jev) tidak boleh menjadi jalur blokir tanpa batas waktu; timeout lalu fallback (§3.4).
- **NFR-REL-01:** Jika AI engine gagal, fitur non-agen tetap berjalan dan sesi agen dapat dilanjutkan dari checkpoint tanpa mengulang tool call yang sudah menghasilkan proposal.
- **NFR-REL-02:** Penerapan `ProposedChange` idempoten.

---

## 6. Pengujian & kriteria penerimaan

1. **Validasi skema:** 100% output generatif yang masuk DB lolos Pydantic; field tak terbaca `null` + alasan.
2. **Akurasi ekstraksi:** Diukur pada set evaluasi dokumen Indonesia teranonimkan; target per field ditetapkan setelah baseline.
3. **Isolasi:** Uji otomatis lintas berkas dan lintas tenant melalui UI, API, tool agen, retrieval, checkpoint, dan versi draf.
4. **Agen tidak menulis langsung:** Setiap jalur mutasi berakhir sebagai `ProposedChange`; penerapan hanya setelah persetujuan peran yang berhak.
5. **Jev tidak melemahkan kontrol:** Uji bahwa hasil DEC-04 dan DEC-06 tidak pernah menurunkan tingkat persetujuan atau melewati pemeriksaan izin, termasuk saat Jev mengembalikan probabilitas ekstrem.
6. **Kalibrasi ambang:** Untuk setiap DEC yang diaktifkan, laporan tingkat kesalahan per pita pada data berlabel kantor, disetujui sebelum produksi.
7. **HITL:** Graf berhenti di node persetujuan; ekspor `.docx` akta hanya setelah persetujuan Notaris/Partner.
8. **Register:** UPDATE/DELETE ditolak di level DB; penomoran berurutan di bawah finalisasi bersamaan.
9. **Sitasi:** Setiap sitasi menunjuk anchor yang ada, dapat diakses, dan relevan; klaim tak terlandas ditandai.
10. **Editor:** `PartyFieldNode` tidak dapat diedit sebagai teks; ekspor `.docx` dari JSON yang sama menghasilkan dokumen identik antar-ekspor.

---

## 7. Keputusan yang harus diambil

| # | Keputusan | Opsi | Rekomendasi awal |
| --- | --- | --- | --- |
| 1 | Model bisnis | Internal / siap SaaS | Internal, skema multi-tenant |
| 2 | Residensi data | Indonesia / Singapura / on-prem | Konsultasi UU PDP, lalu pilih provider |
| 3 | Vector publik | pgvector / Pinecone | pgvector di rilis pertama |
| 4 | Provider LLM generatif | Satu / dua | Satu di rilis pertama |
| 5 | Jev: kepatuhan dan jalur akses | TypeSafe langsung / OpenRouter / tunda | Evaluasi pada data sintetis sekarang; aktifkan di produksi setelah ketentuan data tertulis diperoleh |
| 6 | Kolaborasi real-time di editor | Ya (Yjs) / tidak | Tidak di R2; satu penyunting per draf dengan kunci |
| 7 | OCR | Cloud / lokal | Uji keduanya pada 50 dokumen contoh |
| 8 | Satu agen vs multi-agent | — | Satu agen + tool, dengan routing Jev |

---

## 8. Arah desain UI

Mengikuti mockup `docs/design/berkas-workspace.jsx`: kanvas `#F5F5F0`, tinta `#1A1A18`, ungu cap notaris `#4A3E96` hanya untuk elemen berotoritas, Newsreader untuk judul dan teks akta (termasuk di editor Lexical), Geist untuk UI. Tema shadcn/ui disesuaikan dengan token ini.