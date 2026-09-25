import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Section } from "@/components/ui/blocks";
import { Button } from "@/components/ui/button";
import { requirePrincipal } from "@/lib/auth";
import { MFA_REQUIRED } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { ConfirmAction } from "@/components/ui/dialog";
import { revokeOfficeSessions, signOutOtherSessions } from "./actions";
import { DisableMfaButton, OfficeSettingsDialog } from "./office-controls";

function Row({ ok, title, children }: { ok: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-t border-border-soft py-3.5 first:border-0">
      {ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" /> : <CircleAlert size={17} className="mt-0.5 shrink-0 text-warning" />}
      <div>
        <div className="text-[13.5px] font-medium">{title}</div>
        <div className="text-[12.5px] text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

export default async function KeamananPage({ searchParams }: { searchParams: Promise<{ sesi?: string; jumlah?: string }> }) {
  const me = await requirePrincipal();
  const { sesi, jumlah } = await searchParams;
  const supabase = await createClient();
  const officeAdmin = (me.role === "notaris" || me.role === "super_admin") && me.aal === "aal2";
  const [{ data: factors }, chain, { data: settings }, stats] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    me.role === "notaris" || me.role === "super_admin" ? supabase.rpc("audit_chain_status") : Promise.resolve(null),
    supabase.from("tenant_settings").select("annual_akta_target, session_timeout_hours").maybeSingle(),
    officeAdmin ? supabase.rpc("office_session_stats") : Promise.resolve(null),
  ]);
  const timeout = settings?.session_timeout_hours ?? 8;
  const sessionStats = (stats?.data as { sessions: number; users: number }[] | null | undefined)?.[0];
  const totp = factors?.totp ?? [];
  const mfaRequired = MFA_REQUIRED.has(me.role);

  return (
    <>
      <PageHeader eyebrow="Akun dan sistem" title="Keamanan" />
      <div className="w-full max-w-[860px] space-y-5 px-8 pt-5 pb-10">
        <Section title="Akun Anda">
          <ul>
            <Row ok={totp.length > 0} title="Verifikasi dua langkah (TOTP)">
              {totp.length > 0
                ? `Aktif sejak ${formatDateTime(totp[0]!.created_at)}. Sesi ini ${me.aal === "aal2" ? "sudah" : "belum"} diverifikasi dua langkah.`
                : mfaRequired
                  ? "Wajib untuk peran Anda."
                  : "Tidak wajib untuk peran Anda, tetapi sangat disarankan."}
              {totp.length === 0 && (
                <div className="mt-2"><Link href="/masuk/mfa?next=/keamanan" className="font-medium text-foreground underline-offset-2 hover:underline">Aktifkan sekarang</Link></div>
              )}
              {totp.length > 0 && mfaRequired && <div className="mt-1 text-[11.5px] text-subtle">Tidak dapat dinonaktifkan untuk Notaris, Partner, dan Super Admin.</div>}
              {totp.length > 0 && !mfaRequired && <DisableMfaButton factorId={totp[0]!.id} />}
            </Row>
            <Row ok title="Kata sandi">
              Dikelola oleh Supabase Auth; aplikasi tidak pernah menyimpan kata sandi. Minimal 10 karakter.
              <div className="mt-2"><Link href="/masuk/sandi-baru" className="font-medium text-foreground underline-offset-2 hover:underline">Ubah kata sandi</Link></div>
            </Row>
            <Row ok title="Sesi di perangkat lain">
              {sesi === "keluar" ? "Semua sesi lain telah dikeluarkan." : "Keluarkan akun ini dari semua perangkat lain, misalnya jika perangkat hilang."}
              <form action={signOutOtherSessions} className="mt-2">
                <Button size="sm" variant="danger">Keluar dari semua perangkat lain</Button>
              </form>
            </Row>
          </ul>
        </Section>

        <Section title="Sesi dan pengaturan kantor"
          description={`Batas waktu sesi ${timeout} jam${settings?.annual_akta_target ? ` · target ${settings.annual_akta_target} akta per tahun` : ""}.`}
          actions={officeAdmin ? <OfficeSettingsDialog timeout={timeout} target={settings?.annual_akta_target ?? null} /> : undefined}>
          <ul>
            <Row ok title="Batas waktu sesi">
              Setiap pengguna diminta masuk kembali {timeout} jam setelah login, apa pun aktivitasnya.
              {!officeAdmin && <div className="mt-1 text-[11.5px] text-subtle">Diatur oleh Notaris atau Super Admin.</div>}
            </Row>
            {officeAdmin && (
              <Row ok title="Sesi aktif di kantor">
                {sessionStats ? `${sessionStats.sessions} sesi aktif dari ${sessionStats.users} pengguna dalam ${timeout} jam terakhir.` : "Tidak dapat dihitung saat ini."}
                {sesi === "kantor" && <div className="mt-1 text-success">{jumlah ?? 0} sesi pengguna lain telah dicabut.</div>}
                {sesi === "gagal" && <div className="mt-1 text-destructive">Pencabutan sesi gagal.</div>}
                <div className="mt-2">
                  <ConfirmAction label="Cabut semua sesi kantor" buttonSize="sm" title="Cabut semua sesi kantor?"
                    description="Semua pengguna lain di kantor ini dikeluarkan dari semua perangkat dan harus masuk kembali. Token yang sudah terbit tetap berlaku paling lama 1 jam. Sesi Anda sendiri tidak dicabut."
                    confirmLabel="Cabut semua sesi" action={revokeOfficeSessions} fields={{}} />
                </div>
              </Row>
            )}
          </ul>
        </Section>

        <Section title="Perlindungan sistem">
          <ul>
            <Row ok title="Akses per berkas di database">
              Row Level Security memeriksa kantor dan keanggotaan berkas pada setiap permintaan, termasuk unduhan dokumen.
            </Row>
            <Row ok title="Pendaftaran publik ditutup">Akun hanya dibuat oleh administrator; peran diberikan oleh Super Admin.</Row>
            <Row ok title="Nomor akta dan register tidak dapat diubah">
              Nomor diberikan hanya saat finalisasi; repertorium, klapper, dan audit log hanya dapat ditambah, tidak diubah atau dihapus.
            </Row>
            {chain && (
              <Row ok={!chain.error && chain.data === null} title="Integritas audit log">
                {chain.error ? "Tidak dapat diperiksa saat ini." : chain.data === null ? "Rantai hash utuh." : `Rantai hash rusak mulai entri #${chain.data}.`}
              </Row>
            )}
            <Row ok title="Enkripsi">Koneksi memakai TLS; penyimpanan database dan file terenkripsi oleh penyedia.</Row>
          </ul>
        </Section>
      </div>
    </>
  );
}
