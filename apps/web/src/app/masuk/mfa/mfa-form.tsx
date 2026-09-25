"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Enrolment = { factorId: string; qr: string; secret: string };

/** TOTP enrolment (first time) or verification, raising the session to aal2 (REQ-GW-05). */
export function MfaForm({ next }: { next: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return setError("Tidak dapat memuat faktor autentikasi.");
      const verified = data.totp[0];
      if (verified) return setFactorId(verified.id);
      // Remove half-finished enrolments before starting a new one.
      for (const f of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Verity" });
      if (enrolled.error) return setError("Pendaftaran autentikator gagal.");
      setFactorId(enrolled.data.id);
      setEnrolment({ factorId: enrolled.data.id, qr: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret });
    })();
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) return setError("Kode tidak cocok atau sudah kedaluwarsa.");
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      {enrolment && (
        <div className="space-y-3">
          <p className="text-[13px] leading-relaxed">
            Pindai kode QR ini dengan aplikasi autentikator (misalnya Google Authenticator atau 1Password), lalu
            masukkan kode 6 digit.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL from Supabase Auth */}
          <img src={enrolment.qr} alt="Kode QR autentikator" className="mx-auto size-40 rounded-md border border-border bg-card p-2" />
          <p className="text-center text-[11.5px] text-subtle">
            Kunci manual: <code className="tabular-nums text-muted-foreground">{enrolment.secret}</code>
          </p>
        </div>
      )}
      <div>
        <Label htmlFor="code">Kode autentikator</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="tabular-nums tracking-[0.3em]"
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" variant="ink" className="h-9 w-full" disabled={busy || !factorId}>
        {busy ? "Memverifikasi…" : "Verifikasi"}
      </Button>
    </form>
  );
}
