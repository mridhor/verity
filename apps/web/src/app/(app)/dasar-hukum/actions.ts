"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePrincipal } from "@/lib/auth";
import { dbMessage } from "@/lib/db-errors";
import { LEGAL_CATEGORIES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

const schema = z.object({
  category: z.enum(LEGAL_CATEGORIES),
  numberLabel: z.string().trim().min(1, "Isi nomor peraturan.").max(120),
  title: z.string().trim().min(3, "Isi judul.").max(400),
  year: z.union([z.coerce.number().int().min(1800).max(2100), z.literal("")]).optional(),
  sourceUrl: z.union([z.url({ protocol: /^https$/, message: "Tautan harus https://" }), z.literal("")]).optional(),
});

export async function createReference(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const p = schema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from("legal_references").insert({
    category: p.data.category, number_label: p.data.numberLabel, title: p.data.title,
    year: p.data.year === "" || p.data.year === undefined ? null : p.data.year, source_url: p.data.sourceUrl || null,
  });
  if (error) return { error: dbMessage(error, "Referensi gagal disimpan.") };
  revalidatePath("/dasar-hukum");
  return { ok: "Referensi ditambahkan, menunggu verifikasi Notaris." };
}

export async function toggleBookmark(form: FormData): Promise<void> {
  await requirePrincipal();
  const id = z.uuid().parse(form.get("id"));
  const on = form.get("on") === "1";
  const supabase = await createClient();
  if (on) await supabase.from("legal_bookmarks").insert({ reference_id: id });
  else await supabase.from("legal_bookmarks").delete().eq("reference_id", id);
  revalidatePath("/dasar-hukum");
}

export async function verifyReference(form: FormData): Promise<void> {
  await requirePrincipal();
  const id = z.uuid().parse(form.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("verify_legal_reference", { p_reference: id });
  if (error) throw new Error(dbMessage(error, "Verifikasi gagal."));
  revalidatePath("/dasar-hukum");
}
