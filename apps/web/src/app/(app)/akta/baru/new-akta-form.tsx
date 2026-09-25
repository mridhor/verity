"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/blocks";
import { Input, Label, Select } from "@/components/ui/input";
import { AKTA_TYPES } from "@/lib/labels";
import { createAkta, type FormState } from "../actions";

type Option = { id: string; label: string };

export function NewAktaForm({ berkas, officials, defaultBerkas }: { berkas: Option[]; officials: Option[]; defaultBerkas?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createAkta, {});
  return (
    <form action={action} className="max-w-xl space-y-4 rounded-md border border-border bg-card p-5">
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
      <p className="text-[12px] text-subtle">
        Akta dibuat sebagai draft tanpa nomor. Nomor diberikan otomatis saat Notaris memfinalkan akta dan tidak pernah dipakai ulang.
      </p>
      <FormError message={state.error} />
      <Button type="submit" variant="ink" disabled={pending}>{pending ? "Menyimpan…" : "Buat draft akta"}</Button>
    </form>
  );
}
