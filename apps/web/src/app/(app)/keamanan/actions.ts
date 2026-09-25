"use server";

import { redirect } from "next/navigation";
import { requirePrincipal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function signOutOtherSessions(): Promise<void> {
  await requirePrincipal();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "others" });
  redirect("/keamanan?sesi=keluar");
}
