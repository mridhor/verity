"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/blocks";
import { DialogActions, DialogButton, useCloseOnOk } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { addChecklistItem, type FormState } from "../checklist-actions";

type Props = { berkasId: string; members: { id: string; name: string }[] };

export function ChecklistForm(props: Props) {
  return (
    <DialogButton variant="ink" icon={<Plus size={14} />} label="Tambah item" title="Item checklist baru" size="sm">
      <Form {...props} />
    </DialogButton>
  );
}

function Form({ berkasId, members }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const res = await addChecklistItem(prev, fd);
    return res.error ? res : { ...res, ok: "Item ditambahkan." };
  }, {});
  useCloseOnOk(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="berkasId" value={berkasId} />
      <div>
        <Label htmlFor="title">Item</Label>
        <Input id="title" name="title" placeholder="Minta NPWP Laras Anggraini" required autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
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
      </div>
      <FormError message={state.error} />
      <DialogActions>
        <Button type="submit" variant="ink" disabled={pending}>{pending ? "Menyimpan…" : "Tambah"}</Button>
      </DialogActions>
    </form>
  );
}
