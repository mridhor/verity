"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePrincipal } from "@/lib/auth";
import { dbMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

const schema = z.object({
  berkasId: z.uuid(),
  title: z.string().trim().min(2, "Isi nama item.").max(300),
  assignee: z.union([z.uuid(), z.literal("")]).optional(),
  dueDate: z.union([z.iso.date(), z.literal("")]).optional(),
});

export async function addChecklistItem(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const p = schema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_items").insert({
    berkas_id: p.data.berkasId, title: p.data.title, assignee_user_id: p.data.assignee || null, due_date: p.data.dueDate || null,
  });
  if (error) return { error: dbMessage(error, "Item gagal ditambahkan.") };
  revalidatePath(`/berkas/${p.data.berkasId}`);
  return {};
}

export async function toggleChecklistItem(form: FormData): Promise<void> {
  await requirePrincipal();
  const id = z.uuid().parse(form.get("id"));
  const berkasId = z.uuid().parse(form.get("berkasId"));
  const supabase = await createClient();
  await supabase.from("checklist_items").update({ done: form.get("done") === "1" }).eq("id", id);
  revalidatePath(`/berkas/${berkasId}`);
}

export async function deleteChecklistItem(form: FormData): Promise<void> {
  await requirePrincipal();
  const id = z.uuid().parse(form.get("id"));
  const berkasId = z.uuid().parse(form.get("berkasId"));
  const supabase = await createClient();
  await supabase.from("checklist_items").delete().eq("id", id);
  revalidatePath(`/berkas/${berkasId}`);
}
