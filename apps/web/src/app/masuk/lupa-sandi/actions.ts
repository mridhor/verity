"use server";

import { z } from "zod";
import { requestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

export type ResetRequestState = { sent?: boolean; error?: string };

export async function requestPasswordReset(_: ResetRequestState, form: FormData): Promise<ResetRequestState> {
  const parsed = z.email().safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Masukkan email yang valid." };

  const supabase = await createClient();
  const origin = await requestOrigin();
  // PKCE: the code verifier is stored in this browser's cookies, and the link in the email
  // comes back to /auth/konfirmasi with a one-time code.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/konfirmasi?next=${encodeURIComponent("/masuk/sandi-baru")}`,
  });

  if (error?.status === 429) {
    return { error: "Terlalu banyak permintaan. Tunggu beberapa menit, lalu coba lagi." };
  }
  // Any other outcome, including an unknown email, gets the same answer so this form cannot
  // be used to find out which addresses have accounts.
  return { sent: true };
}
