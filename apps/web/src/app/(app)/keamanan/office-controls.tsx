"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/blocks";
import { DialogActions, DialogButton, useCloseOnOk } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { updateOfficeSettings, type SettingsState } from "./actions";

export function OfficeSettingsDialog({ timeout, target }: { timeout: number; target: number | null }) {
  return (
    <DialogButton buttonSize="sm" label="Ubah pengaturan" title="Pengaturan kantor" size="sm">
      <SettingsForm timeout={timeout} target={target} />
    </DialogButton>
  );
}

function SettingsForm({ timeout, target }: { timeout: number; target: number | null }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateOfficeSettings, {});
  useCloseOnOk(state);
  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="timeout">Batas waktu sesi</Label>
        <Select id="timeout" name="timeout" defaultValue={String(timeout)}>
          {[1, 2, 4, 8, 12, 24].map((h) => <option key={h} value={h}>{h} jam</option>)}
        </Select>
        <p className="mt-1 text-[12px] text-subtle">Pengguna harus masuk kembali setelah durasi ini sejak login.</p>
      </div>
      <div>
        <Label htmlFor="target">Target akta final per tahun</Label>
        <Input id="target" name="target" type="number" min={1} defaultValue={target ?? ""} placeholder="Tidak ditetapkan" />
      </div>
      <FormError message={state.error} />
      <DialogActions>
        <Button type="submit" variant="ink" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
      </DialogActions>
    </form>
  );
}

/** Turn off 2FA (only offered to roles for which it is optional). */
export function DisableMfaButton({ factorId }: { factorId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2">
      <Button size="sm" variant="danger" disabled={busy} onClick={async () => {
        setBusy(true);
        const { error: e } = await createClient().auth.mfa.unenroll({ factorId });
        setBusy(false);
        if (e) setError("Gagal. Masuk dengan verifikasi dua langkah terlebih dahulu, lalu coba lagi.");
        else router.refresh();
      }}>{busy ? "Memproses…" : "Nonaktifkan 2FA"}</Button>
      <FormError message={error} />
    </div>
  );
}
