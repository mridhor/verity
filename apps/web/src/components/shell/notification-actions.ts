"use server";

import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markAllNotificationsRead(): Promise<void> {
  await requirePrincipal();
  const supabase = await createClient();
  // RLS limits this to the caller's own notifications.
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/", "layout");
}
