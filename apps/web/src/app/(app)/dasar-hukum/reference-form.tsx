"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/blocks";
import { Input, Label, Select } from "@/components/ui/input";
import { LEGAL_CATEGORIES, LEGAL_CATEGORY_LABEL } from "@/lib/labels";
import { createReference, type FormState } from "./actions";

export function ReferenceForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(createReference, {});
  if (!open) return <Button variant="ink" onClick={() => setOpen(true)}><Plus size={14} /> Tambah referensi</Button>;
  return (
    <form action={action} className="grid w-full grid-cols-2 gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-4">
      <div>
        <Label htmlFor="category">Kategori</Label>
        <Select id="category" name="category" defaultValue="undang_undang">
          {LEGAL_CATEGORIES.map((c) => <option key={c} value={c}>{LEGAL_CATEGORY_LABEL[c]}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="numberLabel">Nomor</Label>
        <Input id="numberLabel" name="numberLabel" placeholder="UU 2/2014" required />
      </div>
      <div>
        <Label htmlFor="year">Tahun</Label>
        <Input id="year" name="year" type="number" min={1800} max={2100} />
      </div>
      <div>
        <Label htmlFor="sourceUrl">Tautan sumber resmi</Label>
        <Input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://peraturan.go.id/…" />
      </div>
      <div className="col-span-2 md:col-span-4">
        <Label htmlFor="title">Judul</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="col-span-2 flex items-center gap-2 md:col-span-4">
        <Button type="submit" variant="ink" disabled={pending}>Simpan</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Tutup</Button>
        <FormError message={state.error} />
        {state.ok && <span className="text-[12.5px] text-success">{state.ok}</span>}
      </div>
    </form>
  );
}
