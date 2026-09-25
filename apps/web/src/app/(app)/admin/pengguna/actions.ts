"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePrincipal } from "@/lib/auth";
import { APP_ROLES } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

const addSchema = z.object({
  email: z.email("Email tidak valid"),
  role: z.enum(APP_ROLES),
  displayName: z.string().trim().min(2, "Nama terlalu pendek"),
});

export async function addMember(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const parsed = addSchema.safeParse({
    email: form.get("email"),
    role: form.get("role"),
    displayName: form.get("displayName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_tenant_member", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_display_name: parsed.data.displayName,
  });
  if (error) {
    if (error.code === "P0002") return { error: "Akun dengan email ini belum dibuat. Buat akun lewat skrip admin terlebih dahulu." };
    if (error.code === "23505") return { error: "Pengguna ini sudah terdaftar di kantor." };
    return { error: "Pengguna gagal ditambahkan." };
  }
  revalidatePath("/admin/pengguna");
  return { ok: `${parsed.data.displayName} ditambahkan.` };
}

const roleSchema = z.object({ userId: z.uuid(), role: z.enum(APP_ROLES), active: z.enum(["true", "false"]) });

export async function setRole(form: FormData): Promise<void> {
  await requirePrincipal();
  const p = roleSchema.parse({ userId: form.get("userId"), role: form.get("role"), active: form.get("active") });
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", { p_user: p.userId, p_role: p.role, p_active: p.active === "true" });
  if (error) throw new Error("Perubahan peran ditolak.");
  revalidatePath("/admin/pengguna");
}
