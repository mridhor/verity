"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/blocks";
import { Input } from "@/components/ui/input";
import { correctEntry, type FormState } from "../actions";

export function CorrectionForm({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(correctEntry, {});
  if (state.ok) return <span className="text-[11.5px] text-success">{state.ok}</span>;
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Koreksi</Button>;
  return (
    <form action={action} className="flex min-w-72 flex-col gap-1.5">
      <input type="hidden" name="entryId" value={entryId} />
      <Input name="note" placeholder="Apa yang dikoreksi dan mengapa" required autoFocus />
      <div className="flex gap-1.5">
        <Button size="sm" type="submit" variant="primary" disabled={pending}>Catat koreksi</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
