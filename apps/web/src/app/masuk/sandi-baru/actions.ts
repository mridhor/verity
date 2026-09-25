"use server";

import { redirect } from "next/navigation";
import { newPasswordSchema } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";

export type NewPasswordState = { error?: string };

const ERRORS: Record<string, string> = {
  same_password: "Kata sandi baru harus berbeda dari yang lama.",
  weak_password: "Kata sandi terlalu lemah. Gunakan kombinasi yang lebih panjang dan beragam.",
  insufficient_aal: "Verifikasi dua langkah diperlukan sebelum mengganti kata sandi.",
  reauthentication_needed: "Sesi Anda perlu diverifikasi ulang. Minta tautan atur ulang baru.",
  session_not_found: "Sesi berakhir. Minta tautan atur ulang baru.",
  session_expired: "Sesi berakhir. Minta tautan atur ulang baru.",
};

export async function setNewPassword(_: NewPasswordState, form: FormData): Promise<NewPasswordState> {
  const parsed = newPasswordSchema.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: ERRORS.session_not_found };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: ERRORS[error.code ?? ""] ?? "Kata sandi gagal diperbarui. Coba lagi." };

  // First password of an account made by the Super Admin: clear the flag, then refresh the token
  // so the proxy stops sending the user here.
  if ((data.claims.app_metadata as { must_change_password?: boolean } | undefined)?.must_change_password) {
    await supabase.rpc("clear_must_change_password");
    await supabase.auth.refreshSession();
  }
  await supabase.rpc("log_auth_event", { p_kind: "auth.password_changed" });
  // Anyone still signed in elsewhere with the old password is logged out.
  await supabase.auth.signOut({ scope: "others" });
  redirect("/beranda");
}
