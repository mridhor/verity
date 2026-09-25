import "server-only";
import { APPOINTMENT_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { NewAktaOptions } from "./new-akta-form";

/** Active berkas and officials for the "Akta baru" form, under the user's RLS. */
export async function newAktaOptions(defaultBerkas?: string): Promise<NewAktaOptions> {
  const supabase = await createClient();
  const [{ data: berkas }, { data: officials }] = await Promise.all([
    supabase.from("berkas").select("id, title").eq("status", "aktif").order("title"),
    supabase.from("officials").select("id, appointment, display_name").eq("active", true).order("appointment"),
  ]);
  return {
    defaultBerkas,
    berkas: (berkas ?? []).map((b) => ({ id: b.id, label: b.title })),
    officials: (officials ?? []).map((o) => ({
      id: o.id, label: `${APPOINTMENT_LABEL[o.appointment as "notaris" | "ppat"]} — ${o.display_name}`,
    })),
  };
}
