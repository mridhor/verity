import { useState, useMemo } from "react";
import {
  LayoutDashboard, FileText, CalendarDays, BookOpen, FolderArchive,
  ArrowLeftRight, Scale, Users, Activity, ShieldCheck, Bell, Search,
  Plus, Eye, Edit, Trash2, LogOut, X, Upload, Star, CheckCircle,
  Clock, AlertCircle, XCircle, User, Download, BookMarked,
  Lock, ChevronRight, RefreshCw, Menu, TrendingUp, Shield,
  Key, MoreHorizontal, FileSearch, Building2, Hash, Filter,
  ChevronDown, ChevronUp, Check, Bookmark
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from "recharts";

// ═══════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════
const T = {
  navy:    '#06091F',
  navy2:   '#0D1235',
  navy3:   '#141840',
  navy4:   '#1A2055',
  gold:    '#C8A84B',
  gold2:   '#E2C472',
  white:   '#FAFAF7',
  gray:    '#8A8DA8',
  gray2:   '#5A5E7A',
  border:  'rgba(200,168,75,0.12)',
  borderB: 'rgba(200,168,75,0.30)',
  red:     '#E05252',
  green:   '#52C87A',
  blue:    '#5280C8',
  orange:  '#C87A52',
};

const s = {
  card: { background: T.navy2, border: `1px solid ${T.border}`, borderRadius: 12 },
  input: {
    background: T.navy3, border: `1px solid ${T.border}`, borderRadius: 8,
    color: T.white, padding: '10px 14px', fontSize: 14, width: '100%',
    outline: 'none', transition: 'border .2s',
  },
  label: { fontSize: 12, fontWeight: 600, color: T.gray, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: T.gray, letterSpacing: '.08em', textTransform: 'uppercase', borderBottom: `1px solid ${T.border}` },
  td: { padding: '14px 16px', fontSize: 13.5, color: T.white, borderBottom: `1px solid rgba(255,255,255,0.04)`, verticalAlign: 'middle' },
};

// ═══════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════
const initAkta = [
  { id:1, nomor:'001/2025/JKT', tanggal:'2025-01-15', jenis:'Jual Beli',     penghadap:'PT Maju Bersama',     pihak2:'Budi Santoso',  status:'Selesai',       ket:'Tanah di Kebayoran Baru' },
  { id:2, nomor:'002/2025/JKT', tanggal:'2025-01-18', jenis:'PPJB',          penghadap:'Dewi Lestari',        pihak2:'CV Karya Muda', status:'Menunggu TTD',  ket:'Pengikatan jual beli unit apartemen' },
  { id:3, nomor:'003/2025/JKT', tanggal:'2025-01-20', jenis:'Pendirian PT',  penghadap:'Hendra Gunawan',      pihak2:'Ahmad Fauzi',   status:'Verifikasi',    ket:'PT Teknologi Nusantara' },
  { id:4, nomor:'004/2025/JKT', tanggal:'2025-01-22', jenis:'Hibah',         penghadap:'Rina Kusuma',         pihak2:'Tono Suharto',  status:'Draft',         ket:'Hibah tanah warisan' },
  { id:5, nomor:'005/2025/JKT', tanggal:'2025-01-25', jenis:'Kuasa',         penghadap:'PT Sejahtera Abadi',  pihak2:'Maria Indah',   status:'Diarsipkan',    ket:'Surat kuasa jual' },
  { id:6, nomor:'006/2025/JKT', tanggal:'2025-01-28', jenis:'Jual Beli',     penghadap:'Surya Wijaya',        pihak2:'Linda Hartono', status:'Selesai',       ket:'Ruko di Tanah Abang' },
  { id:7, nomor:'007/2025/JKT', tanggal:'2025-02-01', jenis:'Kredit',        penghadap:'Bank Nusantara',      pihak2:'Agus Pramono',  status:'Menunggu TTD',  ket:'Kredit pemilikan rumah' },
  { id:8, nomor:'008/2025/JKT', tanggal:'2025-02-03', jenis:'Pendirian CV',  penghadap:'Wahyu Nugroho',       pihak2:'Siti Aminah',   status:'Verifikasi',    ket:'CV Kreatif Digital' },
  { id:9, nomor:'009/2025/JKT', tanggal:'2025-02-10', jenis:'Waris',         penghadap:'Keluarga Santoso',    pihak2:'-',             status:'Draft',         ket:'Surat keterangan ahli waris' },
];

const initJadwal = [
  { id:1, tanggal:'2025-06-06', waktu:'09:00', jenis:'Pertemuan Klien', klien:'PT Maju Bersama',  lokasi:'Ruang Meeting 1', ket:'Diskusi akta jual beli properti' },
  { id:2, tanggal:'2025-06-06', waktu:'11:00', jenis:'Penandatanganan', klien:'Dewi Lestari',     lokasi:'Ruang Utama',     ket:'Penandatanganan akta PPJB No.002' },
  { id:3, tanggal:'2025-06-06', waktu:'14:00', jenis:'Pertemuan Klien', klien:'Bank Nusantara',   lokasi:'Ruang Meeting 2', ket:'Akta kredit pemilikan rumah' },
  { id:4, tanggal:'2025-06-07', waktu:'10:00', jenis:'Penandatanganan', klien:'Wahyu Nugroho',    lokasi:'Ruang Utama',     ket:'Penandatanganan pendirian CV' },
  { id:5, tanggal:'2025-06-08', waktu:'09:30', jenis:'Internal',        klien:'Tim Kantor',       lokasi:'Ruang Rapat',     ket:'Audit dokumen bulanan' },
  { id:6, tanggal:'2025-06-09', waktu:'13:00', jenis:'Pertemuan Klien', klien:'Hendra Gunawan',   lokasi:'Ruang Meeting 1', ket:'Review dokumen pendirian PT' },
  { id:7, tanggal:'2025-06-10', waktu:'15:00', jenis:'Internal',        klien:'Tim Kantor',       lokasi:'Ruang Rapat',     ket:'Meeting evaluasi mingguan' },
];

const klapperData = [
  { nama:'Agus Pramono',       jenis:'Perseorangan', akta:['007/2025/JKT'], terakhir:'2025-02-01' },
  { nama:'Ahmad Fauzi',        jenis:'Perseorangan', akta:['003/2025/JKT'], terakhir:'2025-01-20' },
  { nama:'Bank Nusantara',     jenis:'Perusahaan',   akta:['007/2025/JKT'], terakhir:'2025-02-01' },
  { nama:'Budi Santoso',       jenis:'Perseorangan', akta:['001/2025/JKT'], terakhir:'2025-01-15' },
  { nama:'CV Karya Muda',      jenis:'Perusahaan',   akta:['002/2025/JKT'], terakhir:'2025-01-18' },
  { nama:'Dewi Lestari',       jenis:'Perseorangan', akta:['002/2025/JKT'], terakhir:'2025-01-18' },
  { nama:'Hendra Gunawan',     jenis:'Perseorangan', akta:['003/2025/JKT'], terakhir:'2025-01-20' },
  { nama:'Linda Hartono',      jenis:'Perseorangan', akta:['006/2025/JKT'], terakhir:'2025-01-28' },
  { nama:'Maria Indah',        jenis:'Perseorangan', akta:['005/2025/JKT'], terakhir:'2025-01-25' },
  { nama:'PT Maju Bersama',    jenis:'Perusahaan',   akta:['001/2025/JKT'], terakhir:'2025-01-15' },
  { nama:'PT Sejahtera Abadi', jenis:'Perusahaan',   akta:['005/2025/JKT'], terakhir:'2025-01-25' },
  { nama:'Rina Kusuma',        jenis:'Perseorangan', akta:['004/2025/JKT'], terakhir:'2025-01-22' },
  { nama:'Siti Aminah',        jenis:'Perseorangan', akta:['008/2025/JKT'], terakhir:'2025-02-03' },
  { nama:'Surya Wijaya',       jenis:'Perseorangan', akta:['006/2025/JKT'], terakhir:'2025-01-28' },
  { nama:'Wahyu Nugroho',      jenis:'Perseorangan', akta:['008/2025/JKT'], terakhir:'2025-02-03' },
];

const minutaData = [
  { id:1, nama:'Minuta Akta 001-2025', nomor:'001/2025/JKT', ukuran:'2.4 MB', format:'PDF', tanggal:'2025-01-15' },
  { id:2, nama:'Minuta Akta 002-2025', nomor:'002/2025/JKT', ukuran:'1.8 MB', format:'PDF', tanggal:'2025-01-18' },
  { id:3, nama:'Minuta Akta 005-2025', nomor:'005/2025/JKT', ukuran:'3.1 MB', format:'PDF', tanggal:'2025-01-25' },
  { id:4, nama:'Minuta Akta 006-2025', nomor:'006/2025/JKT', ukuran:'2.2 MB', format:'PDF', tanggal:'2025-01-28' },
  { id:5, nama:'KTP Budi Santoso',     nomor:'001/2025/JKT', ukuran:'320 KB', format:'JPG', tanggal:'2025-01-14' },
  { id:6, nama:'NPWP PT Maju Bersama', nomor:'001/2025/JKT', ukuran:'480 KB', format:'JPG', tanggal:'2025-01-14' },
  { id:7, nama:'Akta Perusahaan CV',   nomor:'002/2025/JKT', ukuran:'1.2 MB', format:'PDF', tanggal:'2025-01-17' },
];

const protokolData = [
  { id:1, notaris:'Notaris Ahmad Dahlan, S.H.',         sk:'SK/2015/KEM-HUK/001', wilayah:'Jakarta Selatan', penyerahan:'2024-06-01', jumlah:3482, tahun:'1998–2024', status:'Selesai' },
  { id:2, notaris:'Notaris Sri Wahyuni, S.H., M.Kn.',  sk:'SK/2010/KEM-HUK/045', wilayah:'Jakarta Timur',   penyerahan:'2024-09-15', jumlah:2156, tahun:'2003–2024', status:'Dalam Proses' },
  { id:3, notaris:'Notaris Bambang Suharto, S.H.',     sk:'SK/2008/KEM-HUK/023', wilayah:'Jakarta Pusat',   penyerahan:'2023-12-10', jumlah:4721, tahun:'1995–2023', status:'Selesai' },
];

const initHukum = [
  { id:1, judul:'Undang-Undang No. 30 Tahun 2004 tentang Jabatan Notaris', kat:'Undang-Undang', nomor:'UU 30/2004', tahun:2004, bookmark:true },
  { id:2, judul:'Undang-Undang No. 2 Tahun 2014 — Perubahan atas UU Jabatan Notaris', kat:'Undang-Undang', nomor:'UU 2/2014', tahun:2014, bookmark:true },
  { id:3, judul:'UU No. 40 Tahun 2007 tentang Perseroan Terbatas', kat:'Undang-Undang', nomor:'UU 40/2007', tahun:2007, bookmark:false },
  { id:4, judul:'Kitab Undang-Undang Hukum Perdata (KUHPerdata)', kat:'Undang-Undang', nomor:'KUHPerdata', tahun:1847, bookmark:true },
  { id:5, judul:'Peraturan Pemerintah No. 24 Tahun 1997 tentang Pendaftaran Tanah', kat:'Peraturan Pemerintah', nomor:'PP 24/1997', tahun:1997, bookmark:false },
  { id:6, judul:'Permen Hukum dan HAM No. 62 Tahun 2016 tentang Cuti Notaris', kat:'Peraturan Menteri', nomor:'Permenkumham 62/2016', tahun:2016, bookmark:false },
  { id:7, judul:'Putusan MA No. 1234/K/Pdt/2022 — Keabsahan Akta Notaris', kat:'Putusan Pengadilan', nomor:'MA 1234/K/Pdt/2022', tahun:2022, bookmark:false },
  { id:8, judul:'Surat Edaran Kemenkumham No. M.HH-01.AH.02.01 Tahun 2023', kat:'Surat Edaran', nomor:'SE M.HH-01/2023', tahun:2023, bookmark:false },
];

const initUsers = [
  { id:1, nama:'Bambang Admin',    email:'bambang@kantor.id',  role:'Super Admin',       status:'Aktif',    lastLogin:'2025-06-06 07:00' },
  { id:2, nama:'Sari Rahayu',      email:'sari@kantor.id',     role:'Notaris',           status:'Aktif',    lastLogin:'2025-06-06 08:32' },
  { id:3, nama:'Andi Pratama',     email:'andi@kantor.id',     role:'Staf Administrasi', status:'Aktif',    lastLogin:'2025-06-06 08:15' },
  { id:4, nama:'Retno Wulandari',  email:'retno@kantor.id',    role:'Staf Administrasi', status:'Aktif',    lastLogin:'2025-06-05 17:42' },
  { id:5, nama:'Fitriani Hukum',   email:'fitri@kantor.id',    role:'Member',            status:'Aktif',    lastLogin:'2025-06-04 14:21' },
  { id:6, nama:'Dicky Susanto',    email:'dicky@kantor.id',    role:'Staf Administrasi', status:'Nonaktif', lastLogin:'2025-05-20 09:00' },
];

const auditData = [
  { id:1,  waktu:'2025-06-06 08:32', user:'Sari Rahayu',     aksi:'Login',           detail:'Login berhasil dari 192.168.1.10',          modul:'Autentikasi' },
  { id:2,  waktu:'2025-06-06 08:35', user:'Sari Rahayu',     aksi:'Lihat Akta',      detail:'Membuka akta 001/2025/JKT',                 modul:'Manajemen Akta' },
  { id:3,  waktu:'2025-06-06 08:40', user:'Andi Pratama',    aksi:'Login',           detail:'Login berhasil dari 192.168.1.12',           modul:'Autentikasi' },
  { id:4,  waktu:'2025-06-06 08:42', user:'Andi Pratama',    aksi:'Buat Akta',       detail:'Membuat akta baru: Draft Waris',             modul:'Manajemen Akta' },
  { id:5,  waktu:'2025-06-06 09:05', user:'Sari Rahayu',     aksi:'Ubah Status',     detail:'Akta 003/2025 → Verifikasi',                modul:'Manajemen Akta' },
  { id:6,  waktu:'2025-06-06 09:12', user:'Retno Wulandari', aksi:'Upload Dokumen',  detail:'Upload KTP_Hendra.jpg ke akta 003',         modul:'Minuta Akta' },
  { id:7,  waktu:'2025-06-06 09:30', user:'Andi Pratama',    aksi:'Buat Jadwal',     detail:'Jadwal pertemuan Bank Nusantara 14:00',      modul:'Jadwal' },
  { id:8,  waktu:'2025-06-06 10:01', user:'Sari Rahayu',     aksi:'Unduh Dokumen',   detail:'Unduh Minuta Akta 002-2025.pdf',             modul:'Minuta Akta' },
  { id:9,  waktu:'2025-06-06 10:15', user:'Bambang Admin',   aksi:'Tambah Pengguna', detail:'Menambah user Fitriani Hukum (Member)',      modul:'Manajemen Pengguna' },
  { id:10, waktu:'2025-06-06 11:00', user:'Fitriani Hukum',  aksi:'Portal Hukum',    detail:'Membuka UU No. 30 Tahun 2004',              modul:'Portal Hukum' },
  { id:11, waktu:'2025-06-06 11:20', user:'Andi Pratama',    aksi:'Edit Akta',       detail:'Memperbarui keterangan akta 004/2025',       modul:'Manajemen Akta' },
  { id:12, waktu:'2025-06-06 12:05', user:'Sari Rahayu',     aksi:'Logout',          detail:'Logout dari sistem',                        modul:'Autentikasi' },
];

const chartBulan = [
  {b:'Jan',n:28},{b:'Feb',n:35},{b:'Mar',n:42},{b:'Apr',n:31},{b:'Mei',n:48},{b:'Jun',n:22},
];
const chartPie = [
  {name:'Selesai',value:45,color:T.green},{name:'Proses',value:28,color:T.gold},
  {name:'Draft',value:15,color:T.gray},{name:'Arsip',value:12,color:T.blue},
];

// ═══════════════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════════════

function Badge({ status }) {
  const cfg = {
    'Draft':         { bg:'rgba(138,141,168,.2)', color:T.gray,   icon:<Clock   size={11}/> },
    'Verifikasi':    { bg:'rgba(82,128,200,.2)',   color:T.blue,   icon:<AlertCircle size={11}/> },
    'Menunggu TTD':  { bg:'rgba(200,168,75,.2)',   color:T.gold2,  icon:<Clock   size={11}/> },
    'Selesai':       { bg:'rgba(82,200,122,.2)',   color:T.green,  icon:<CheckCircle size={11}/> },
    'Diarsipkan':    { bg:'rgba(82,128,200,.15)',  color:'#8BA8E0',icon:<FolderArchive size={11}/> },
    'Aktif':         { bg:'rgba(82,200,122,.2)',   color:T.green,  icon:<CheckCircle size={11}/> },
    'Nonaktif':      { bg:'rgba(224,82,82,.15)',   color:T.red,    icon:<XCircle size={11}/> },
    'Selesai Diterima': { bg:'rgba(82,200,122,.2)',color:T.green,  icon:<CheckCircle size={11}/> },
    'Dalam Proses':  { bg:'rgba(200,168,75,.2)',   color:T.gold2,  icon:<Clock   size={11}/> },
  };
  const c = cfg[status] || { bg:'rgba(138,141,168,.15)', color:T.gray, icon:null };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:100, background:c.bg, color:c.color, fontSize:11.5, fontWeight:600, whiteSpace:'nowrap' }}>
      {c.icon}{status}
    </span>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:700, color:T.white, marginBottom:4 }}>{title}</h1>
        {subtitle && <p style={{ fontSize:13.5, color:T.gray }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function GoldBtn({ onClick, children, outline, small }) {
  return (
    <button onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', gap:6, padding: small ? '7px 14px' : '10px 20px',
      background: outline ? 'transparent' : `linear-gradient(135deg,${T.gold},${T.gold2})`,
      border: outline ? `1px solid ${T.borderB}` : 'none',
      borderRadius:8, color: outline ? T.gold2 : T.navy, fontSize: small ? 12.5 : 13.5,
      fontWeight:600, cursor:'pointer', transition:'all .2s',
    }}>
      {children}
    </button>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position:'relative', flex:1, maxWidth:320 }}>
      <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:T.gray }} />
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Cari...'}
        style={{ ...s.input, paddingLeft:36, maxWidth:'none' }}
      />
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ ...s.card, width:'100%', maxWidth: wide ? 700 : 520, maxHeight:'90vh', overflow:'auto', padding:28 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontSize:17, fontWeight:700, color:T.white }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.gray, cursor:'pointer', padding:4 }}><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ ...s.input, appearance:'none' }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ ...s.card, padding:'20px 22px', display:'flex', gap:14, alignItems:'flex-start' }}>
      <div style={{ width:42, height:42, borderRadius:10, background:`${color}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize:22, fontWeight:700, color:T.white, lineHeight:1.2 }}>{value}</div>
        <div style={{ fontSize:12, color:T.gray, marginTop:2 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:color, marginTop:4 }}>{sub}</div>}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ padding:'48px 20px', textAlign:'center', color:T.gray }}>
      <div style={{ fontSize:36, marginBottom:12, opacity:.4 }}>{icon}</div>
      <div style={{ fontSize:14 }}>{text}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// LOGIN PAGE
// ═══════════════════════════════════════════════
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('notaris@kantor.id');
  const [pass, setPass] = useState('••••••••');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handle = () => {
    if (!email || !pass) { setErr('Email dan password wajib diisi.'); return; }
    setLoading(true); setErr('');
    setTimeout(() => { setLoading(false); onLogin({ nama:'Sari Rahayu', role:'Notaris', email }); }, 1200);
  };

  return (
    <div style={{ minHeight:'100vh', background:T.navy, display:'flex', alignItems:'center', justifyContent:'center', padding:20, position:'relative', overflow:'hidden' }}>
      {/* bg grid */}
      <div style={{ position:'absolute', inset:0, backgroundImage:`linear-gradient(rgba(200,168,75,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(200,168,75,.04) 1px,transparent 1px)`, backgroundSize:'50px 50px' }} />
      <div style={{ position:'absolute', top:'20%', left:'50%', transform:'translateX(-50%)', width:500, height:400, background:'radial-gradient(ellipse,rgba(42,53,128,.5) 0%,transparent 70%)', filter:'blur(40px)', pointerEvents:'none' }} />

      <div style={{ position:'relative', width:'100%', maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ width:52, height:52, background:`linear-gradient(135deg,${T.gold},${T.gold2})`, borderRadius:12, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:700, color:T.navy, fontFamily:'Georgia,serif', marginBottom:14 }}>N</div>
          <div style={{ fontSize:22, fontWeight:700, color:T.white, fontFamily:'Georgia,serif' }}>Notaris<span style={{ color:T.gold }}>Digital</span></div>
          <div style={{ fontSize:13, color:T.gray, marginTop:6 }}>Sistem Operasional Kantor Notaris</div>
        </div>

        <div style={{ ...s.card, padding:32, border:`1px solid ${T.border}` }}>
          <h2 style={{ fontSize:18, fontWeight:700, color:T.white, marginBottom:6 }}>Masuk ke Akun Anda</h2>
          <p style={{ fontSize:13, color:T.gray, marginBottom:24 }}>Gunakan akun yang diberikan administrator</p>

          {err && <div style={{ background:'rgba(224,82,82,.12)', border:`1px solid rgba(224,82,82,.3)`, borderRadius:8, padding:'10px 14px', fontSize:13, color:T.red, marginBottom:16 }}>{err}</div>}

          <FormField label="Email / Username">
            <input style={s.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="email@kantor.id" />
          </FormField>
          <FormField label="Password">
            <input style={s.input} type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" />
          </FormField>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:T.gray, cursor:'pointer' }}>
              <input type="checkbox" style={{ accentColor:T.gold }} /> Ingat saya
            </label>
            <span style={{ fontSize:12.5, color:T.gold, cursor:'pointer' }}>Lupa password?</span>
          </div>

          <button onClick={handle} disabled={loading} style={{
            width:'100%', padding:'12px', background:`linear-gradient(135deg,${T.gold},${T.gold2})`,
            border:'none', borderRadius:8, color:T.navy, fontSize:14, fontWeight:700, cursor:'pointer',
            opacity: loading ? .7 : 1, transition:'all .2s'
          }}>
            {loading ? 'Memuat...' : '→ Masuk ke Sistem'}
          </button>

          <div style={{ marginTop:16, padding:'12px', background:`rgba(200,168,75,.07)`, borderRadius:8, border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, color:T.gray, marginBottom:6, fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase' }}>Demo Login</div>
            <div style={{ fontSize:12, color:T.gray, lineHeight:1.6 }}>Email: <span style={{color:T.gold2}}>notaris@kantor.id</span><br/>Password: <span style={{color:T.gold2}}>demo1234</span></div>
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:20, fontSize:12, color:T.gray2 }}>
          🔒 Dilindungi SSL/TLS • © 2025 NotarisDigital
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════
const NAV = [
  { id:'dashboard',  label:'Dashboard',           icon:<LayoutDashboard size={16}/> },
  { id:'akta',       label:'Manajemen Akta',       icon:<FileText size={16}/> },
  { id:'jadwal',     label:'Jadwal',               icon:<CalendarDays size={16}/> },
  { id:'klapper',    label:'Buku Klapper Digital', icon:<BookOpen size={16}/> },
  { id:'minuta',     label:'Minuta Akta',          icon:<FolderArchive size={16}/> },
  { id:'protokol',   label:'Protokol Notaris',     icon:<ArrowLeftRight size={16}/> },
  { id:'hukum',      label:'Portal Dasar Hukum',   icon:<Scale size={16}/> },
  { id:'users',      label:'Manajemen Pengguna',   icon:<Users size={16}/> },
  { id:'audit',      label:'Audit Log',            icon:<Activity size={16}/> },
  { id:'keamanan',   label:'Keamanan',             icon:<ShieldCheck size={16}/> },
];

function Sidebar({ active, onNav, user, onLogout, collapsed, onToggle }) {
  return (
    <div style={{
      width: collapsed ? 64 : 230, flexShrink:0, background:T.navy, height:'100vh',
      position:'fixed', left:0, top:0, zIndex:50, display:'flex', flexDirection:'column',
      borderRight:`1px solid ${T.border}`, transition:'width .25s',
    }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? '18px 0' : '18px 20px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed && (
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, background:`linear-gradient(135deg,${T.gold},${T.gold2})`, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:T.navy, fontFamily:'Georgia,serif', flexShrink:0 }}>N</div>
            <span style={{ fontSize:15, fontWeight:700, color:T.white, fontFamily:'Georgia,serif' }}>Notaris<span style={{color:T.gold}}>Digital</span></span>
          </div>
        )}
        <button onClick={onToggle} style={{ background:'none', border:'none', color:T.gray, cursor:'pointer', padding:4, display:'flex' }}>
          <Menu size={16}/>
        </button>
      </div>

      {/* Nav */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 0', scrollbarWidth:'none' }}>
        {NAV.map(n => {
          const isActive = n.id === active;
          return (
            <button key={n.id} onClick={() => onNav(n.id)} style={{
              width:'100%', display:'flex', alignItems:'center', gap:12,
              padding: collapsed ? '11px 0' : '11px 18px', justifyContent: collapsed ? 'center' : 'flex-start',
              background: isActive ? 'rgba(200,168,75,.1)' : 'transparent',
              borderLeft: isActive ? `2px solid ${T.gold}` : '2px solid transparent',
              border:'none', cursor:'pointer', transition:'all .15s',
            }}>
              <span style={{ color: isActive ? T.gold2 : T.gray, flexShrink:0 }}>{n.icon}</span>
              {!collapsed && <span style={{ fontSize:13, color: isActive ? T.white : T.gray, fontWeight: isActive ? 600 : 400, whiteSpace:'nowrap' }}>{n.label}</span>}
            </button>
          );
        })}
      </div>

      {/* User */}
      <div style={{ padding: collapsed ? '14px 0' : '14px 16px', borderTop:`1px solid ${T.border}` }}>
        {!collapsed ? (
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${T.accent || T.navy4},${T.gold})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:T.white, flexShrink:0 }}>
              {user.nama.charAt(0)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.5, fontWeight:600, color:T.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.nama}</div>
              <div style={{ fontSize:11, color:T.gray }}>{user.role}</div>
            </div>
            <button onClick={onLogout} style={{ background:'none', border:'none', color:T.gray, cursor:'pointer', padding:4 }}><LogOut size={14}/></button>
          </div>
        ) : (
          <div style={{ display:'flex', justifyContent:'center' }}>
            <button onClick={onLogout} style={{ background:'none', border:'none', color:T.gray, cursor:'pointer' }}><LogOut size={16}/></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════
function Topbar({ title, notifications }) {
  const [showN, setShowN] = useState(false);
  return (
    <div style={{ height:58, background:T.navy2, borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px', position:'sticky', top:0, zIndex:40 }}>
      <div style={{ fontSize:14, color:T.gray, fontWeight:500 }}>{title}</div>
      <div style={{ display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ fontSize:12, color:T.gray }}>{new Date().toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        <div style={{ position:'relative' }}>
          <button onClick={() => setShowN(!showN)} style={{ background:`rgba(200,168,75,.1)`, border:`1px solid ${T.border}`, borderRadius:8, color:T.gold2, cursor:'pointer', padding:'6px 8px', display:'flex', position:'relative' }}>
            <Bell size={15}/>
            <span style={{ position:'absolute', top:4, right:4, width:7, height:7, background:T.red, borderRadius:'50%', border:`2px solid ${T.navy2}` }} />
          </button>
          {showN && (
            <div style={{ position:'absolute', right:0, top:'110%', width:280, ...s.card, padding:0, overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,.5)', border:`1px solid ${T.border}` }}>
              <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.border}`, fontSize:13, fontWeight:600, color:T.white }}>Notifikasi</div>
              {[
                { txt:'Akta 002/2025 menunggu tanda tangan', time:'10 mnt lalu', color:T.gold },
                { txt:'Jadwal pertemuan Bank Nusantara pk 14:00', time:'1 jam lalu', color:T.blue },
                { txt:'Dokumen akta 003/2025 belum lengkap', time:'2 jam lalu', color:T.orange },
              ].map((n,i) => (
                <div key={i} style={{ padding:'12px 16px', borderBottom:`1px solid rgba(255,255,255,.04)`, display:'flex', gap:10, cursor:'pointer' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:n.color, marginTop:5, flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:12.5, color:T.white, lineHeight:1.5 }}>{n.txt}</div>
                    <div style={{ fontSize:11, color:T.gray, marginTop:3 }}>{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 1. DASHBOARD
// ═══════════════════════════════════════════════
function Dashboard({ akta }) {
  const stats = [
    { label:'Akta Bulan Ini',      value:22, sub:'↑ 15% dari bulan lalu', color:T.gold,   icon:<FileText size={18}/> },
    { label:'Akta Tahun 2025',     value:134, sub:'Target: 200 akta',     color:T.blue,   icon:<TrendingUp size={18}/> },
    { label:'Menunggu TTD',        value:akta.filter(a=>a.status==='Menunggu TTD').length, sub:'Perlu tindak lanjut', color:T.orange, icon:<Clock size={18}/> },
    { label:'Total Arsip Digital', value:'3.2 GB', sub:'Backup: Hari ini 06:00', color:T.green,  icon:<FolderArchive size={18}/> },
  ];
  const today = akta.filter(a => a.status !== 'Diarsipkan').slice(0,5);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Ringkasan operasional kantor notaris Anda hari ini" />
      
      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14, marginBottom:24 }}>
        {stats.map((s,i) => <StatCard key={i} {...s}/>)}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16, marginBottom:16 }}>
        {/* Chart bar */}
        <div style={{ ...s.card, padding:22 }}>
          <div style={{ fontSize:14, fontWeight:600, color:T.white, marginBottom:18 }}>Jumlah Akta per Bulan — 2025</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartBulan} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false}/>
              <XAxis dataKey="b" tick={{fontSize:11,fill:T.gray}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:T.gray}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:T.navy3,border:`1px solid ${T.border}`,borderRadius:8,color:T.white,fontSize:12}}/>
              <Bar dataKey="n" fill={T.gold} radius={[4,4,0,0]} name="Jumlah Akta"/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart pie */}
        <div style={{ ...s.card, padding:22 }}>
          <div style={{ fontSize:14, fontWeight:600, color:T.white, marginBottom:14 }}>Status Akta</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={chartPie} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                {chartPie.map((e,i) => <Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip contentStyle={{background:T.navy3,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.white}}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {chartPie.map((p,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:p.color, flexShrink:0 }}/>
                <span style={{ color:T.gray, flex:1 }}>{p.name}</span>
                <span style={{ color:T.white, fontWeight:600 }}>{p.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Recent akta */}
        <div style={{ ...s.card, padding:22 }}>
          <div style={{ fontSize:14, fontWeight:600, color:T.white, marginBottom:14 }}>Akta Terbaru</div>
          {today.map((a,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid rgba(255,255,255,.04)` }}>
              <div>
                <div style={{ fontSize:13, color:T.white, fontWeight:500 }}>{a.nomor}</div>
                <div style={{ fontSize:11.5, color:T.gray }}>{a.penghadap} • {a.jenis}</div>
              </div>
              <Badge status={a.status}/>
            </div>
          ))}
        </div>

        {/* Jadwal hari ini */}
        <div style={{ ...s.card, padding:22 }}>
          <div style={{ fontSize:14, fontWeight:600, color:T.white, marginBottom:14 }}>Jadwal Hari Ini</div>
          {[
            { w:'09:00', t:'PT Maju Bersama', j:'Pertemuan Klien' },
            { w:'11:00', t:'Dewi Lestari', j:'Penandatanganan' },
            { w:'14:00', t:'Bank Nusantara', j:'Pertemuan Klien' },
          ].map((j,i) => (
            <div key={i} style={{ display:'flex', gap:14, padding:'10px 0', borderBottom:`1px solid rgba(255,255,255,.04)` }}>
              <div style={{ fontSize:12, color:T.gold, fontWeight:700, minWidth:40 }}>{j.w}</div>
              <div>
                <div style={{ fontSize:13, color:T.white, fontWeight:500 }}>{j.t}</div>
                <div style={{ fontSize:11.5, color:T.gray }}>{j.j}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop:14, padding:'10px 14px', background:`rgba(200,168,75,.07)`, borderRadius:8, border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12, color:T.gray }}>📋 Ringkasan Arsip</div>
            <div style={{ display:'flex', gap:20, marginTop:8 }}>
              {[['Minuta Akta','134'],['Protokol','9.359'],['Dokumen Pendukung','423']].map(([l,v],i) => (
                <div key={i}>
                  <div style={{ fontSize:16, fontWeight:700, color:T.white }}>{v}</div>
                  <div style={{ fontSize:10.5, color:T.gray }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 2. MANAJEMEN AKTA
// ═══════════════════════════════════════════════
const JENIS_AKTA = ['Jual Beli','PPJB','Pendirian PT','Pendirian CV','Hibah','Kuasa','Kredit','Waris','Wasiat','Fidusia'];
const STATUS_FLOW = ['Draft','Verifikasi','Menunggu TTD','Selesai','Diarsipkan'];

function AktaModule({ akta, setAkta }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [modal, setModal] = useState(null); // null | 'create' | 'edit' | 'detail'
  const [form, setForm] = useState({});
  const [detail, setDetail] = useState(null);

  const filtered = useMemo(() => akta.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.nomor.toLowerCase().includes(q) || a.penghadap.toLowerCase().includes(q) || a.jenis.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'Semua' || a.status === filterStatus;
    return matchSearch && matchStatus;
  }), [akta, search, filterStatus]);

  const openCreate = () => {
    const maxId = Math.max(...akta.map(a=>a.id),0);
    const num = String(maxId+1).padStart(3,'0');
    setForm({ nomor:`${num}/2025/JKT`, tanggal:new Date().toISOString().slice(0,10), jenis:'Jual Beli', penghadap:'', pihak2:'', status:'Draft', ket:'' });
    setModal('create');
  };

  const openEdit = (a) => { setForm({...a}); setModal('edit'); };

  const save = () => {
    if (!form.penghadap) return;
    if (modal === 'create') setAkta(prev => [...prev, { ...form, id: Math.max(...prev.map(a=>a.id),0)+1 }]);
    else setAkta(prev => prev.map(a => a.id === form.id ? form : a));
    setModal(null);
  };

  const del = (id) => setAkta(prev => prev.filter(a => a.id !== id));

  const nextStatus = (a) => {
    const idx = STATUS_FLOW.indexOf(a.status);
    if (idx < STATUS_FLOW.length-1) setAkta(prev => prev.map(x => x.id===a.id ? {...x, status:STATUS_FLOW[idx+1]} : x));
  };

  return (
    <div>
      <PageHeader
        title="Manajemen Akta"
        subtitle={`${akta.length} total akta terdaftar`}
        action={<GoldBtn onClick={openCreate}><Plus size={14}/>Buat Akta Baru</GoldBtn>}
      />

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cari nomor, penghadap, jenis..." />
        <div style={{ display:'flex', gap:6 }}>
          {['Semua','Draft','Verifikasi','Menunggu TTD','Selesai','Diarsipkan'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding:'7px 14px', borderRadius:20, border:`1px solid ${filterStatus===s ? T.gold : T.border}`,
              background: filterStatus===s ? `rgba(200,168,75,.15)` : 'transparent',
              color: filterStatus===s ? T.gold2 : T.gray, fontSize:12, fontWeight: filterStatus===s ? 600 : 400, cursor:'pointer'
            }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ ...s.card, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:`rgba(200,168,75,.04)` }}>
              {['Nomor Akta','Tanggal','Jenis','Penghadap','Pihak Terkait','Status','Aksi'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:T.gray }}>Tidak ada akta ditemukan</td></tr>
            ) : filtered.map(a => (
              <tr key={a.id} style={{ transition:'background .15s' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                <td style={s.td}><span style={{ color:T.gold2, fontWeight:600, fontFamily:'monospace', fontSize:12.5 }}>{a.nomor}</span></td>
                <td style={s.td}><span style={{ color:T.gray, fontSize:12 }}>{a.tanggal}</span></td>
                <td style={s.td}><span style={{ padding:'2px 8px', background:`rgba(82,128,200,.15)`, borderRadius:4, fontSize:12, color:'#8BA8E0' }}>{a.jenis}</span></td>
                <td style={s.td}>{a.penghadap}</td>
                <td style={s.td}><span style={{ color:T.gray }}>{a.pihak2 || '—'}</span></td>
                <td style={s.td}><Badge status={a.status}/></td>
                <td style={s.td}>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => { setDetail(a); setModal('detail'); }} style={{ background:`rgba(82,128,200,.15)`, border:'none', borderRadius:6, color:'#8BA8E0', cursor:'pointer', padding:'5px 8px', display:'flex' }}><Eye size={13}/></button>
                    <button onClick={() => openEdit(a)} style={{ background:`rgba(200,168,75,.12)`, border:'none', borderRadius:6, color:T.gold2, cursor:'pointer', padding:'5px 8px', display:'flex' }}><Edit size={13}/></button>
                    {a.status !== 'Diarsipkan' && (
                      <button onClick={() => nextStatus(a)} title="Lanjut Status" style={{ background:`rgba(82,200,122,.12)`, border:'none', borderRadius:6, color:T.green, cursor:'pointer', padding:'5px 8px', display:'flex' }}><ChevronRight size={13}/></button>
                    )}
                    <button onClick={() => del(a.id)} style={{ background:`rgba(224,82,82,.12)`, border:'none', borderRadius:6, color:T.red, cursor:'pointer', padding:'5px 8px', display:'flex' }}><Trash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={modal==='create'||modal==='edit'} onClose={()=>setModal(null)} title={modal==='create' ? 'Buat Akta Baru' : 'Edit Akta'}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <FormField label="Nomor Akta"><input style={s.input} value={form.nomor||''} onChange={e=>setForm({...form,nomor:e.target.value})} /></FormField>
          <FormField label="Tanggal"><input type="date" style={s.input} value={form.tanggal||''} onChange={e=>setForm({...form,tanggal:e.target.value})} /></FormField>
          <FormField label="Jenis Akta"><Select value={form.jenis||'Jual Beli'} onChange={v=>setForm({...form,jenis:v})} options={JENIS_AKTA}/></FormField>
          <FormField label="Status"><Select value={form.status||'Draft'} onChange={v=>setForm({...form,status:v})} options={STATUS_FLOW}/></FormField>
        </div>
        <FormField label="Nama Penghadap / Pihak Pertama"><input style={s.input} value={form.penghadap||''} onChange={e=>setForm({...form,penghadap:e.target.value})} placeholder="Nama lengkap atau nama perusahaan"/></FormField>
        <FormField label="Pihak Kedua / Terkait"><input style={s.input} value={form.pihak2||''} onChange={e=>setForm({...form,pihak2:e.target.value})} placeholder="Opsional"/></FormField>
        <FormField label="Keterangan"><textarea style={{...s.input,height:70,resize:'vertical'}} value={form.ket||''} onChange={e=>setForm({...form,ket:e.target.value})}/></FormField>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
          <GoldBtn outline onClick={()=>setModal(null)}>Batal</GoldBtn>
          <GoldBtn onClick={save}><Check size={14}/>{modal==='create' ? 'Simpan Akta' : 'Perbarui'}</GoldBtn>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={modal==='detail'} onClose={()=>setModal(null)} title="Detail Akta">
        {detail && (
          <div>
            {[['Nomor Akta',detail.nomor],['Tanggal',detail.tanggal],['Jenis Akta',detail.jenis],['Penghadap',detail.penghadap],['Pihak Terkait',detail.pihak2||'—'],['Keterangan',detail.ket||'—']].map(([l,v])=>(
              <div key={l} style={{ display:'flex', padding:'10px 0', borderBottom:`1px solid rgba(255,255,255,.05)` }}>
                <div style={{ width:140, fontSize:12, color:T.gray, fontWeight:600 }}>{l}</div>
                <div style={{ fontSize:13, color:T.white }}>{v}</div>
              </div>
            ))}
            <div style={{ display:'flex', padding:'10px 0' }}>
              <div style={{ width:140, fontSize:12, color:T.gray, fontWeight:600 }}>Status</div>
              <Badge status={detail.status}/>
            </div>
            <div style={{ marginTop:16, padding:14, background:`rgba(200,168,75,.07)`, borderRadius:8, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, color:T.gray, marginBottom:10, fontWeight:600, letterSpacing:'.05em' }}>ALUR STATUS</div>
              <div style={{ display:'flex', gap:0 }}>
                {STATUS_FLOW.map((s,i) => {
                  const idx = STATUS_FLOW.indexOf(detail.status);
                  const done = i <= idx;
                  return (
                    <div key={s} style={{ display:'flex', alignItems:'center', flex:1 }}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                        <div style={{ width:20, height:20, borderRadius:'50%', background: done ? T.gold : T.navy3, border:`2px solid ${done ? T.gold : T.border}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {done && <Check size={10} style={{color:T.navy}}/>}
                        </div>
                        <div style={{ fontSize:9, color: done ? T.gold2 : T.gray, textAlign:'center', lineHeight:1.2 }}>{s}</div>
                      </div>
                      {i < STATUS_FLOW.length-1 && <div style={{ flex:1, height:2, background: i < idx ? T.gold : T.border, margin:'0 4px 18px' }}/>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 3. JADWAL
// ═══════════════════════════════════════════════
function JadwalModule({ jadwal, setJadwal }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [filterJenis, setFilterJenis] = useState('Semua');

  const jenisOpts = ['Pertemuan Klien','Penandatanganan','Internal'];
  const grouped = useMemo(() => {
    const f = filterJenis === 'Semua' ? jadwal : jadwal.filter(j => j.jenis === filterJenis);
    return f.reduce((acc, j) => { (acc[j.tanggal] = acc[j.tanggal]||[]).push(j); return acc; }, {});
  }, [jadwal, filterJenis]);

  const openCreate = () => { setForm({ tanggal:new Date().toISOString().slice(0,10), waktu:'09:00', jenis:'Pertemuan Klien', klien:'', lokasi:'', ket:'' }); setModal(true); };
  const save = () => {
    if (!form.klien) return;
    setJadwal(prev => [...prev, { ...form, id: Math.max(...prev.map(j=>j.id),0)+1 }]);
    setModal(false);
  };

  const jColor = { 'Pertemuan Klien':T.blue, 'Penandatanganan':T.gold, 'Internal':T.gray };

  return (
    <div>
      <PageHeader title="Jadwal" subtitle="Kelola agenda operasional kantor" action={<GoldBtn onClick={openCreate}><Plus size={14}/>Tambah Jadwal</GoldBtn>}/>

      <div style={{ display:'flex', gap:6, marginBottom:18 }}>
        {['Semua',...jenisOpts].map(j => (
          <button key={j} onClick={() => setFilterJenis(j)} style={{
            padding:'7px 14px', borderRadius:20, border:`1px solid ${filterJenis===j ? T.gold : T.border}`,
            background: filterJenis===j ? `rgba(200,168,75,.15)` : 'transparent',
            color: filterJenis===j ? T.gold2 : T.gray, fontSize:12, fontWeight:600, cursor:'pointer'
          }}>{j}</button>
        ))}
      </div>

      {Object.keys(grouped).sort().map(tgl => (
        <div key={tgl} style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.gold, letterSpacing:'.08em', textTransform:'uppercase', marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${T.border}` }}>
            📅 {new Date(tgl+'T12:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            {tgl === new Date().toISOString().slice(0,10) && <span style={{ marginLeft:10, padding:'2px 8px', background:`rgba(200,168,75,.2)`, borderRadius:100, fontSize:10, color:T.gold2 }}>Hari Ini</span>}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {grouped[tgl].sort((a,b)=>a.waktu.localeCompare(b.waktu)).map(j => (
              <div key={j.id} style={{ ...s.card, padding:'16px 20px', display:'flex', gap:16, alignItems:'flex-start', borderLeft:`3px solid ${jColor[j.jenis]||T.gray}` }}>
                <div style={{ minWidth:46, textAlign:'center' }}>
                  <div style={{ fontSize:16, fontWeight:700, color:T.white }}>{j.waktu}</div>
                  <div style={{ fontSize:10, color:T.gray, marginTop:2 }}>WIB</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                    <div style={{ fontSize:14, fontWeight:600, color:T.white }}>{j.klien}</div>
                    <span style={{ padding:'2px 8px', background:`${jColor[j.jenis]||T.gray}22`, borderRadius:100, fontSize:11, color:jColor[j.jenis]||T.gray, fontWeight:600 }}>{j.jenis}</span>
                  </div>
                  <div style={{ fontSize:12.5, color:T.gray }}>{j.ket}</div>
                  <div style={{ fontSize:12, color:T.gray2, marginTop:4 }}>📍 {j.lokasi}</div>
                </div>
                <button onClick={() => setJadwal(prev => prev.filter(x=>x.id!==j.id))} style={{ background:'none', border:'none', color:T.gray2, cursor:'pointer', padding:4 }}><Trash2 size={13}/></button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {Object.keys(grouped).length === 0 && <EmptyState icon="📅" text="Tidak ada jadwal tersedia"/>}

      <Modal open={modal} onClose={() => setModal(false)} title="Tambah Jadwal">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <FormField label="Tanggal"><input type="date" style={s.input} value={form.tanggal||''} onChange={e=>setForm({...form,tanggal:e.target.value})}/></FormField>
          <FormField label="Waktu"><input type="time" style={s.input} value={form.waktu||''} onChange={e=>setForm({...form,waktu:e.target.value})}/></FormField>
          <FormField label="Jenis Jadwal"><Select value={form.jenis||'Pertemuan Klien'} onChange={v=>setForm({...form,jenis:v})} options={jenisOpts}/></FormField>
          <FormField label="Lokasi"><input style={s.input} value={form.lokasi||''} onChange={e=>setForm({...form,lokasi:e.target.value})} placeholder="Ruang Meeting 1"/></FormField>
        </div>
        <FormField label="Nama Klien / Agenda"><input style={s.input} value={form.klien||''} onChange={e=>setForm({...form,klien:e.target.value})} placeholder="Nama klien atau agenda"/></FormField>
        <FormField label="Keterangan"><textarea style={{...s.input,height:70,resize:'vertical'}} value={form.ket||''} onChange={e=>setForm({...form,ket:e.target.value})}/></FormField>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <GoldBtn outline onClick={()=>setModal(false)}>Batal</GoldBtn>
          <GoldBtn onClick={save}><Check size={14}/>Simpan</GoldBtn>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 4. BUKU KLAPPER DIGITAL
// ═══════════════════════════════════════════════
function KlapperModule() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [alpha, setAlpha] = useState('Semua');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return klapperData.filter(k => {
      const matchQ = !q || k.nama.toLowerCase().includes(q);
      const matchA = alpha === 'Semua' || k.nama.toUpperCase().startsWith(alpha);
      return matchQ && matchA;
    });
  }, [search, alpha]);

  return (
    <div>
      <PageHeader title="Buku Klapper Digital" subtitle={`${klapperData.length} nama terdaftar dalam indeks`} />
      
      <div style={{ display:'flex', gap:12, marginBottom:18 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cari nama penghadap atau perusahaan..."/>
      </div>

      {/* Alphabet filter */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:20 }}>
        <button onClick={() => setAlpha('Semua')} style={{ padding:'5px 10px', borderRadius:6, border:`1px solid ${alpha==='Semua' ? T.gold : T.border}`, background: alpha==='Semua' ? `rgba(200,168,75,.15)` : 'transparent', color: alpha==='Semua' ? T.gold2 : T.gray, fontSize:12, fontWeight:600, cursor:'pointer' }}>Semua</button>
        {alphabet.map(a => {
          const hasData = klapperData.some(k => k.nama.toUpperCase().startsWith(a));
          return (
            <button key={a} onClick={() => hasData && setAlpha(a)} style={{ padding:'5px 9px', borderRadius:6, border:`1px solid ${alpha===a ? T.gold : T.border}`, background: alpha===a ? `rgba(200,168,75,.15)` : 'transparent', color: alpha===a ? T.gold2 : hasData ? T.gray : T.gray2, fontSize:12, fontWeight:600, cursor: hasData ? 'pointer' : 'default', opacity: hasData ? 1 : .3 }}>{a}</button>
          );
        })}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        {/* List */}
        <div style={{ ...s.card, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:`rgba(200,168,75,.04)` }}>
                {['Nama','Jenis','Akta Terdaftar','Terakhir'].map(h=><th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((k,i) => (
                <tr key={i} onClick={() => setSelected(k)} style={{ cursor:'pointer', background: selected?.nama===k.nama ? `rgba(200,168,75,.07)` : '', transition:'background .15s' }} onMouseEnter={e=>{if(selected?.nama!==k.nama)e.currentTarget.style.background='rgba(255,255,255,.02)'}} onMouseLeave={e=>{if(selected?.nama!==k.nama)e.currentTarget.style.background=''}}>
                  <td style={s.td}><span style={{ fontWeight:600, color:T.white }}>{k.nama}</span></td>
                  <td style={s.td}><span style={{ fontSize:11.5, padding:'2px 8px', background: k.jenis==='Perusahaan' ? `rgba(82,128,200,.15)` : `rgba(82,200,122,.12)`, borderRadius:100, color: k.jenis==='Perusahaan' ? '#8BA8E0' : T.green }}>{k.jenis}</span></td>
                  <td style={s.td}><span style={{ color:T.gold2, fontFamily:'monospace', fontSize:12 }}>{k.akta.join(', ')}</span></td>
                  <td style={s.td}><span style={{ color:T.gray, fontSize:12 }}>{k.terakhir}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} style={{ padding:40, textAlign:'center', color:T.gray }}>Tidak ada hasil</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        <div style={{ ...s.card, padding:20 }}>
          {selected ? (
            <div>
              <div style={{ width:48, height:48, borderRadius:12, background:`linear-gradient(135deg,${T.navy4},${T.gold})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:T.white, fontFamily:'Georgia,serif', marginBottom:14 }}>
                {selected.nama.charAt(0)}
              </div>
              <div style={{ fontSize:16, fontWeight:700, color:T.white, marginBottom:4 }}>{selected.nama}</div>
              <span style={{ fontSize:12, padding:'2px 10px', background: selected.jenis==='Perusahaan' ? `rgba(82,128,200,.15)` : `rgba(82,200,122,.12)`, borderRadius:100, color: selected.jenis==='Perusahaan' ? '#8BA8E0' : T.green }}>{selected.jenis}</span>
              <div style={{ marginTop:16, fontSize:12, color:T.gray, marginBottom:8, fontWeight:600, letterSpacing:'.05em' }}>AKTA TERDAFTAR</div>
              {selected.akta.map((a,i) => (
                <div key={i} style={{ padding:'8px 12px', background:T.navy3, borderRadius:8, marginBottom:6, fontSize:12.5, color:T.gold2, fontFamily:'monospace', border:`1px solid ${T.border}` }}>{a}</div>
              ))}
              <div style={{ marginTop:12, fontSize:12, color:T.gray }}>Terakhir diperbarui: <span style={{color:T.white}}>{selected.terakhir}</span></div>
            </div>
          ) : (
            <EmptyState icon="👆" text="Pilih nama untuk melihat detail"/>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 5. MINUTA AKTA
// ═══════════════════════════════════════════════
function MinutaModule() {
  const [files, setFiles] = useState(minutaData);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Semua');
  const [uploading, setUploading] = useState(false);

  const filtered = files.filter(f => {
    const q = search.toLowerCase();
    const matchQ = !q || f.nama.toLowerCase().includes(q) || f.nomor.toLowerCase().includes(q);
    const matchF = filter==='Semua' || f.format===filter;
    return matchQ && matchF;
  });

  const formatIcon = { PDF:'📄', JPG:'🖼️', PNG:'🖼️', DOCX:'📝' };
  const fmtColor = { PDF:'rgba(224,82,82,.15)', JPG:'rgba(82,128,200,.15)', PNG:'rgba(82,128,200,.15)', DOCX:'rgba(82,200,122,.12)' };

  const simulateUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setFiles(prev => [...prev, { id:prev.length+1, nama:`Dokumen Baru ${prev.length+1}`, nomor:'003/2025/JKT', ukuran:'1.5 MB', format:'PDF', tanggal:new Date().toISOString().slice(0,10) }]);
      setUploading(false);
    }, 1500);
  };

  return (
    <div>
      <PageHeader
        title="Penyimpanan Minuta Akta"
        subtitle={`${files.length} dokumen tersimpan • Total ${files.reduce((a,f)=>a,0)} tersimpan aman`}
        action={
          <GoldBtn onClick={simulateUpload}>
            {uploading ? <><RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/>Mengunggah...</> : <><Upload size={14}/>Upload Dokumen</>}
          </GoldBtn>
        }
      />

      <div style={{ display:'flex', gap:10, marginBottom:18 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cari nama atau nomor akta..."/>
        {['Semua','PDF','JPG','DOCX'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${filter===f ? T.gold : T.border}`, background: filter===f ? `rgba(200,168,75,.15)` : 'transparent', color: filter===f ? T.gold2 : T.gray, fontSize:12, fontWeight:600, cursor:'pointer' }}>{f}</button>
        ))}
      </div>

      {/* Storage summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[['Total Dokumen',files.length,'📂',T.gold],['Minuta Akta',files.filter(f=>f.nama.includes('Minuta')).length,'📄',T.blue],['Dokumen KTP/ID',files.filter(f=>f.nama.includes('KTP')||f.nama.includes('NPWP')).length,'🪪',T.green],['Lainnya',files.filter(f=>!f.nama.includes('Minuta')&&!f.nama.includes('KTP')&&!f.nama.includes('NPWP')).length,'📎',T.gray]].map(([l,v,ic,c])=>(
          <div key={l} style={{ ...s.card, padding:'16px 18px', display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:22 }}>{ic}</span>
            <div><div style={{ fontSize:20, fontWeight:700, color:c }}>{v}</div><div style={{ fontSize:11.5, color:T.gray }}>{l}</div></div>
          </div>
        ))}
      </div>

      {/* Files grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:12 }}>
        {filtered.map(f => (
          <div key={f.id} style={{ ...s.card, padding:18, transition:'all .2s', cursor:'default' }} onMouseEnter={e=>e.currentTarget.style.borderColor=T.borderB} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <div style={{ fontSize:32, marginBottom:10, textAlign:'center' }}>{formatIcon[f.format]||'📄'}</div>
            <div style={{ fontSize:12.5, fontWeight:600, color:T.white, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.nama}</div>
            <div style={{ fontSize:11.5, color:T.gold2, marginBottom:8, fontFamily:'monospace' }}>{f.nomor}</div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, padding:'2px 8px', background:fmtColor[f.format]||'rgba(138,141,168,.15)', borderRadius:4, color:T.gray }}>{f.format} • {f.ukuran}</span>
            </div>
            <div style={{ fontSize:11, color:T.gray2, marginTop:8 }}>{f.tanggal}</div>
            <div style={{ display:'flex', gap:6, marginTop:12 }}>
              <button style={{ flex:1, padding:'6px', background:`rgba(82,128,200,.15)`, border:`1px solid rgba(82,128,200,.2)`, borderRadius:6, color:'#8BA8E0', cursor:'pointer', fontSize:11.5, fontWeight:600 }}>👁 Preview</button>
              <button style={{ flex:1, padding:'6px', background:`rgba(200,168,75,.1)`, border:`1px solid ${T.border}`, borderRadius:6, color:T.gold2, cursor:'pointer', fontSize:11.5, fontWeight:600 }}><Download size={11}/> Unduh</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 6. PROTOKOL NOTARIS
// ═══════════════════════════════════════════════
function ProtokolModule() {
  const [protokol, setProto] = useState(protokolData);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');

  const filtered = protokol.filter(p => !search || p.notaris.toLowerCase().includes(search.toLowerCase()) || p.wilayah.toLowerCase().includes(search.toLowerCase()));

  const save = () => {
    if (!form.notaris) return;
    setProto(prev => [...prev, { ...form, id:prev.length+1, jumlah:parseInt(form.jumlah)||0, status:'Dalam Proses' }]);
    setModal(false);
  };

  return (
    <div>
      <PageHeader
        title="Transfer Protokol Notaris"
        subtitle="Pengelolaan arsip dari notaris yang telah pensiun"
        action={<GoldBtn onClick={()=>{ setForm({ notaris:'', sk:'', wilayah:'', penyerahan:new Date().toISOString().slice(0,10), jumlah:'', tahun:'', status:'Dalam Proses' }); setModal(true); }}><Plus size={14}/>Tambah Protokol</GoldBtn>}
      />

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
        <StatCard label="Total Protokol Diterima" value={protokol.length} color={T.gold} icon={<ArrowLeftRight size={18}/>}/>
        <StatCard label="Total Akta Protokol" value={protokol.reduce((a,p)=>a+p.jumlah,0).toLocaleString()} color={T.blue} icon={<FileText size={18}/>}/>
        <StatCard label="Proses Serah Terima" value={protokol.filter(p=>p.status==='Dalam Proses').length} color={T.orange} icon={<Clock size={18}/>}/>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cari nama notaris atau wilayah..."/>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {filtered.map(p => (
          <div key={p.id} style={{ ...s.card, padding:'20px 24px', display:'flex', gap:20, alignItems:'flex-start' }}>
            <div style={{ width:50, height:50, borderRadius:12, background:`rgba(200,168,75,.1)`, border:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Scale size={20} style={{ color:T.gold }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:T.white }}>{p.notaris}</div>
                  <div style={{ fontSize:12.5, color:T.gray, marginTop:2 }}>SK: <span style={{color:T.gold2,fontFamily:'monospace'}}>{p.sk}</span> • Wilayah: {p.wilayah}</div>
                </div>
                <Badge status={p.status}/>
              </div>
              <div style={{ display:'flex', gap:24, marginTop:10 }}>
                {[['Jumlah Akta',p.jumlah.toLocaleString(),T.gold],['Rentang Tahun',p.tahun,T.blue],['Tanggal Serah Terima',p.penyerahan,T.green]].map(([l,v,c])=>(
                  <div key={l}>
                    <div style={{ fontSize:16, fontWeight:700, color:c }}>{v}</div>
                    <div style={{ fontSize:11, color:T.gray }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title="Tambah Protokol Notaris">
        <FormField label="Nama Notaris Asal"><input style={s.input} value={form.notaris||''} onChange={e=>setForm({...form,notaris:e.target.value})} placeholder="Notaris ... S.H., M.Kn."/></FormField>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <FormField label="Nomor SK"><input style={s.input} value={form.sk||''} onChange={e=>setForm({...form,sk:e.target.value})} placeholder="SK/YYYY/KEM-HUK/XXX"/></FormField>
          <FormField label="Wilayah Kerja"><input style={s.input} value={form.wilayah||''} onChange={e=>setForm({...form,wilayah:e.target.value})} placeholder="Jakarta Selatan"/></FormField>
          <FormField label="Tanggal Penyerahan"><input type="date" style={s.input} value={form.penyerahan||''} onChange={e=>setForm({...form,penyerahan:e.target.value})}/></FormField>
          <FormField label="Jumlah Akta"><input type="number" style={s.input} value={form.jumlah||''} onChange={e=>setForm({...form,jumlah:e.target.value})} placeholder="0"/></FormField>
          <FormField label="Rentang Tahun"><input style={s.input} value={form.tahun||''} onChange={e=>setForm({...form,tahun:e.target.value})} placeholder="1998–2024"/></FormField>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
          <GoldBtn outline onClick={()=>setModal(false)}>Batal</GoldBtn>
          <GoldBtn onClick={save}><Check size={14}/>Simpan</GoldBtn>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 7. PORTAL HUKUM
// ═══════════════════════════════════════════════
const HUKUM_CATS = ['Semua','Undang-Undang','Peraturan Pemerintah','Peraturan Menteri','Putusan Pengadilan','Surat Edaran'];

function HukumModule() {
  const [hukum, setHukum] = useState(initHukum);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('Semua');

  const filtered = hukum.filter(h => {
    const q = search.toLowerCase();
    const matchQ = !q || h.judul.toLowerCase().includes(q) || h.nomor.toLowerCase().includes(q);
    const matchC = cat==='Semua' || h.kat===cat;
    return matchQ && matchC;
  });

  const toggleBookmark = (id) => setHukum(prev => prev.map(h => h.id===id ? {...h, bookmark:!h.bookmark} : h));

  const catColor = { 'Undang-Undang':T.gold, 'Peraturan Pemerintah':T.blue, 'Peraturan Menteri':'#A87AE0', 'Putusan Pengadilan':T.orange, 'Surat Edaran':T.green };

  return (
    <div>
      <PageHeader title="Portal Dasar Hukum" subtitle="Referensi peraturan & regulasi kenotariatan"/>

      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cari judul, nomor peraturan..."/>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {HUKUM_CATS.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            padding:'7px 14px', borderRadius:20, border:`1px solid ${cat===c ? T.gold : T.border}`,
            background: cat===c ? `rgba(200,168,75,.15)` : 'transparent',
            color: cat===c ? T.gold2 : T.gray, fontSize:12, fontWeight:600, cursor:'pointer'
          }}>{c}</button>
        ))}
      </div>

      {/* Bookmarked */}
      {cat === 'Semua' && !search && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:12, fontWeight:700, color:T.gold, letterSpacing:'.08em', textTransform:'uppercase', marginBottom:10 }}>⭐ Tersimpan / Bookmark</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {hukum.filter(h=>h.bookmark).map(h => (
              <div key={h.id} style={{ ...s.card, padding:'14px 18px', display:'flex', gap:14, alignItems:'center', border:`1px solid rgba(200,168,75,.2)` }}>
                <BookMarked size={16} style={{ color:T.gold, flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, color:T.white, fontWeight:500 }}>{h.judul}</div>
                  <div style={{ fontSize:11.5, color:T.gray, marginTop:2 }}>{h.nomor} • {h.tahun}</div>
                </div>
                <button onClick={() => toggleBookmark(h.id)} style={{ background:'none', border:'none', color:T.gold, cursor:'pointer', padding:4 }}><Star size={14} fill={T.gold}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.map(h => (
          <div key={h.id} style={{ ...s.card, padding:'16px 20px', display:'flex', gap:16, alignItems:'center', transition:'all .2s' }} onMouseEnter={e=>e.currentTarget.style.borderColor=T.borderB} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <div style={{ width:42, height:42, borderRadius:8, background:`${catColor[h.kat]||T.gray}15`, border:`1px solid ${catColor[h.kat]||T.gray}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Scale size={16} style={{ color:catColor[h.kat]||T.gray }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13.5, color:T.white, fontWeight:500, marginBottom:4 }}>{h.judul}</div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <span style={{ fontSize:11, padding:'2px 8px', background:`${catColor[h.kat]||T.gray}15`, borderRadius:100, color:catColor[h.kat]||T.gray, fontWeight:600 }}>{h.kat}</span>
                <span style={{ fontSize:11.5, color:T.gray }}>{h.nomor} • {h.tahun}</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => toggleBookmark(h.id)} style={{ background:'none', border:'none', color: h.bookmark ? T.gold : T.gray2, cursor:'pointer', padding:6 }}>
                {h.bookmark ? <Star size={15} fill={T.gold}/> : <Star size={15}/>}
              </button>
              <button style={{ padding:'6px 14px', background:`rgba(82,128,200,.15)`, border:`1px solid rgba(82,128,200,.2)`, borderRadius:6, color:'#8BA8E0', cursor:'pointer', fontSize:12, fontWeight:600 }}>Buka</button>
              <button style={{ padding:'6px 12px', background:`rgba(200,168,75,.1)`, border:`1px solid ${T.border}`, borderRadius:6, color:T.gold2, cursor:'pointer', fontSize:12 }}><Download size={13}/></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState icon="⚖️" text="Tidak ada referensi hukum ditemukan"/>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 8. MANAJEMEN PENGGUNA
// ═══════════════════════════════════════════════
const ROLES = ['Super Admin','Notaris','Staf Administrasi','Member'];

function UsersModule() {
  const [users, setUsers] = useState(initUsers);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');

  const filtered = users.filter(u => !search || u.nama.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => { setForm({ nama:'', email:'', role:'Staf Administrasi', status:'Aktif' }); setModal('create'); };
  const openEdit = (u) => { setForm({...u}); setModal('edit'); };
  const save = () => {
    if (!form.nama || !form.email) return;
    if (modal==='create') setUsers(prev => [...prev, { ...form, id:prev.length+1, lastLogin:'—' }]);
    else setUsers(prev => prev.map(u => u.id===form.id ? form : u));
    setModal(null);
  };
  const toggleStatus = (id) => setUsers(prev => prev.map(u => u.id===id ? {...u, status:u.status==='Aktif'?'Nonaktif':'Aktif'} : u));
  const del = (id) => setUsers(prev => prev.filter(u => u.id!==id));

  const roleColor = { 'Super Admin':T.red, 'Notaris':T.gold, 'Staf Administrasi':T.blue, 'Member':T.green };
  const avatarColor = { 'Super Admin':'135deg,#8B0000,#E05252', 'Notaris':`135deg,${T.navy4},${T.gold}`, 'Staf Administrasi':`135deg,#1a3a8b,${T.blue}`, 'Member':`135deg,#0a5c2e,${T.green}` };

  return (
    <div>
      <PageHeader title="Manajemen Pengguna" subtitle={`${users.length} pengguna terdaftar`} action={<GoldBtn onClick={openCreate}><Plus size={14}/>Tambah Pengguna</GoldBtn>}/>

      <div style={{ display:'flex', gap:10, marginBottom:18 }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cari nama atau email..."/>
      </div>

      {/* Role summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {ROLES.map(r => (
          <div key={r} style={{ ...s.card, padding:'14px 16px', display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ width:36, height:36, borderRadius:8, background:`${roleColor[r]}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <User size={16} style={{ color:roleColor[r] }}/>
            </div>
            <div>
              <div style={{ fontSize:18, fontWeight:700, color:T.white }}>{users.filter(u=>u.role===r).length}</div>
              <div style={{ fontSize:11, color:T.gray }}>{r}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...s.card, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:`rgba(200,168,75,.04)` }}>
              {['Pengguna','Role','Status','Terakhir Login','Aksi'].map(h => <th key={h} style={s.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td style={s.td}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(${avatarColor[u.role]||'135deg,#333,#666'})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:T.white, flexShrink:0 }}>{u.nama.charAt(0)}</div>
                    <div>
                      <div style={{ fontSize:13.5, fontWeight:600, color:T.white }}>{u.nama}</div>
                      <div style={{ fontSize:12, color:T.gray }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td style={s.td}><span style={{ padding:'3px 10px', background:`${roleColor[u.role]}20`, borderRadius:100, fontSize:12, color:roleColor[u.role], fontWeight:600 }}>{u.role}</span></td>
                <td style={s.td}><Badge status={u.status}/></td>
                <td style={s.td}><span style={{ fontSize:12, color:T.gray }}>{u.lastLogin}</span></td>
                <td style={s.td}>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => openEdit(u)} style={{ background:`rgba(200,168,75,.12)`, border:'none', borderRadius:6, color:T.gold2, cursor:'pointer', padding:'5px 8px', display:'flex' }}><Edit size={13}/></button>
                    <button onClick={() => toggleStatus(u.id)} style={{ background:`rgba(82,128,200,.15)`, border:'none', borderRadius:6, color:'#8BA8E0', cursor:'pointer', padding:'5px 8px', fontSize:11, fontWeight:600 }}>{u.status==='Aktif'?'Nonaktifkan':'Aktifkan'}</button>
                    {u.role !== 'Super Admin' && <button onClick={() => del(u.id)} style={{ background:`rgba(224,82,82,.12)`, border:'none', borderRadius:6, color:T.red, cursor:'pointer', padding:'5px 8px', display:'flex' }}><Trash2 size={13}/></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal==='create' ? 'Tambah Pengguna' : 'Edit Pengguna'}>
        <FormField label="Nama Lengkap"><input style={s.input} value={form.nama||''} onChange={e=>setForm({...form,nama:e.target.value})} placeholder="Nama lengkap"/></FormField>
        <FormField label="Email"><input type="email" style={s.input} value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})} placeholder="email@kantor.id"/></FormField>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <FormField label="Role"><Select value={form.role||'Staf Administrasi'} onChange={v=>setForm({...form,role:v})} options={ROLES}/></FormField>
          <FormField label="Status"><Select value={form.status||'Aktif'} onChange={v=>setForm({...form,status:v})} options={['Aktif','Nonaktif']}/></FormField>
        </div>
        {modal === 'create' && <FormField label="Password Awal"><input type="password" style={s.input} placeholder="Minimal 8 karakter"/></FormField>}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
          <GoldBtn outline onClick={()=>setModal(null)}>Batal</GoldBtn>
          <GoldBtn onClick={save}><Check size={14}/>{modal==='create' ? 'Tambah' : 'Perbarui'}</GoldBtn>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 9. AUDIT LOG
// ═══════════════════════════════════════════════
function AuditModule() {
  const [search, setSearch] = useState('');
  const [filterModul, setFilterModul] = useState('Semua');
  const moduls = ['Semua','Autentikasi','Manajemen Akta','Minuta Akta','Jadwal','Portal Hukum','Manajemen Pengguna'];

  const aksiIcon = { 'Login':'🔐', 'Logout':'🚪', 'Lihat Akta':'👁', 'Buat Akta':'✏️', 'Edit Akta':'🖊', 'Ubah Status':'🔄', 'Upload Dokumen':'📤', 'Unduh Dokumen':'📥', 'Tambah Pengguna':'👤', 'Buat Jadwal':'📅', 'Portal Hukum':'⚖️' };
  const aksiColor = { 'Login':T.green, 'Logout':T.gray, 'Buat Akta':T.gold, 'Upload Dokumen':T.blue, 'Tambah Pengguna':T.gold, 'Ubah Status':T.orange };

  const filtered = auditData.filter(a => {
    const q = search.toLowerCase();
    const matchQ = !q || a.user.toLowerCase().includes(q) || a.aksi.toLowerCase().includes(q) || a.detail.toLowerCase().includes(q);
    const matchM = filterModul==='Semua' || a.modul===filterModul;
    return matchQ && matchM;
  });

  return (
    <div>
      <PageHeader title="Audit Log" subtitle={`${auditData.length} aktivitas tercatat`} action={<GoldBtn outline small><Download size={13}/>Export Log</GoldBtn>}/>

      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Cari user, aksi, atau detail..."/>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {moduls.map(m => (
            <button key={m} onClick={() => setFilterModul(m)} style={{ padding:'7px 12px', borderRadius:20, border:`1px solid ${filterModul===m ? T.gold : T.border}`, background: filterModul===m ? `rgba(200,168,75,.15)` : 'transparent', color: filterModul===m ? T.gold2 : T.gray, fontSize:12, fontWeight:600, cursor:'pointer' }}>{m}</button>
          ))}
        </div>
      </div>

      <div style={{ ...s.card, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:`rgba(200,168,75,.04)` }}>
              {['Waktu','Pengguna','Aksi','Detail','Modul'].map(h => <th key={h} style={s.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <tr key={a.id} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'} onMouseLeave={e=>e.currentTarget.style.background=''} style={{ transition:'background .15s' }}>
                <td style={s.td}><span style={{ fontSize:11.5, color:T.gray, fontFamily:'monospace' }}>{a.waktu}</span></td>
                <td style={s.td}><span style={{ fontWeight:600, color:T.white, fontSize:13 }}>{a.user}</span></td>
                <td style={s.td}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12.5, color:aksiColor[a.aksi]||T.white }}>
                    <span>{aksiIcon[a.aksi]||'📋'}</span>{a.aksi}
                  </span>
                </td>
                <td style={s.td}><span style={{ fontSize:12.5, color:T.gray }}>{a.detail}</span></td>
                <td style={s.td}><span style={{ fontSize:11.5, padding:'2px 8px', background:`rgba(82,128,200,.12)`, borderRadius:100, color:'#8BA8E0' }}>{a.modul}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 10. KEAMANAN
// ═══════════════════════════════════════════════
function KeamananModule() {
  const [twoFA, setTwoFA] = useState(false);
  const [session, setSession] = useState('8');

  const items = [
    { icon:<Lock size={20}/>, title:'Enkripsi Database', desc:'Seluruh data sensitif disimpan dalam database terenkripsi AES-256', status:'Aktif', color:T.green },
    { icon:<Shield size={20}/>, title:'SSL/TLS Koneksi', desc:'Semua transmisi data menggunakan SSL/TLS 256-bit', status:'Aktif', color:T.green },
    { icon:<Activity size={20}/>, title:'Firewall & Monitoring', desc:'Pemantauan ancaman real-time dan proteksi DDoS', status:'Aktif', color:T.green },
    { icon:<Key size={20}/>, title:'Two-Factor Authentication', desc:'Verifikasi dua langkah untuk keamanan login tambahan', status: twoFA ? 'Aktif' : 'Nonaktif', color: twoFA ? T.green : T.orange, toggle:true },
    { icon:<FileSearch size={20}/>, title:'Audit Log Otomatis', desc:'Pencatatan seluruh aktivitas pengguna secara otomatis', status:'Aktif', color:T.green },
    { icon:<RefreshCw size={20}/>, title:'Backup Otomatis', desc:'Backup harian ke cloud storage, retensi 30 hari', status:'Aktif', color:T.green },
  ];

  return (
    <div>
      <PageHeader title="Keamanan Sistem" subtitle="Pengaturan dan status keamanan platform"/>

      {/* Security score */}
      <div style={{ ...s.card, padding:'24px 28px', marginBottom:20, background:`linear-gradient(135deg,${T.navy2},${T.navy3})`, border:`1px solid rgba(82,200,122,.2)` }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13, color:T.gray, marginBottom:6 }}>Skor Keamanan Sistem</div>
            <div style={{ fontSize:40, fontWeight:700, color:T.green, fontFamily:'Georgia,serif' }}>{twoFA ? '98' : '85'}<span style={{ fontSize:18, color:T.gray }}>/100</span></div>
            <div style={{ fontSize:12.5, color:T.gray, marginTop:4 }}>{twoFA ? '✅ Keamanan sangat baik — semua fitur aktif' : '⚠️ Aktifkan 2FA untuk meningkatkan keamanan'}</div>
          </div>
          <div style={{ width:80, height:80, borderRadius:'50%', border:`4px solid ${twoFA ? T.green : T.orange}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <ShieldCheck size={32} style={{ color: twoFA ? T.green : T.orange }}/>
          </div>
        </div>
        <div style={{ marginTop:16, height:6, background:T.navy, borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width: twoFA ? '98%' : '85%', background:`linear-gradient(90deg,${T.green},${T.gold})`, borderRadius:3, transition:'width .5s' }}/>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
        {items.map((it,i) => (
          <div key={i} style={{ ...s.card, padding:'18px 20px', display:'flex', gap:14, alignItems:'flex-start', transition:'all .2s' }} onMouseEnter={e=>e.currentTarget.style.borderColor=T.borderB} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <div style={{ width:44, height:44, borderRadius:10, background:`${it.color}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ color:it.color }}>{it.icon}</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                <div style={{ fontSize:14, fontWeight:600, color:T.white }}>{it.title}</div>
                <Badge status={it.status}/>
              </div>
              <div style={{ fontSize:12.5, color:T.gray, lineHeight:1.6 }}>{it.desc}</div>
              {it.toggle && (
                <button onClick={() => setTwoFA(!twoFA)} style={{ marginTop:10, padding:'6px 16px', background: twoFA ? `rgba(82,200,122,.15)` : `rgba(200,168,75,.15)`, border:`1px solid ${twoFA ? T.green : T.gold}30`, borderRadius:6, color: twoFA ? T.green : T.gold2, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  {twoFA ? '🔒 Nonaktifkan 2FA' : '🔐 Aktifkan 2FA'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Session settings */}
      <div style={{ ...s.card, padding:'20px 24px' }}>
        <div style={{ fontSize:14, fontWeight:600, color:T.white, marginBottom:16 }}>Pengaturan Sesi</div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:`1px solid rgba(255,255,255,.05)` }}>
          <div>
            <div style={{ fontSize:13.5, color:T.white }}>Batas Waktu Sesi</div>
            <div style={{ fontSize:12, color:T.gray }}>Pengguna otomatis logout setelah tidak aktif</div>
          </div>
          <select value={session} onChange={e=>setSession(e.target.value)} style={{ ...s.input, width:'auto', padding:'6px 12px', fontSize:13 }}>
            {['1','2','4','8','24'].map(v => <option key={v} value={v}>{v} jam</option>)}
          </select>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0' }}>
          <div>
            <div style={{ fontSize:13.5, color:T.white }}>Sesi Aktif Saat Ini</div>
            <div style={{ fontSize:12, color:T.gray }}>3 pengguna sedang aktif dalam sistem</div>
          </div>
          <button style={{ padding:'7px 16px', background:`rgba(224,82,82,.12)`, border:`1px solid rgba(224,82,82,.25)`, borderRadius:6, color:T.red, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
            Cabut Semua Sesi
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [akta, setAkta] = useState(initAkta);
  const [jadwal, setJadwal] = useState(initJadwal);

  if (!user) return <LoginPage onLogin={setUser}/>;

  const ML = collapsed ? 64 : 230;
  const PAGE_TITLES = {
    dashboard:'Dashboard',akta:'Manajemen Akta',jadwal:'Jadwal',
    klapper:'Buku Klapper Digital',minuta:'Penyimpanan Minuta Akta',
    protokol:'Transfer Protokol Notaris',hukum:'Portal Dasar Hukum',
    users:'Manajemen Pengguna',audit:'Audit Log',keamanan:'Keamanan',
  };

  const renderPage = () => {
    switch(page) {
      case 'dashboard': return <Dashboard akta={akta}/>;
      case 'akta':      return <AktaModule akta={akta} setAkta={setAkta}/>;
      case 'jadwal':    return <JadwalModule jadwal={jadwal} setJadwal={setJadwal}/>;
      case 'klapper':   return <KlapperModule/>;
      case 'minuta':    return <MinutaModule/>;
      case 'protokol':  return <ProtokolModule/>;
      case 'hukum':     return <HukumModule/>;
      case 'users':     return <UsersModule/>;
      case 'audit':     return <AuditModule/>;
      case 'keamanan':  return <KeamananModule/>;
      default:          return null;
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:T.navy, fontFamily:"'Outfit',system-ui,sans-serif", color:T.white }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(200,168,75,.3);border-radius:2px}
        input,select,textarea{font-family:inherit}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      <Sidebar active={page} onNav={setPage} user={user} onLogout={() => setUser(null)} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}/>

      <div style={{ marginLeft:ML, minHeight:'100vh', display:'flex', flexDirection:'column', transition:'margin .25s' }}>
        <Topbar title={PAGE_TITLES[page]}/>
        <main style={{ flex:1, padding:24, maxWidth:1400 }}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
