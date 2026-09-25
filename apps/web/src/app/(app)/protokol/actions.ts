"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePrincipal } from "@/lib/auth";
import { dbMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

const schema = z.object({
  sourceName: z.string().trim().min(2, "Isi nama notaris asal.").max(200),
  skRef: z.string().trim().max(120).optional(),
  wilayah: z.string().trim().max(120).optional(),
  handoverDate: z.iso.date({ message: "Isi tanggal penyerahan." }),
  aktaCount: z.coerce.number().int().min(0, "Jumlah akta tidak valid."),
  yearRange: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function createTransfer(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const p = schema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from("protokol_transfers").insert({
    source_notaris_name: p.data.sourceName, sk_ref: p.data.skRef || null, wilayah: p.data.wilayah || null,
    handover_date: p.data.handoverDate, akta_count: p.data.aktaCount, year_range: p.data.yearRange || null,
    notes: p.data.notes || null,
  });
  if (error) return { error: dbMessage(error, "Serah terima gagal dicatat.") };
  revalidatePath("/protokol");
  return { ok: "Serah terima dicatat." };
}

export async function markReceived(form: FormData): Promise<void> {
  await requirePrincipal();
  const id = z.uuid().parse(form.get("id"));
  const supabase = await createClient();
  await supabase.from("protokol_transfers").update({ status: "diterima" }).eq("id", id);
  revalidatePath("/protokol");
  revalidatePath("/beranda");
}
