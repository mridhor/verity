"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogActions, DialogButton } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { BERKAS_TYPES } from "@/lib/berkas-types";
import { createBerkas, type FormState } from "./actions";

export function NewBerkasForm() {
  return (
    <DialogButton variant="ink" icon={<Plus size={14} />} label="Berkas baru" title="Berkas baru"
      description="Anda otomatis menjadi anggota dan penanggung jawab berkas ini.">
      <Form />
    </DialogButton>
  );
}

function Form() {
  const [state, action, pending] = useActionState<FormState, FormData>(createBerkas, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="type">Jenis berkas</Label>
        <Select id="type" name="type" defaultValue="pendirian_pt">
          {BERKAS_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="title">Nama berkas</Label>
        <Input id="title" name="title" placeholder="Pendirian PT Sinar Kopi Nusantara" required autoFocus />
      </div>
      {state.error && <p role="alert" className="text-[12.5px] text-destructive">{state.error}</p>}
      <DialogActions>
        <Button type="submit" variant="ink" disabled={pending}>{pending ? "Menyimpan…" : "Buat berkas"}</Button>
      </DialogActions>
    </form>
  );
}
