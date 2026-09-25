"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePrincipal } from "@/lib/auth";
import { dbMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

export async function correctEntry(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const p = z.object({ entryId: z.uuid(), note: z.string().trim().min(5, "Jelaskan koreksinya (min. 5 karakter).").max(1000) })
    .safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_repertorium_entry", { p_entry: p.data.entryId, p_note: p.data.note });
  if (error) return { error: dbMessage(error, "Koreksi gagal dicatat.") };
  revalidatePath("/register/repertorium");
  return { ok: "Koreksi dicatat sebagai entri baru." };
}
