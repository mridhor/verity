"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { BERKAS_TYPES } from "@/lib/berkas-types";
import { createBerkas, type FormState } from "./actions";

export function NewBerkasForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(createBerkas, {});

  if (!open) {
    return (
      <Button variant="ink" onClick={() => setOpen(true)}>
        <Plus size={14} /> Berkas baru
      </Button>
    );
  }
  return (
    <form action={action} className="w-[360px] space-y-3 rounded-md border border-border bg-card p-4">
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
        <Input id="title" name="title" placeholder="Pendirian PT Sinar Kopi Nusantara" required />
      </div>
      {state.error && <p role="alert" className="text-[12.5px] text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="ink" disabled={pending}>{pending ? "Menyimpan…" : "Buat berkas"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
      </div>
    </form>
  );
}
