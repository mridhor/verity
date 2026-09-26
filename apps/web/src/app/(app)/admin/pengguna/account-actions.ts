"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePrincipal } from "@/lib/auth";
import { env } from "@/lib/env";
import { APP_ROLES } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type AccountState = { error?: string; ok?: string };

const schema = z.object({
  email: z.email("Email tidak valid"),
  displayName: z.string().trim().min(2, "Nama terlalu pendek").max(120),
  role: z.enum(APP_ROLES),
  password: z.string().min(10, "Kata sandi awal minimal 10 karakter.").max(72),
});

const MESSAGES: Record<string, string> = {
  email_exists: "Email ini sudah punya akun. Gunakan “Akun yang sudah ada”.",
  forbidden: "Hanya Super Admin yang dapat membuat akun (selesaikan verifikasi dua langkah bila sudah dipasang).",
  weak_password: "Kata sandi awal minimal 10 karakter.",
  invalid_input: "Periksa kembali email, nama, dan peran.",
  add_failed: "Akun dibuat tetapi gagal ditambahkan ke kantor, sehingga dibatalkan. Coba lagi.",
};

/**
 * Calls the `admin-create-user` Edge Function with the Super Admin's own session. The secret key
 * stays on Supabase; this server only forwards the request (and never logs the password).
 */
export async function createAccount(_: AccountState, form: FormData): Promise<AccountState> {
  const me = await requirePrincipal();
  if (me.role !== "super_admin") return { error: MESSAGES.forbidden };
  const parsed = schema.safeParse({
    email: form.get("email"), displayName: form.get("displayName"), role: form.get("role"), password: form.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: "Sesi berakhir. Masuk kembali." };

  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-create-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      // Run the function next to the database (Supabase region of the project).
      ...(process.env.SUPABASE_FUNCTION_REGION ? { "x-region": process.env.SUPABASE_FUNCTION_REGION } : {}),
    },
    body: JSON.stringify(parsed.data),
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { error: "Layanan pembuatan akun tidak dapat dihubungi." };
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !body.ok) {
    if (res.status === 404) return { error: "Fungsi pembuatan akun belum dipasang di Supabase (admin-create-user)." };
    return { error: MESSAGES[body.error ?? ""] ?? "Akun gagal dibuat." };
  }
  revalidatePath("/admin/pengguna");
  return { ok: `Akun ${parsed.data.email} dibuat. Sampaikan kata sandi awal secara langsung; pengguna wajib menggantinya saat pertama masuk.` };
}

const profileSchema = z.object({
  userId: z.uuid(), displayName: z.string().trim().min(2, "Nama terlalu pendek").max(120),
  role: z.enum(APP_ROLES), active: z.enum(["true", "false"]),
});

/** Edit a member: display name, role and whether the membership is active. */
export async function updateMember(_: AccountState, form: FormData): Promise<AccountState> {
  await requirePrincipal();
  const p = profileSchema.safeParse({
    userId: form.get("userId"), displayName: form.get("displayName"), role: form.get("role"), active: form.get("active"),
  });
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.rpc("update_member_profile", { p_user: p.data.userId, p_display_name: p.data.displayName }),
    supabase.rpc("set_member_role", { p_user: p.data.userId, p_role: p.data.role, p_active: p.data.active === "true" }),
  ]);
  if (e1 || e2) return { error: "Perubahan ditolak." };
  revalidatePath("/admin/pengguna");
  return { ok: "Perubahan disimpan." };
}
