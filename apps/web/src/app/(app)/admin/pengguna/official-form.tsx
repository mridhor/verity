"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/blocks";
import { DialogActions, DialogButton, useCloseOnOk } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { upsertOfficial, type FormState } from "./actions";

export function OfficialForm({ notaries }: { notaries: { id: string; name: string }[] }) {
  if (notaries.length === 0) {
    return <p className="text-[12.5px] text-subtle">Tambahkan pengguna berperan Notaris/PPAT terlebih dahulu.</p>;
  }
  return (
    <DialogButton icon={<Plus size={14} />} label="Tambah / ubah pejabat" title="Data pejabat"
      description="Satu baris per pengangkatan. Orang yang sama bisa punya pengangkatan Notaris dan PPAT.">
      <Form notaries={notaries} />
    </DialogButton>
  );
}

function Form({ notaries }: { notaries: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(upsertOfficial, {});
  useCloseOnOk(state);
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor="o-user">Notaris</Label>
        <Select id="o-user" name="userId" defaultValue={notaries[0]!.id}>
          {notaries.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="o-app">Pengangkatan</Label>
        <Select id="o-app" name="appointment" defaultValue="notaris">
          <option value="notaris">Notaris</option>
          <option value="ppat">PPAT</option>
        </Select>
      </div>
      <div className="col-span-2">
        <Label htmlFor="o-name">Nama lengkap dengan gelar</Label>
        <Input id="o-name" name="displayName" placeholder="Sari Rahayu, S.H., M.Kn." required />
      </div>
      <div className="col-span-2">
        <Label htmlFor="o-ked">Tempat kedudukan / daerah kerja</Label>
        <Input id="o-ked" name="kedudukan" placeholder="Kota Administrasi Jakarta Selatan" />
      </div>
      <div className="col-span-2">
        <Label htmlFor="o-sk">Nomor SK pengangkatan</Label>
        <Input id="o-sk" name="skRef" />
      </div>
      <div className="col-span-full">
        <FormError message={state.error} />
        <DialogActions>
          <Button type="submit" variant="ink" disabled={pending}>{pending ? "Menyimpan…" : "Simpan pejabat"}</Button>
        </DialogActions>
      </div>
    </form>
  );
}
