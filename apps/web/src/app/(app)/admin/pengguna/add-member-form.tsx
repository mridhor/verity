"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { APP_ROLES, ROLE_LABEL } from "@/lib/roles";
import { addMember, type FormState } from "./actions";

export function AddMemberForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addMember, {});
  return (
    <form action={action} className="grid grid-cols-[1fr_1fr_180px_auto] items-end gap-2">
      <div>
        <Label htmlFor="email">Email akun</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="displayName">Nama tampilan</Label>
        <Input id="displayName" name="displayName" required />
      </div>
      <div>
        <Label htmlFor="role">Peran</Label>
        <Select id="role" name="role" defaultValue="staf_admin">
          {APP_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="ink" disabled={pending}>Tambahkan</Button>
      {(state.error || state.ok) && (
        <p role="status" className={`col-span-4 text-[12.5px] ${state.error ? "text-destructive" : "text-success"}`}>
          {state.error ?? state.ok}
        </p>
      )}
    </form>
  );
}
