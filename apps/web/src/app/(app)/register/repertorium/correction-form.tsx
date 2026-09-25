"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/blocks";
import { DialogActions, DialogButton, useCloseOnOk } from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";
import { correctEntry, type FormState } from "../actions";

export function CorrectionForm({ entryId, label }: { entryId: string; label?: string }) {
  return (
    <DialogButton variant="ghost" buttonSize="sm" label="Koreksi" title="Catat koreksi repertorium" size="sm"
      description={`${label ? `${label}. ` : ""}Entri lama tidak diubah; koreksi dicatat sebagai entri baru.`}>
      <Form entryId={entryId} />
    </DialogButton>
  );
}

function Form({ entryId }: { entryId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(correctEntry, {});
  useCloseOnOk(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="entryId" value={entryId} />
      <div>
        <Label htmlFor="note">Apa yang dikoreksi dan mengapa</Label>
        <Textarea id="note" name="note" required autoFocus />
      </div>
      <FormError message={state.error} />
      <DialogActions>
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "Menyimpan…" : "Catat koreksi"}</Button>
      </DialogActions>
    </form>
  );
}
