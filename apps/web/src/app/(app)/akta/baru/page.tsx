import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { requirePrincipal } from "@/lib/auth";
import { APPOINTMENT_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { NewAktaForm } from "./new-akta-form";

export const metadata = { title: "Akta baru" };

export default async function NewAktaPage({ searchParams }: { searchParams: Promise<{ berkas?: string }> }) {
  const me = await requirePrincipal();
  if (me.role === "super_admin") notFound();
  const { berkas: defaultBerkas } = await searchParams;
  const supabase = await createClient();
  const [{ data: berkas }, { data: officials }] = await Promise.all([
    supabase.from("berkas").select("id, title").eq("status", "aktif").order("title"),
    supabase.from("officials").select("id, appointment, display_name").eq("active", true).order("appointment"),
  ]);

  return (
    <>
      <PageHeader eyebrow="Akta" title="Akta baru" />
      <div className="w-full max-w-[1100px] px-8 pt-5 pb-10">
        {(officials ?? []).length === 0 ? (
          <p className="max-w-xl rounded-md bg-border-soft px-4 py-3 text-[13px]">
            Belum ada data pejabat (Notaris/PPAT) untuk kantor ini. Super Admin perlu menambahkannya di halaman Pengguna.
          </p>
        ) : (berkas ?? []).length === 0 ? (
          <p className="max-w-xl rounded-md bg-border-soft px-4 py-3 text-[13px]">Belum ada berkas aktif. Buat berkas terlebih dahulu.</p>
        ) : (
          <div className="max-w-xl rounded-md border border-border bg-card p-5"><NewAktaForm
            defaultBerkas={defaultBerkas}
            berkas={(berkas ?? []).map((b) => ({ id: b.id, label: b.title }))}
            officials={(officials ?? []).map((o) => ({
              id: o.id, label: `${APPOINTMENT_LABEL[o.appointment as "notaris" | "ppat"]} — ${o.display_name}`,
            }))}
          /></div>
        )}
      </div>
    </>
  );
}
