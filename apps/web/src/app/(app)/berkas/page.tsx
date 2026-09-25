import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { requirePrincipal } from "@/lib/auth";
import { berkasType } from "@/lib/berkas-types";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { NewBerkasForm } from "./new-berkas-form";

export default async function BerkasListPage() {
  const me = await requirePrincipal();
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("berkas")
    .select("id, title, type, status, created_at")
    .order("created_at", { ascending: false });

  const scope =
    me.role === "notaris" || me.role === "super_admin" ? "Semua berkas kantor" : "Berkas tempat Anda ditugaskan";

  return (
    <>
      <PageHeader eyebrow={scope} title="Berkas" actions={me.role !== "super_admin" ? <NewBerkasForm /> : undefined} />
      <div className="mx-auto w-full max-w-[960px] px-8 py-7">
        {error && <p role="alert" className="text-destructive">Daftar berkas gagal dimuat.</p>}
        {rows && rows.length === 0 && (
          <p className="py-16 text-center text-[13px] text-subtle">Belum ada berkas.</p>
        )}
        {rows && rows.length > 0 && (
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-background text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Berkas</th>
                  <th className="px-4 py-2.5 font-medium">Jenis</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-t border-border-soft hover:bg-border-soft/60">
                    <td className="px-4 py-3">
                      <Link href={`/berkas/${b.id}`} className="font-medium hover:underline">
                        {b.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{berkasType(b.type)?.label ?? b.type}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{b.status}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatDate(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
