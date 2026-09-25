"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogActions, DialogButton, useCloseOnOk } from "@/components/ui/dialog";
import { FormError, Textarea } from "@/components/ui/blocks";
import { Input, Label, Select } from "@/components/ui/input";
import { SCHEDULE_KINDS, SCHEDULE_KIND_LABEL } from "@/lib/labels";
import { createSchedule, type FormState } from "./actions";

export function ScheduleForm({ today, berkas }: { today: string; berkas: { id: string; title: string }[] }) {
  return (
    <DialogButton variant="ink" icon={<Plus size={14} />} label="Tambah jadwal" title="Tambah jadwal" size="lg">
      <Form today={today} berkas={berkas} />
    </DialogButton>
  );
}

function Form({ today, berkas }: { today: string; berkas: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSchedule, {});
  useCloseOnOk(state);
  return (
    <form action={action} className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div>
        <Label htmlFor="date">Tanggal</Label>
        <Input id="date" name="date" type="date" defaultValue={today} required />
      </div>
      <div>
        <Label htmlFor="time">Waktu (WIB)</Label>
        <Input id="time" name="time" type="time" defaultValue="09:00" required />
      </div>
      <div>
        <Label htmlFor="kind">Jenis</Label>
        <Select id="kind" name="kind" defaultValue="pertemuan_klien">
          {SCHEDULE_KINDS.map((k) => <option key={k} value={k}>{SCHEDULE_KIND_LABEL[k]}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="location">Lokasi</Label>
        <Input id="location" name="location" placeholder="Ruang Meeting 1" />
      </div>
      <div className="col-span-2">
        <Label htmlFor="title">Klien / agenda</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="col-span-2">
        <Label htmlFor="berkasId">Berkas terkait (opsional)</Label>
        <Select id="berkasId" name="berkasId" defaultValue="">
          <option value="">Agenda kantor (tanpa berkas)</option>
          {berkas.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </Select>
      </div>
      <div className="col-span-2 md:col-span-4">
        <Label htmlFor="notes">Keterangan</Label>
        <Textarea id="notes" name="notes" />
      </div>
      <div className="col-span-full">
        <FormError message={state.error} />
        <DialogActions>
          <Button type="submit" variant="ink" disabled={pending}>{pending ? "Menyimpan…" : "Simpan jadwal"}</Button>
        </DialogActions>
      </div>
    </form>
  );
}
