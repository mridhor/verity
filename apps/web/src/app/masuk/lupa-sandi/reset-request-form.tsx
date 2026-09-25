"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { requestPasswordReset, type ResetRequestState } from "./actions";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(requestPasswordReset, {});

  if (state.sent) {
    return (
      <div className="space-y-4" role="status">
        <p className="text-[13px] leading-relaxed">
          Jika email tersebut terdaftar, kami telah mengirim tautan untuk mengatur ulang kata sandi. Tautan hanya
          berlaku sekali dan untuk waktu terbatas. Periksa juga folder spam.
        </p>
        <Link href="/masuk" className="block text-center text-[12.5px] underline-offset-2 hover:underline">
          Kembali ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">Email kantor</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      {state.error && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="ink" className="h-9 w-full" disabled={pending}>
        {pending ? "Mengirim…" : "Kirim tautan atur ulang"}
      </Button>
      <Link href="/masuk" className="block text-center text-[12.5px] text-subtle underline-offset-2 hover:underline">
        Kembali ke halaman masuk
      </Link>
    </form>
  );
}
