"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogActions, DialogButton } from "@/components/ui/dialog";
import { FormError, Textarea } from "@/components/ui/blocks";
import { Input, Label, Select } from "@/components/ui/input";
import { AKTA_TYPES } from "@/lib/labels";
import { createAkta, type FormState } from "../actions";

type Option = { id: string; label: string };

export type NewAktaOptions = { berkas: Option[]; officials: Option[]; defaultBerkas?: string };

/** "Akta baru" as a centered dialog (list page and berkas Akta tab). */
export function NewAktaDialog(props: NewAktaOptions) {
  const blocked = props.officials.length === 0
    ? "Belum ada data pejabat (Notaris/PPAT). Super Admin perlu menambahkannya di halaman Pengguna."
    : props.berkas.length === 0 ? "Belum ada berkas aktif. Buat berkas terlebih dahulu." : null;
  return (
    <DialogButton variant="ink" icon={<Plus size={14} />} label="Akta baru" title="Akta baru"
      description="Draft tanpa nomor; nomor diberikan saat Notaris memfinalkan akta.">
      {blocked ? <p className="text-[13px] text-muted-foreground">{blocked}</p> : <NewAktaForm {...props} inDialog />}
    </DialogButton>
  );
}

export function NewAktaForm({ berkas, officials, defaultBerkas, inDialog }: NewAktaOptions & { inDialog?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createAkta, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="berkasId">Berkas</Label>
        <Select id="berkasId" name="berkasId" defaultValue={defaultBerkas ?? ""} required>
          <option value="" disabled>Pilih berkas</option>
          {berkas.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="aktaType">Jenis akta</Label>
          <Select id="aktaType" name="aktaType" defaultValue="" required>
            <option value="" disabled>Pilih jenis</option>
            {AKTA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="officialId">Pejabat</Label>
          <Select id="officialId" name="officialId" defaultValue={officials.length === 1 ? officials[0]!.id : ""} required>
            <option value="" disabled>Pilih pejabat</option>
            {officials.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="title">Judul akta</Label>
        <Input id="title" name="title" placeholder="Akta Pendirian PT Sinar Kopi Nusantara" required />
      </div>
      <div>
        <Label htmlFor="notes">Keterangan (opsional)</Label>
        <Textarea id="notes" name="notes" />
      </div>
      {!inDialog && (
        <p className="text-[12px] text-subtle">
          Akta dibuat sebagai draft tanpa nomor. Nomor diberikan otomatis saat Notaris memfinalkan akta dan tidak pernah dipakai ulang.
        </p>
      )}
      <FormError message={state.error} />
      {inDialog ? (
        <DialogActions>
          <Button type="submit" variant="ink" disabled={pending}>{pending ? "Menyimpan…" : "Buat draft akta"}</Button>
        </DialogActions>
      ) : (
        <Button type="submit" variant="ink" disabled={pending}>{pending ? "Menyimpan…" : "Buat draft akta"}</Button>
      )}
    </form>
  );
}
