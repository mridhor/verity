import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Section } from "@/components/ui/blocks";
import { Button } from "@/components/ui/button";
import { requirePrincipal } from "@/lib/auth";
import { MFA_REQUIRED } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { signOutOtherSessions } from "./actions";

function Row({ ok, title, children }: { ok: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b border-border-soft py-3 last:border-0">
      {ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" /> : <CircleAlert size={17} className="mt-0.5 shrink-0 text-warning" />}
      <div>
        <div className="text-[13.5px] font-medium">{title}</div>
        <div className="text-[12.5px] text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

export default async function KeamananPage({ searchParams }: { searchParams: Promise<{ sesi?: string }> }) {
  const me = await requirePrincipal();
  const { sesi } = await searchParams;
  const supabase = await createClient();
  const [{ data: factors }, chain] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    me.role === "notaris" || me.role === "super_admin" ? supabase.rpc("audit_chain_status") : Promise.resolve(null),
  ]);
  const totp = factors?.totp ?? [];
  const mfaRequired = MFA_REQUIRED.has(me.role);

  return (
    <>
      <PageHeader eyebrow="Akun dan sistem" title="Keamanan" />
      <div className="mx-auto w-full max-w-[860px] space-y-5 px-8 py-7">
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
