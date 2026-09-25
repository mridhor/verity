"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogActions, DialogButton, useCloseOnOk } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/blocks";
import { Input, Label, Select } from "@/components/ui/input";
import { LEGAL_CATEGORIES, LEGAL_CATEGORY_LABEL } from "@/lib/labels";
import { createReference, type FormState } from "./actions";

export function ReferenceForm() {
  return (
    <DialogButton variant="ink" icon={<Plus size={14} />} label="Tambah referensi" title="Tambah dasar hukum" description="Referensi baru berstatus belum terverifikasi sampai diperiksa Notaris." size="lg">
      <Form />
    </DialogButton>
  );
}

function Form() {
  const [state, action, pending] = useActionState<FormState, FormData>(createReference, {});
  useCloseOnOk(state);
  return (
    <form action={action} className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
      <div className="col-span-full">
        <FormError message={state.error} />
        <DialogActions>
          <Button type="submit" variant="ink" disabled={pending}>Simpan</Button>
        </DialogActions>
      </div>
    </form>
  );
}
