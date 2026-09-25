"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { upsertOfficial, type FormState } from "./actions";

export function OfficialForm({ notaries }: { notaries: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(upsertOfficial, {});
  if (notaries.length === 0) {
    return <p className="text-[12.5px] text-subtle">Tambahkan pengguna berperan Notaris/PPAT terlebih dahulu.</p>;
  }
  return (
    <form action={action} className="grid grid-cols-2 gap-3 md:grid-cols-5">
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
      <div className="md:col-span-3">
        <Label htmlFor="o-name">Nama lengkap dengan gelar</Label>
        <Input id="o-name" name="displayName" placeholder="Sari Rahayu, S.H., M.Kn." required />
      </div>
      <div className="md:col-span-3">
        <Label htmlFor="o-ked">Tempat kedudukan / daerah kerja</Label>
        <Input id="o-ked" name="kedudukan" placeholder="Kota Administrasi Jakarta Selatan" />
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="o-sk">Nomor SK pengangkatan</Label>
        <Input id="o-sk" name="skRef" />
      </div>
      <div className="col-span-2 flex items-center gap-3 md:col-span-5">
        <Button type="submit" variant="ink" disabled={pending}>Simpan pejabat</Button>
        {(state.error || state.ok) && (
          <span role="status" className={`text-[12.5px] ${state.error ? "text-destructive" : "text-success"}`}>{state.error ?? state.ok}</span>
        )}
      </div>
    </form>
  );
}
