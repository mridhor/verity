"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/blocks";
import { Input, Label, Select } from "@/components/ui/input";
import { addChecklistItem, type FormState } from "../checklist-actions";

export function ChecklistForm({ berkasId, members }: { berkasId: string; members: { id: string; name: string }[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const res = await addChecklistItem(prev, fd);
    if (!res.error) ref.current?.reset();
    return res;
  }, {});
  return (
    <form ref={ref} action={action} className="grid grid-cols-[1fr_160px_150px_auto] items-end gap-2">
      <input type="hidden" name="berkasId" value={berkasId} />
      <div>
        <Label htmlFor="title">Item baru</Label>
        <Input id="title" name="title" placeholder="Minta NPWP Laras Anggraini" required />
      </div>
      <div>
        <Label htmlFor="assignee">Penanggung jawab</Label>
        <Select id="assignee" name="assignee" defaultValue="">
          <option value="">—</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="dueDate">Tenggat</Label>
        <Input id="dueDate" name="dueDate" type="date" />
      </div>
      <Button type="submit" disabled={pending}>Tambah</Button>
      <div className="col-span-4"><FormError message={state.error} /></div>
    </form>
  );
}
