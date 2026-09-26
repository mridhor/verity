"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePrincipal } from "@/lib/auth";
import { dbMessage } from "@/lib/db-errors";
import { jakartaInstant } from "@/lib/jakarta-time";
import { SCHEDULE_KINDS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

const schema = z.object({
  date: z.iso.date({ message: "Isi tanggal." }),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Isi waktu."),
  kind: z.enum(SCHEDULE_KINDS),
  title: z.string().trim().min(2, "Isi nama klien atau agenda.").max(200),
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
  berkasId: z.union([z.uuid(), z.literal("")]).optional(),
});

export async function createSchedule(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const p = schema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from("schedules").insert({
    kind: p.data.kind, title: p.data.title, starts_at: jakartaInstant(p.data.date, p.data.time),
    location: p.data.location || null, notes: p.data.notes || null, berkas_id: p.data.berkasId || null,
  });
  if (error) return { error: dbMessage(error, "Jadwal gagal disimpan.") };
  revalidatePath("/jadwal");
  revalidatePath("/beranda");
  return { ok: "Jadwal disimpan." };
}

export async function deleteSchedule(form: FormData): Promise<void> {
  await requirePrincipal();
  const id = z.uuid().parse(form.get("id"));
  const supabase = await createClient();
  await supabase.from("schedules").delete().eq("id", id);
  revalidatePath("/jadwal");
  revalidatePath("/beranda");
}

/** "Periksa sekarang": the agent's pre-signing check for one signing appointment (ADR 0006). */
export async function runPresigningCheck(form: FormData): Promise<void> {
  await requirePrincipal();
  const id = z.uuid().parse(form.get("id"));
  const supabase = await createClient();
  await supabase.rpc("run_presigning_check", { p_schedule: id });
  revalidatePath("/jadwal");
}
