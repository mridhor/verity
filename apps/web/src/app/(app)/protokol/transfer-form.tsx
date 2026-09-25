"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogActions, DialogButton, useCloseOnOk } from "@/components/ui/dialog";
import { FormError, Textarea } from "@/components/ui/blocks";
import { Input, Label } from "@/components/ui/input";
import { createTransfer, type FormState } from "./actions";

export function TransferForm({ today }: { today: string }) {
  return (
    <DialogButton variant="ink" icon={<Plus size={14} />} label="Catat serah terima" title="Catat serah terima protokol" size="lg">
      <Form today={today} />
    </DialogButton>
  );
}

function Form({ today }: { today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createTransfer, {});
  useCloseOnOk(state);
  return (
    <form action={action} className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
      <div className="col-span-full">
        <FormError message={state.error} />
        <DialogActions>
          <Button type="submit" variant="ink" disabled={pending}>Simpan</Button>
        </DialogActions>
      </div>
    </form>
  );
}
