"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">Email kantor</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Kata sandi</Label>
          <Link href="/masuk/lupa-sandi" className="text-[12px] text-subtle underline-offset-2 hover:underline">
            Lupa kata sandi?
          </Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="ink" className="h-9 w-full" disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}
