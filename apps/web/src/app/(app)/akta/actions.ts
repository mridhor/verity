"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePrincipal } from "@/lib/auth";
import { dbMessage } from "@/lib/db-errors";
import { COMPANY_FORMS, PARTY_ROLES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string };

const createSchema = z.object({
  berkasId: z.uuid({ message: "Pilih berkas." }),
  officialId: z.uuid({ message: "Pilih pejabat." }),
  aktaType: z.string().trim().min(2, "Pilih jenis akta."),
  title: z.string().trim().min(2, "Judul akta terlalu pendek.").max(300),
  notes: z.string().trim().max(2000).optional(),
});

export async function createAkta(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const p = createSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("akta")
    .insert({ berkas_id: p.data.berkasId, official_id: p.data.officialId, akta_type: p.data.aktaType, title: p.data.title, notes: p.data.notes || null })
    .select("id")
    .single();
  if (error) return { error: dbMessage(error, "Akta gagal dibuat.") };
  revalidatePath("/akta");
  redirect(`/akta/${data.id}`);
}

const editSchema = z.object({
  aktaId: z.uuid(),
  title: z.string().trim().min(2, "Judul akta terlalu pendek.").max(300),
  notes: z.string().trim().max(2000).optional(),
});

export async function updateAkta(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const p = editSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("akta").update({ title: p.data.title, notes: p.data.notes || null })
    .eq("id", p.data.aktaId).select("id");
  if (error || !data?.length) return { error: dbMessage(error, "Akta tidak dapat diubah pada status ini.") };
  revalidatePath(`/akta/${p.data.aktaId}`);
  return { ok: "Perubahan disimpan." };
}

const transitionSchema = z.object({
  aktaId: z.uuid(),
  to: z.enum(["draft", "verifikasi", "menunggu_ttd", "diarsipkan"]),
  note: z.string().trim().max(500).optional(),
});

export async function transitionAkta(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const p = transitionSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Permintaan tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_akta_status", { p_akta: p.data.aktaId, p_to: p.data.to, p_note: p.data.note || null });
  if (error) return { error: dbMessage(error, "Status gagal diubah.") };
  revalidatePath(`/akta/${p.data.aktaId}`);
  revalidatePath("/akta");
  return {};
}

const finalizeSchema = z.object({
  aktaId: z.uuid(),
  aktaDate: z.iso.date({ message: "Isi tanggal akta." }),
  confirm: z.literal("on", { message: "Centang konfirmasi terlebih dahulu." }),
});

export async function finalizeAkta(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const p = finalizeSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("finalize_akta", { p_akta: p.data.aktaId, p_akta_date: p.data.aktaDate });
  if (error) return { error: dbMessage(error, "Akta gagal difinalkan.") };
  revalidatePath(`/akta/${p.data.aktaId}`);
  revalidatePath("/akta");
  revalidatePath("/register/repertorium");
  revalidatePath("/register/klapper");
  return { ok: "Akta difinalkan." };
}

export async function deleteDraft(form: FormData): Promise<void> {
  await requirePrincipal();
  const id = z.uuid().parse(form.get("aktaId"));
  const supabase = await createClient();
  const { data } = await supabase.from("akta").delete().eq("id", id).select("id");
  if (!data?.length) throw new Error("Draft tidak dapat dihapus.");
  revalidatePath("/akta");
  redirect("/akta");
}

// ─── Parties ───

const existingPartySchema = z.object({
  aktaId: z.uuid(),
  subject: z.string().regex(/^(person|company):[0-9a-f-]{36}$/, "Pilih orang atau badan usaha."),
  role: z.enum(PARTY_ROLES),
  capacity: z.string().trim().max(200).optional(),
});

export async function addExistingParty(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const p = existingPartySchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const [kind, id] = p.data.subject.split(":") as ["person" | "company", string];
  return insertParty(p.data.aktaId, kind, id, p.data.role, p.data.capacity);
}

const newPersonSchema = z.object({
  aktaId: z.uuid(),
  role: z.enum(PARTY_ROLES),
  fullName: z.string().trim().min(2, "Isi nama lengkap.").max(200),
  nik: z.string().trim().regex(/^([0-9]{16})?$/, "NIK harus 16 digit.").optional(),
  birthPlace: z.string().trim().max(100).optional(),
  birthDate: z.union([z.iso.date(), z.literal("")]).optional(),
  address: z.string().trim().max(500).optional(),
  occupation: z.string().trim().max(100).optional(),
});

export async function addNewPerson(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const p = newPersonSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("persons").insert({
    full_name: p.data.fullName, nik: p.data.nik || null, birth_place: p.data.birthPlace || null,
    birth_date: p.data.birthDate || null, address: p.data.address || null, occupation: p.data.occupation || null,
  }).select("id").single();
  if (error) {
    return { error: error.code === "23505" ? "NIK ini sudah terdaftar. Pilih orangnya dari daftar yang ada." : dbMessage(error, "Data orang gagal disimpan.") };
  }
  return insertParty(p.data.aktaId, "person", data.id, p.data.role);
}

const newCompanySchema = z.object({
  aktaId: z.uuid(),
  role: z.enum(PARTY_ROLES),
  name: z.string().trim().min(2, "Isi nama badan usaha.").max(200),
  legalForm: z.enum(COMPANY_FORMS),
  nib: z.string().trim().regex(/^([0-9]{13})?$/, "NIB harus 13 digit.").optional(),
  domicile: z.string().trim().max(200).optional(),
  capacity: z.string().trim().max(200).optional(),
});

export async function addNewCompany(_: FormState, form: FormData): Promise<FormState> {
  await requirePrincipal();
  const p = newCompanySchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message };
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").insert({
    name: p.data.name, legal_form: p.data.legalForm, nib: p.data.nib || null, domicile: p.data.domicile || null,
  }).select("id").single();
  if (error) {
    return { error: error.code === "23505" ? "NIB ini sudah terdaftar. Pilih dari daftar yang ada." : dbMessage(error, "Data badan usaha gagal disimpan.") };
  }
  return insertParty(p.data.aktaId, "company", data.id, p.data.role, p.data.capacity);
}

async function insertParty(aktaId: string, kind: "person" | "company", id: string, role: string, capacity?: string): Promise<FormState> {
  const supabase = await createClient();
  const { count } = await supabase.from("akta_parties").select("id", { count: "exact", head: true }).eq("akta_id", aktaId);
  const { error } = await supabase.from("akta_parties").insert({
    akta_id: aktaId, person_id: kind === "person" ? id : null, company_id: kind === "company" ? id : null,
    role, capacity: capacity || null, sort_order: count ?? 0,
  });
  if (error) return { error: dbMessage(error, "Pihak gagal ditambahkan.") };
  revalidatePath(`/akta/${aktaId}`);
  return { ok: "Pihak ditambahkan." };
}

export async function removeParty(form: FormData): Promise<void> {
  await requirePrincipal();
  const partyId = z.uuid().parse(form.get("partyId"));
  const aktaId = z.uuid().parse(form.get("aktaId"));
  const supabase = await createClient();
  const { error } = await supabase.from("akta_parties").delete().eq("id", partyId);
  if (error) throw new Error(dbMessage(error, "Pihak gagal dihapus."));
  revalidatePath(`/akta/${aktaId}`);
}
