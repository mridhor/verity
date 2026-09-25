"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { setNewPassword, type NewPasswordState } from "./actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<NewPasswordState, FormData>(setNewPassword, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="password">Kata sandi baru</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="mt-1 text-[11.5px] text-subtle">
          Minimal {MIN_PASSWORD_LENGTH} karakter.
        </p>
      </div>
      <div>
        <Label htmlFor="confirm">Ulangi kata sandi baru</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </div>
      {state.error && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="ink" className="h-9 w-full" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan kata sandi"}
      </Button>
    </form>
  );
}
