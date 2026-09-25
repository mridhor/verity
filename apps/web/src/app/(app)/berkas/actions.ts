"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/lib/auth";
import { BERKAS_TYPES } from "@/lib/berkas-types";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string };

const createSchema = z.object({
  type: z.enum(BERKAS_TYPES.map((t) => t.id) as [string, ...string[]]),
  title: z.string().trim().min(3, "Nama berkas terlalu pendek").max(200),
});

export async function createBerkas(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const parsed = createSchema.safeParse({ type: form.get("type"), title: form.get("title") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_berkas", { p_type: parsed.data.type, p_title: parsed.data.title });
  if (error) return { error: error.code === "42501" ? "Peran Anda tidak dapat membuat berkas." : "Berkas gagal dibuat." };
  revalidatePath("/berkas");
  redirect(`/berkas/${data}`);
}

const memberSchema = z.object({ berkasId: z.uuid(), userId: z.uuid(), active: z.enum(["true", "false"]) });

export async function setBerkasMember(form: FormData): Promise<void> {
  await requirePrincipal();
  const parsed = memberSchema.parse({
    berkasId: form.get("berkasId"),
    userId: form.get("userId"),
    active: form.get("active"),
  });
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_berkas_member", {
    p_berkas: parsed.berkasId,
    p_user: parsed.userId,
    p_active: parsed.active === "true",
  });
  if (error) throw new Error("Perubahan anggota ditolak.");
  revalidatePath(`/berkas/${parsed.berkasId}`);
}
