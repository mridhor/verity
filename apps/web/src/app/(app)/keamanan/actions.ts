"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function signOutOtherSessions(): Promise<void> {
  await requirePrincipal();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "others" });
  redirect("/keamanan?sesi=keluar");
}

export type SettingsState = { error?: string; ok?: string };

/** Office settings (Notaris or Super Admin with 2FA): yearly akta target and session timeout. */
export async function updateOfficeSettings(_: SettingsState, form: FormData): Promise<SettingsState> {
  await requirePrincipal();
  const hours = Number(form.get("timeout"));
  const rawTarget = String(form.get("target") ?? "").trim();
  const target = rawTarget === "" ? null : Number(rawTarget);
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) return { error: "Batas waktu sesi 1–24 jam." };
  if (target !== null && (!Number.isInteger(target) || target < 1 || target > 100000)) return { error: "Target akta harus bilangan bulat positif." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_tenant_settings", { p_annual_akta_target: target, p_session_timeout_hours: hours });
  if (error) return { error: error.code === "42501" ? "Hanya Notaris atau Super Admin dengan 2FA." : "Pengaturan gagal disimpan." };
  revalidatePath("/keamanan");
  return { ok: "Pengaturan disimpan. Batas sesi berlaku saat token berikutnya diterbitkan (paling lama 1 jam)." };
}

/** Signs every other member of the office out of all their devices. */
export async function revokeOfficeSessions(): Promise<void> {
  await requirePrincipal();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_office_sessions");
  redirect(error ? "/keamanan?sesi=gagal" : `/keamanan?sesi=kantor&jumlah=${data ?? 0}`);
}
