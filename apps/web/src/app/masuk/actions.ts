"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.email(), password: z.string().min(1) });

export type LoginState = { error?: string };

// Account-specific outcomes share one message so the form never reveals which emails exist.
const CREDENTIAL_ERRORS = new Set(["invalid_credentials", "email_not_confirmed", "user_banned", "user_not_found"]);

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Isi email dan kata sandi dengan benar." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.status === 429) return { error: "Terlalu banyak percobaan. Tunggu beberapa menit, lalu coba lagi." };
    if (!error.code || CREDENTIAL_ERRORS.has(error.code)) return { error: "Email atau kata sandi salah." };
    // Service or configuration problem (e.g. email provider disabled, bad API key): not the user's
    // fault, so say so. Only the error code is logged, never the email or password.
    console.error("login failed", { code: error.code, status: error.status });
    return { error: `Layanan masuk sedang bermasalah (kode: ${error.code}). Hubungi administrator.` };
  }
  // proxy.ts sends privileged roles on to /masuk/mfa.
  redirect("/beranda");
}
