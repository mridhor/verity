"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/blocks";
import { Input, Label } from "@/components/ui/input";
import { createTransfer, type FormState } from "./actions";

export function TransferForm({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(createTransfer, {});
  if (!open) return <Button variant="ink" onClick={() => setOpen(true)}><Plus size={14} /> Catat serah terima</Button>;
  return (
    <form action={action} className="grid w-full grid-cols-2 gap-3 rounded-md border border-border bg-card p-4 md:grid-cols-3">
      <div className="col-span-2 md:col-span-3">
        <Label htmlFor="sourceName">Nama notaris asal</Label>
        <Input id="sourceName" name="sourceName" placeholder="Notaris …, S.H., M.Kn." required />
      </div>
      <div>
        <Label htmlFor="skRef">Nomor SK</Label>
        <Input id="skRef" name="skRef" />
      </div>
      <div>
        <Label htmlFor="wilayah">Wilayah kerja</Label>
        <Input id="wilayah" name="wilayah" />
      </div>
      <div>
        <Label htmlFor="handoverDate">Tanggal penyerahan</Label>
        <Input id="handoverDate" name="handoverDate" type="date" defaultValue={today} max={today} required />
      </div>
      <div>
        <Label htmlFor="aktaCount">Jumlah akta</Label>
        <Input id="aktaCount" name="aktaCount" type="number" min={0} defaultValue={0} required />
      </div>
      <div>
        <Label htmlFor="yearRange">Rentang tahun</Label>
        <Input id="yearRange" name="yearRange" placeholder="1998–2024" />
      </div>
      <div className="col-span-2 md:col-span-3">
        <Label htmlFor="notes">Keterangan</Label>
        <Textarea id="notes" name="notes" />
      </div>
      <div className="col-span-2 flex items-center gap-2 md:col-span-3">
        <Button type="submit" variant="ink" disabled={pending}>Simpan</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Tutup</Button>
        <FormError message={state.error} />
        {state.ok && <span className="text-[12.5px] text-success">{state.ok}</span>}
      </div>
    </form>
  );
}
