import { useState, useRef, useEffect } from "react";
import {
  Home, FolderOpen, Archive, GitBranch, BookOpen, BookMarked, Search,
  Paperclip, ArrowUp, Check, X, ChevronDown, ChevronRight, FileText,
  CreditCard, ClipboardList, AtSign, AlertTriangle, Database, Settings
} from "lucide-react";

/* ─────────────  Tokens  ───────────── */
const C = {
  canvas: "#F5F5F0",   // legal paper
  surface: "#FFFFFF",
  ink: "#1A1A18",
  ink2: "#5C5B55",
  ink3: "#8F8D85",
  line: "#E3E2DB",
  line2: "#EDECE6",
  violet: "#4A3E96",   // notary stamp ink
  violetSoft: "#ECEAF6",
  green: "#2F7A4F",
  amber: "#A86B12",
  red: "#B23A2E",
  mark: "#F6EDA6",     // highlighter
};
const SERIF = "'Newsreader', Georgia, serif";
const SANS = "'Geist', system-ui, sans-serif";

/* ─────────────  Matter data (system of record)  ───────────── */
const MATTERS = [
  { id: "m1", name: "Pendirian PT Sinar Kopi Nusantara", state: "amber" },
  { id: "m2", name: "AJB Kavling 14 Cilandak", state: "green" },
  { id: "m3", name: "Waris Keluarga Santoso", state: "ink3" },
  { id: "m4", name: "Fidusia Bank Nusantara, September", state: "amber" },
  { id: "m5", name: "Perubahan AD CV Kreatif Digital", state: "ink3" },
];

const STEPS = ["Intake", "Pesan nama", "Draft akta", "Penandatanganan", "SK AHU", "NIB OSS"];

const initialDocs = {
  akta: {
    short: "Draft akta",
    title: "Draft akta pendirian",
    icon: "file",
  },
  "ktp-laras": {
    short: "KTP Laras",
    title: "KTP Laras Anggraini",
    icon: "card",
    fields: [
      ["nik", "NIK", "3174055707910004"],
      ["nama", "Nama", "LARAS ANGGRAINI"],
      ["ttl", "Tempat/tgl lahir", "Surabaya, 17-07-1991"],
      ["alamat", "Alamat", "Jl. Kemang Raya No. 12, RT 004/RW 002, Bangka, Mampang Prapatan"],
      ["pekerjaan", "Pekerjaan", "Karyawan swasta"],
    ],
  },
  "ktp-rahmat": {
    short: "KTP Rahmat",
    title: "KTP Rahmat Hidayat",
    icon: "card",
    fields: [
      ["nik", "NIK", "3174010303880002"],
      ["nama", "Nama", "RAHMAT HIDAYAT"],
      ["ttl", "Tempat/tgl lahir", "Bandung, 03-03-1988"],
      ["alamat", "Alamat", "Jl. Wijaya II No. 8, RT 007/RW 001, Pulo, Kebayoran Baru"],
      ["pekerjaan", "Pekerjaan", "Wiraswasta"],
    ],
  },
  intake: {
    short: "Intake",
    title: "Formulir intake klien",
    icon: "form",
    fields: [
      ["namapt", "Nama PT (usulan)", "PT Sinar Kopi Nusantara"],
      ["kbli", "Kegiatan usaha", "Rumah minum/kafe, KBLI 56303"],
      ["modal", "Modal dasar / disetor", "Rp 400.000.000 / Rp 100.000.000"],
      ["saham", "Komposisi saham", "Rahmat Hidayat 60%, Laras Anggraini 40%"],
      ["alamat", "Alamat Laras Anggraini", "Jl. Kemang Raya No. 21, Jakarta Selatan"],
      ["npwp", "NPWP Laras Anggraini", "Belum diserahkan"],
    ],
  },
};

const aktaSections = (lauraFixed) => [
  { id: "judul", kind: "title" },
  {
    id: "kepala",
    t: "Pada hari ini, Jumat, tanggal dua puluh lima September dua ribu dua puluh enam (25-09-2026), pukul 10.00 WIB, menghadap kepada saya, SARI RAHAYU, Sarjana Hukum, Magister Kenotariatan, Notaris di Kota Administrasi Jakarta Selatan, dengan dihadiri oleh saksi-saksi yang saya, Notaris, kenal dan akan disebutkan pada bagian akhir akta ini:",
  },
  {
    id: "p1",
    t: "1. Tuan RAHMAT HIDAYAT, lahir di Bandung, pada tanggal tiga Maret seribu sembilan ratus delapan puluh delapan (03-03-1988), Warga Negara Indonesia, Wiraswasta, bertempat tinggal di Jakarta Selatan, Jalan Wijaya II Nomor 8, pemegang Kartu Tanda Penduduk dengan Nomor Induk Kependudukan 3174010303880002;",
  },
  {
    id: "p2",
    flag: !lauraFixed,
    t: `2. Nyonya LARAS ANGGRAINI, lahir di Surabaya, pada tanggal tujuh belas Juli seribu sembilan ratus sembilan puluh satu (17-07-1991), Warga Negara Indonesia, Karyawan Swasta, bertempat tinggal di Jakarta Selatan, Jalan Kemang Raya Nomor ${lauraFixed ? "12" : "21"}, pemegang Kartu Tanda Penduduk dengan Nomor Induk Kependudukan 3174055707910004.`,
  },
  { id: "intro", t: "Para penghadap menerangkan dengan ini mendirikan suatu perseroan terbatas dengan anggaran dasar sebagai berikut:" },
  { id: "pasal1", h: "Pasal 1", sub: "Nama dan tempat kedudukan", t: "Perseroan ini bernama PT SINAR KOPI NUSANTARA, selanjutnya dalam anggaran dasar ini cukup disingkat dengan \u201cPerseroan\u201d, berkedudukan di Kota Administrasi Jakarta Selatan." },
  { id: "pasal3", h: "Pasal 3", sub: "Maksud dan tujuan serta kegiatan usaha", t: "Maksud dan tujuan Perseroan ialah berusaha dalam bidang penyediaan makanan dan minuman. Untuk mencapai maksud dan tujuan tersebut, Perseroan dapat melaksanakan kegiatan usaha Rumah Minum/Kafe (KBLI 56303)." },
  { id: "pasal4", h: "Pasal 4", sub: "Modal", t: "Modal dasar Perseroan berjumlah Rp 400.000.000,- (empat ratus juta Rupiah), terbagi atas 400 (empat ratus) saham, masing-masing bernilai nominal Rp 1.000.000,- (satu juta Rupiah). Dari modal dasar tersebut telah ditempatkan dan disetor penuh sebesar 25% (dua puluh lima persen) atau 100 (seratus) saham dengan nilai nominal seluruhnya Rp 100.000.000,- (seratus juta Rupiah) oleh para pendiri: Tuan RAHMAT HIDAYAT sebanyak 60 (enam puluh) saham dan Nyonya LARAS ANGGRAINI sebanyak 40 (empat puluh) saham." },
];

const CITE_LABEL = {
  "akta:p2": "Draft akta, penghadap 2",
  "akta:pasal4": "Draft akta, Pasal 4",
  "akta:pasal3": "Draft akta, Pasal 3",
  "akta:pasal1": "Draft akta, Pasal 1",
  "akta:p1": "Draft akta, penghadap 1",
  "ktp-laras:alamat": "KTP Laras, alamat",
  "ktp-laras:nik": "KTP Laras, NIK",
  "ktp-rahmat:alamat": "KTP Rahmat, alamat",
  "ktp-rahmat:nik": "KTP Rahmat, NIK",
  "intake:alamat": "Intake, alamat Laras",
  "intake:npwp": "Intake, NPWP",
  "intake:modal": "Intake, modal",
  "intake:kbli": "Intake, KBLI",
  "intake:saham": "Intake, saham",
};

const initialChecklist = [
  { t: "KTP kedua pendiri", done: true, who: "Andi" },
  { t: "Pesan nama PT di AHU", done: true, who: "Andi" },
  { t: "Formulir intake ditandatangani", done: true, who: "Retno" },
  { t: "Draft akta dari template PT Standar v3", done: true, who: "Agen" },
  { t: "Review draft oleh notaris", done: false, who: "Sari" },
  { t: "Jadwal penandatanganan", done: false, who: "Andi" },
];

/* ─────────────  Small pieces  ───────────── */
function Dot({ color, size = 7 }) {
  return <span aria-hidden style={{ width: size, height: size, borderRadius: "50%", background: C[color] || color, display: "inline-block", flexShrink: 0 }} />;
}

function CiteChip({ id, onOpen, active }) {
  const [doc] = id.split(":");
  const Icon = doc === "akta" ? FileText : doc === "intake" ? ClipboardList : CreditCard;
  return (
    <button className="cite" onClick={() => onOpen(id)} data-active={active ? "1" : "0"}>
      <Icon size={11} strokeWidth={2} />
      {CITE_LABEL[id] || id}
    </button>
  );
}

function RichText({ text, onOpen, activeCite }) {
  const parts = [];
  const re = /\[\[([\w-]+(?::[\w-]+)?)\]\]/g;
  let last = 0, m, k = 0;
  const clean = text.replace(/\*\*(.+?)\*\*/g, "$1");
  while ((m = re.exec(clean))) {
    if (m.index > last) parts.push(<span key={k++}>{clean.slice(last, m.index)}</span>);
    parts.push(<CiteChip key={k++} id={m[1]} onOpen={onOpen} active={activeCite === m[1]} />);
    last = re.lastIndex;
  }
  if (last < clean.length) parts.push(<span key={k++}>{clean.slice(last)}</span>);
  return <>{parts}</>;
}

/* ─────────────  Agent message pieces  ───────────── */
function ToolSteps({ steps }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <button className="ghost" onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 6, color: C.ink3, fontSize: 12.5 }}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {steps.length} langkah dijalankan
      </button>
      {open && (
        <ol style={{ listStyle: "none", margin: "8px 0 0 6px", padding: "0 0 0 12px", borderLeft: `1px solid ${C.line}` }}>
          {steps.map((s, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.ink2, padding: "3px 0" }}>
              <Database size={12} color={C.ink3} />
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function FounderTable({ fixed }) {
  const rows = [
    { n: "Rahmat Hidayat", nik: "3174010303880002", a: "Jl. Wijaya II No. 8", npwp: true, note: "Cocok", c: "green" },
    { n: "Laras Anggraini", nik: "3174055707910004", a: "Jl. Kemang Raya No. 12", npwp: false, note: fixed ? "1 catatan" : "2 catatan", c: "amber" },
  ];
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, overflow: "hidden", margin: "14px 0", background: C.surface }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: C.canvas }}>
            {["Pendiri", "NIK", "Alamat di KTP", "NPWP", "Hasil cek"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 500, color: C.ink2, borderBottom: `1px solid ${C.line}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n}>
              <td style={td}>{r.n}</td>
              <td style={{ ...td, fontVariantNumeric: "tabular-nums", color: C.ink2 }}>{r.nik}</td>
              <td style={td}>{r.a}</td>
              <td style={{ ...td, color: r.npwp ? C.ink : C.red }}>{r.npwp ? "Ada" : "Belum ada"}</td>
              <td style={td}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Dot color={r.c} />{r.note}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const td = { padding: "9px 12px", borderTop: `1px solid ${C.line2}`, color: C.ink, verticalAlign: "top" };

function Stamp({ who, when }) {
  return (
    <div className="stamp" aria-label={`Disetujui oleh ${who}`}>
      <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, letterSpacing: ".02em" }}>Disetujui</div>
      <div style={{ fontSize: 11, marginTop: 2 }}>{who}, Notaris</div>
      <div style={{ fontSize: 10.5, opacity: .85, fontVariantNumeric: "tabular-nums" }}>{when}</div>
    </div>
  );
}

function Proposal({ status, onApprove, onReject }) {
  const items = [
    "Perbarui alamat Laras Anggraini di draft menjadi Jl. Kemang Raya No. 12, sesuai KTP",
    "Tambah ke checklist: minta NPWP Laras Anggraini, ditugaskan ke Andi, tenggat 29 Sep",
    "Ubah status akta 010/2026 dari Intake ke Draft",
  ];
  return (
    <div style={{ position: "relative", border: `1px solid ${status === "approved" ? C.violet : C.line}`, borderRadius: 6, background: C.surface, padding: "14px 16px", marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>Perubahan yang diusulkan</div>
        <div style={{ fontSize: 12, color: C.ink3 }}>
          {status === "pending" ? "Perlu persetujuan notaris" : status === "approved" ? "Diterapkan ke database" : "Ditolak"}
        </div>
      </div>
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.ink, lineHeight: 1.6 }}>
        {items.map((t) => <li key={t} style={{ paddingLeft: 4, marginBottom: 4, textDecoration: status === "rejected" ? "line-through" : "none", color: status === "rejected" ? C.ink3 : C.ink }}>{t}</li>)}
      </ol>
      {status === "pending" && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn primary" onClick={onApprove}><Check size={14} />Setujui perubahan</button>
          <button className="btn" onClick={onReject}><X size={14} />Tolak</button>
        </div>
      )}
      {status === "approved" && <Stamp who="Sari Rahayu" when="25 Sep 2026, 10.42" />}
    </div>
  );
}

/* ─────────────  Document pane  ───────────── */
function DocPane({ docs, active, setActive, highlight, fixed }) {
  const doc = docs[active];
  const ref = useRef(null);
  useEffect(() => {
    if (!highlight || !ref.current) return;
    const el = ref.current.querySelector(`[data-anchor="${highlight}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight, active]);

  return (
    <aside className="docpane">
      <div style={{ display: "flex", gap: 2, padding: "10px 12px 0", borderBottom: `1px solid ${C.line}`, overflowX: "auto" }}>
        {Object.entries(docs).map(([id, d]) => (
          <button key={id} className="doctab" data-active={id === active ? "1" : "0"} onClick={() => setActive(id)}>
            {d.icon === "file" ? <FileText size={13} /> : d.icon === "form" ? <ClipboardList size={13} /> : <CreditCard size={13} />}
            {d.short}
          </button>
        ))}
      </div>

      <div ref={ref} style={{ flex: 1, overflowY: "auto", padding: "28px 28px 60px" }}>
        {active === "akta" ? (
          <div className="sheet">
            {aktaSections(fixed).map((s) => {
              if (s.kind === "title") return (
                <div key={s.id} style={{ textAlign: "center", marginBottom: 22 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, letterSpacing: ".03em" }}>AKTA PENDIRIAN PERSEROAN TERBATAS</div>
                  <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, letterSpacing: ".03em" }}>PT SINAR KOPI NUSANTARA</div>
                  <div style={{ fontFamily: SERIF, fontSize: 14, marginTop: 6 }}>Nomor: 010</div>
                </div>
              );
              const hl = highlight === `akta:${s.id}`;
              return (
                <div key={s.id} data-anchor={`akta:${s.id}`} style={{ marginBottom: 14 }}>
                  {s.h && (
                    <div style={{ textAlign: "center", fontFamily: SERIF, margin: "20px 0 6px" }}>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{s.h}</div>
                      <div style={{ fontStyle: "italic", fontSize: 14, color: C.ink2 }}>{s.sub}</div>
                    </div>
                  )}
                  <p className={`akta-p ${hl ? "hl" : ""} ${s.flag ? "flag" : ""}`}>{s.t}</p>
                  {s.flag && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: SANS, fontSize: 11.5, color: C.red, marginTop: 4 }}>
                      <AlertTriangle size={12} /> Nomor rumah tidak sama dengan KTP
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ fontFamily: SANS, fontSize: 11.5, color: C.ink3, textAlign: "center", marginTop: 28 }}>
              Dibuat dari template PT Standar v3. Pasal 5 sampai 21 tidak ditampilkan.
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 20, marginBottom: 4 }}>{doc.title}</div>
            <div style={{ fontSize: 12, color: C.ink3, marginBottom: 18 }}>
              {doc.icon === "card" ? "Hasil ekstraksi dari pindaian, diunggah 22 Sep oleh Andi" : "Diisi klien 20 Sep, diverifikasi Retno"}
            </div>
            <dl style={{ margin: 0, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 6 }}>
              {doc.fields.map(([k, label, v], i) => {
                const hl = highlight === `${active}:${k}`;
                return (
                  <div key={k} data-anchor={`${active}:${k}`} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, padding: "11px 14px", borderTop: i ? `1px solid ${C.line2}` : "none", background: hl ? C.mark : "transparent", transition: "background .3s" }}>
                    <dt style={{ fontSize: 12.5, color: C.ink2 }}>{label}</dt>
                    <dd style={{ margin: 0, fontSize: 13.5, fontVariantNumeric: "tabular-nums", color: v === "Belum diserahkan" ? C.red : C.ink }}>{v}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ─────────────  Main  ───────────── */
const SEED_REPLY = `Saya sudah membaca 4 dokumen di berkas ini dan mengisi draft dari template PT Standar v3. Ada dua hal yang perlu dicek sebelum draft masuk review.

Nomor rumah Laras Anggraini berbeda. KTP menulis No. 12 [[ktp-laras:alamat]], formulir intake menulis No. 21 [[intake:alamat]], dan draft saat ini ikut versi intake [[akta:p2]]. Untuk akta, alamat mengikuti identitas resmi, jadi saya usulkan memakai No. 12.

NPWP Laras Anggraini belum ada di berkas [[intake:npwp]]. Ini tidak menghalangi penandatanganan akta, tapi akan dibutuhkan saat pendaftaran NIB di OSS.

Modal disetor Rp 100.000.000, yaitu 25% dari modal dasar, sudah tertuang di draft [[akta:pasal4]] dan sesuai dengan intake [[intake:modal]].`;

export default function App() {
  const [tab, setTab] = useState("chat");
  const [activeDoc, setActiveDoc] = useState("akta");
  const [highlight, setHighlight] = useState(null);
  const [proposal, setProposal] = useState("pending");
  const [checklist, setChecklist] = useState(initialChecklist);
  const [activity, setActivity] = useState([
    { t: "Agen membuat draft akta dari template PT Standar v3", w: "10.38" },
    { t: "Andi mengunggah KTP Laras Anggraini", w: "22 Sep" },
    { t: "Andi mengunggah KTP Rahmat Hidayat", w: "22 Sep" },
    { t: "Nama PT Sinar Kopi Nusantara disetujui AHU", w: "21 Sep" },
  ]);
  const [extra, setExtra] = useState([]); // follow-up messages
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const fixed = proposal === "approved";

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [extra, busy]);

  const openCite = (id) => {
    const [doc] = id.split(":");
    setActiveDoc(doc);
    setHighlight(id);
  };

  const approve = () => {
    setProposal("approved");
    setChecklist((c) => [...c, { t: "Minta NPWP Laras Anggraini", done: false, who: "Andi", due: "29 Sep" }]);
    setActivity((a) => [
      { t: "Sari Rahayu menyetujui 3 perubahan dari agen", w: "10.42" },
      { t: "Status akta 010/2026 diubah ke Draft", w: "10.42" },
      ...a,
    ]);
    setHighlight("akta:p2");
    setActiveDoc("akta");
  };
  const reject = () => {
    setProposal("rejected");
    setActivity((a) => [{ t: "Sari Rahayu menolak perubahan dari agen", w: "10.42" }, ...a]);
  };

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setExtra((e) => [...e, { role: "user", text: q }]);
    setBusy(true);
    const context = {
      berkas: "Pendirian PT Sinar Kopi Nusantara, akta 010/2026, notaris Sari Rahayu, tahap: Draft akta",
      dokumen: {
        "ktp-laras": initialDocs["ktp-laras"].fields,
        "ktp-rahmat": initialDocs["ktp-rahmat"].fields,
        intake: initialDocs.intake.fields,
        akta: aktaSections(fixed).filter((s) => s.t).map((s) => ({ anchor: s.id, pasal: s.h, teks: s.t })),
      },
      checklist,
      perubahan_disetujui: fixed,
    };
    const system = `Kamu adalah agen internal kantor notaris. Jawab dalam Bahasa Indonesia, ringkas (maksimal 3 paragraf pendek), tanpa heading atau bullet markdown. Gunakan hanya data berikut sebagai sumber. Setiap klaim faktual dari dokumen WAJIB diberi sitasi dengan format persis [[docId:anchor]], memakai salah satu dari: ${Object.keys(CITE_LABEL).join(", ")}. Jika data tidak ada, katakan tidak ada di berkas. Kamu tidak boleh mengubah data; jika perlu perubahan, sarankan agar notaris menyetujuinya.\n\nDATA:\n${JSON.stringify(context)}`;
    const history = extra.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system,
          messages: [...history, { role: "user", content: q }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
      setExtra((e) => [...e, { role: "agent", text: text || "Agen tidak mengembalikan jawaban. Coba ulangi pertanyaan." }]);
    } catch {
      setExtra((e) => [...e, { role: "agent", text: "Agen tidak dapat dihubungi. Periksa koneksi, lalu kirim ulang pertanyaan." }]);
    } finally {
      setBusy(false);
    }
  };

  const doneCount = checklist.filter((c) => c.done).length;
  const currentStep = fixed ? 2 : 2;

  return (
    <div className="app">
      <style>{CSS}</style>

      {/* Sidebar */}
      <nav className="side">
        <div style={{ display: "flex", alignItems: "baseline", gap: 2, padding: "18px 18px 16px" }}>
          <span style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600 }}>Notaris</span>
          <span style={{ fontFamily: SERIF, fontSize: 19, fontStyle: "italic", color: C.violet }}>Digital</span>
        </div>
        <div style={{ padding: "0 12px 12px" }}>
          <div className="search"><Search size={13} color={C.ink3} /><span>Cari berkas, klien, akta</span><kbd>⌘K</kbd></div>
        </div>
        {[
          [Home, "Beranda"], [FolderOpen, "Berkas", true], [Archive, "Vault"],
          [GitBranch, "Workflow"], [BookOpen, "Knowledge"], [BookMarked, "Register"],
        ].map(([I, l, a]) => (
          <button key={l} className="nav" data-active={a ? "1" : "0"}><I size={15} />{l}</button>
        ))}

        <div style={{ fontSize: 12, color: C.ink3, padding: "22px 18px 8px" }}>Berkas aktif</div>
        {MATTERS.map((m, i) => (
          <button key={m.id} className="matter" data-active={i === 0 ? "1" : "0"}>
            <Dot color={m.state} size={6} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
          </button>
        ))}

        <div style={{ marginTop: "auto", borderTop: `1px solid ${C.line}`, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.violetSoft, color: C.violet, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 600 }}>SR</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Sari Rahayu</div>
            <div style={{ fontSize: 11.5, color: C.ink3 }}>Notaris</div>
          </div>
          <Settings size={15} color={C.ink3} />
        </div>
      </nav>

      {/* Center */}
      <main className="center">
        <header style={{ padding: "22px 32px 0", borderBottom: `1px solid ${C.line}`, background: C.canvas }}>
          <div style={{ fontSize: 12.5, color: C.ink3, marginBottom: 4 }}>Berkas / Pendirian badan usaha</div>
          <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 27, margin: 0, letterSpacing: "-.01em" }}>Pendirian PT Sinar Kopi Nusantara</h1>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 12.5, color: C.ink2, marginTop: 8 }}>
            <span>Akta 010/2026</span>
            <span>Klien: Rahmat Hidayat</span>
            <span>Penanggung jawab: Andi Pratama</span>
            <span>Batas pengajuan AHU: <b style={{ fontWeight: 500, color: C.ink }}>24 Nov 2026</b></span>
          </div>

          {/* Workflow steps — genuinely sequential */}
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s} data-state={i < currentStep ? "done" : i === currentStep ? "now" : "next"}>
                <span className="num">{i < currentStep ? <Check size={10} strokeWidth={3} /> : i + 1}</span>
                {s}
              </li>
            ))}
          </ol>

          <div role="tablist" style={{ display: "flex", gap: 22 }}>
            {[["chat", "Percakapan"], ["docs", "Dokumen", "4"], ["check", "Checklist", `${doneCount}/${checklist.length}`], ["log", "Aktivitas"]].map(([id, l, n]) => (
              <button key={id} role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
                {l}{n && <span style={{ color: C.ink3, marginLeft: 6 }}>{n}</span>}
              </button>
            ))}
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {tab === "chat" && (
            <div className="thread">
              <div className="msg-user">
                Cek kelengkapan dokumen kedua pendiri, lalu siapkan draft akta dari template PT standar kantor.
                <div style={{ fontSize: 11.5, color: C.ink3, marginTop: 6 }}>Andi Pratama, 10.36</div>
              </div>

              <div className="msg-agent">
                <ToolSteps steps={[
                  "Membaca 4 dokumen di berkas",
                  "Mencocokkan pendiri dengan database klien: 2 ditemukan",
                  "Memuat template PT Standar v3 dari Knowledge",
                  "Membandingkan KTP dengan formulir intake",
                  "Menyusun draft akta 010/2026",
                ]} />
                {SEED_REPLY.split("\n\n").map((p, i) => (
                  <div key={i}>
                    <p className="agent-p"><RichText text={p} onOpen={openCite} activeCite={highlight} /></p>
                    {i === 0 && <FounderTable fixed={fixed} />}
                  </div>
                ))}
                <Proposal status={proposal} onApprove={approve} onReject={reject} />
              </div>

              {extra.map((m, i) => m.role === "user" ? (
                <div key={i} className="msg-user">{m.text}<div style={{ fontSize: 11.5, color: C.ink3, marginTop: 6 }}>Sari Rahayu</div></div>
              ) : (
                <div key={i} className="msg-agent">
                  {m.text.split(/\n{2,}/).map((p, j) => <p key={j} className="agent-p"><RichText text={p} onOpen={openCite} activeCite={highlight} /></p>)}
                </div>
              ))}
              {busy && <div className="msg-agent"><span className="pulse">Agen sedang membaca berkas</span></div>}
              <div ref={endRef} />
            </div>
          )}

          {tab === "docs" && (
            <div className="thread">
              {Object.entries(initialDocs).map(([id, d]) => (
                <button key={id} className="row" onClick={() => { setActiveDoc(id); setHighlight(null); }}>
                  {d.icon === "file" ? <FileText size={15} /> : d.icon === "form" ? <ClipboardList size={15} /> : <CreditCard size={15} />}
                  <span style={{ flex: 1 }}>{d.title}</span>
                  <span style={{ color: C.ink3, fontSize: 12 }}>{d.icon === "file" ? "Draft v1" : "Terverifikasi"}</span>
                </button>
              ))}
            </div>
          )}

          {tab === "check" && (
            <div className="thread">
              {checklist.map((c, i) => (
                <label key={i} className="row" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={c.done} onChange={() => setChecklist((l) => l.map((x, j) => j === i ? { ...x, done: !x.done } : x))} />
                  <span style={{ flex: 1, color: c.done ? C.ink3 : C.ink, textDecoration: c.done ? "line-through" : "none" }}>{c.t}</span>
                  <span style={{ color: C.ink3, fontSize: 12 }}>{c.who}{c.due ? `, ${c.due}` : ""}</span>
                </label>
              ))}
            </div>
          )}

          {tab === "log" && (
            <div className="thread">
              {activity.map((a, i) => (
                <div key={i} className="row" style={{ cursor: "default" }}>
                  <Dot color={a.t.startsWith("Agen") ? "violet" : "ink3"} size={6} />
                  <span style={{ flex: 1 }}>{a.t}</span>
                  <span style={{ color: C.ink3, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{a.w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {tab === "chat" && (
          <div style={{ padding: "0 32px 20px" }}>
            <div className="composer">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Tanya tentang berkas ini, misalnya: siapa pemegang saham mayoritas?"
                rows={2}
                aria-label="Pesan untuk agen"
              />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="ctx"><AtSign size={11} />Berkas ini</span>
                <span className="ctx"><BookOpen size={11} />PT Standar v3</span>
                <button className="ghost icon" aria-label="Lampirkan"><Paperclip size={15} /></button>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: C.ink3 }}>Agen hanya membaca; perubahan butuh persetujuan</span>
                <button className="send" onClick={send} disabled={!input.trim() || busy} aria-label="Kirim"><ArrowUp size={15} /></button>
              </div>
            </div>
          </div>
        )}
      </main>

      <DocPane docs={initialDocs} active={activeDoc} setActive={(d) => { setActiveDoc(d); setHighlight(null); }} highlight={highlight} fixed={fixed} />
    </div>
  );
}

/* ─────────────  CSS  ───────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Geist:wght@400;500;600&display=swap');
*{box-sizing:border-box}
body{margin:0}
button{font:inherit;color:inherit;background:none;border:none;cursor:pointer;padding:0}
:focus-visible{outline:2px solid ${C.violet};outline-offset:2px;border-radius:4px}
.app{display:flex;height:100vh;background:${C.canvas};color:${C.ink};font-family:${SANS};font-size:14px;-webkit-font-smoothing:antialiased}
.side{width:248px;flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid ${C.line};background:${C.canvas};overflow-y:auto}
.search{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid ${C.line};border-radius:6px;background:${C.surface};font-size:12.5px;color:${C.ink3}}
.search span{flex:1}
kbd{font-family:${SANS};font-size:10.5px;color:${C.ink3};border:1px solid ${C.line};border-radius:4px;padding:0 4px}
.nav{display:flex;align-items:center;gap:10px;margin:1px 8px;padding:7px 10px;border-radius:6px;font-size:13.5px;color:${C.ink2};text-align:left}
.nav:hover{background:${C.line2}}
.nav[data-active="1"]{background:${C.surface};color:${C.ink};font-weight:500;box-shadow:inset 0 0 0 1px ${C.line}}
.matter{display:flex;align-items:center;gap:9px;margin:0 8px;padding:6px 10px;border-radius:6px;font-size:13px;color:${C.ink2};text-align:left;min-width:0}
.matter:hover{background:${C.line2}}
.matter[data-active="1"]{color:${C.ink};font-weight:500}
.center{flex:1;min-width:0;display:flex;flex-direction:column;background:${C.canvas}}
.steps{list-style:none;display:flex;flex-wrap:wrap;gap:4px 18px;margin:18px 0 16px;padding:0}
.steps li{display:flex;align-items:center;gap:7px;font-size:12.5px;color:${C.ink3}}
.steps .num{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:10.5px;border:1px solid ${C.line};background:${C.surface};font-variant-numeric:tabular-nums}
.steps li[data-state="done"]{color:${C.ink2}}
.steps li[data-state="done"] .num{background:${C.ink};border-color:${C.ink};color:#fff}
.steps li[data-state="now"]{color:${C.ink};font-weight:500}
.steps li[data-state="now"] .num{border-color:${C.violet};color:${C.violet};box-shadow:0 0 0 3px ${C.violetSoft}}
.tab{padding:0 0 11px;font-size:13.5px;color:${C.ink2};border-bottom:2px solid transparent;margin-bottom:-1px}
.tab[aria-selected="true"]{color:${C.ink};border-bottom-color:${C.ink};font-weight:500}
.thread{max-width:720px;margin:0 auto;padding:28px 32px 20px}
.msg-user{margin-left:auto;max-width:78%;background:${C.surface};border:1px solid ${C.line};border-radius:10px 10px 2px 10px;padding:11px 14px;font-size:14px;line-height:1.55;margin-bottom:26px}
.msg-agent{margin-bottom:30px}
.agent-p{font-family:${SERIF};font-size:16px;line-height:1.62;margin:0 0 12px;color:${C.ink}}
.cite{display:inline-flex;align-items:center;gap:4px;font-family:${SANS};font-size:11.5px;line-height:1;padding:4px 7px;margin:0 2px;border-radius:4px;background:${C.violetSoft};color:${C.violet};vertical-align:1px;white-space:nowrap}
.cite:hover,.cite[data-active="1"]{background:${C.violet};color:#fff}
.ghost{background:none}
.ghost.icon{padding:5px;border-radius:5px;color:${C.ink3}}
.ghost.icon:hover{background:${C.line2};color:${C.ink}}
.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:6px;font-size:13px;border:1px solid ${C.line};background:${C.surface}}
.btn:hover{border-color:${C.ink3}}
.btn.primary{background:${C.violet};border-color:${C.violet};color:#fff}
.btn.primary:hover{background:#3B3180}
.stamp{position:absolute;right:18px;bottom:14px;color:${C.violet};border:2px solid ${C.violet};border-radius:50%;width:112px;height:112px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;transform:rotate(-9deg);opacity:.88;box-shadow:inset 0 0 0 4px ${C.surface},inset 0 0 0 5px ${C.violet};animation:stampIn .35s cubic-bezier(.2,1.6,.4,1) both;mix-blend-mode:multiply;background:${C.surface}}
@keyframes stampIn{from{transform:rotate(-9deg) scale(1.6);opacity:0}to{transform:rotate(-9deg) scale(1);opacity:.88}}
.composer{max-width:720px;margin:0 auto;background:${C.surface};border:1px solid ${C.line};border-radius:10px;padding:12px 12px 10px}
.composer:focus-within{border-color:${C.ink3}}
.composer textarea{width:100%;border:none;outline:none;resize:none;font:inherit;font-size:14px;color:${C.ink};background:transparent;margin-bottom:6px}
.composer textarea::placeholder{color:${C.ink3}}
.ctx{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:${C.ink2};padding:3px 7px;border:1px solid ${C.line};border-radius:4px}
.send{width:30px;height:30px;border-radius:6px;background:${C.ink};color:#fff;display:grid;place-items:center}
.send:disabled{background:${C.line};color:${C.ink3};cursor:default}
.row{display:flex;align-items:center;gap:12px;width:100%;padding:13px 4px;border-bottom:1px solid ${C.line};font-size:14px;text-align:left;color:${C.ink}}
.row:hover{background:${C.line2}}
.row input{accent-color:${C.violet};width:15px;height:15px}
.docpane{width:min(46vw,560px);flex-shrink:0;display:flex;flex-direction:column;border-left:1px solid ${C.line};background:#EFEEE8}
.doctab{display:flex;align-items:center;gap:6px;padding:7px 11px;font-size:12.5px;color:${C.ink2};border-radius:6px 6px 0 0;white-space:nowrap;border:1px solid transparent;border-bottom:none;margin-bottom:-1px}
.doctab[data-active="1"]{background:#EFEEE8;color:${C.ink};border-color:${C.line};font-weight:500}
.sheet{background:${C.surface};padding:44px 46px 40px;box-shadow:0 1px 0 ${C.line},0 12px 30px -18px rgba(40,36,20,.35);border-radius:2px;max-width:500px;margin:0 auto}
.akta-p{font-family:${SERIF};font-size:14px;line-height:1.75;text-align:justify;margin:0;transition:background .3s}
.akta-p.hl{background:${C.mark};box-shadow:0 0 0 4px ${C.mark}}
.akta-p.flag{text-decoration:underline wavy ${C.red};text-decoration-thickness:1px;text-underline-offset:4px}
.pulse{font-size:13px;color:${C.ink3};animation:pulse 1.4s ease-in-out infinite}
@keyframes pulse{50%{opacity:.4}}
@media (max-width:1180px){.docpane{display:none}}
@media (max-width:820px){.side{display:none}.thread{padding:20px 18px}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;
