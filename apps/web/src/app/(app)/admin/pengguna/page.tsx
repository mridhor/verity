import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { requirePrincipal } from "@/lib/auth";
import { APP_ROLES, ROLE_LABEL, type AppRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { setRole } from "./actions";
import { AddMemberForm } from "./add-member-form";
import { OfficialForm } from "./official-form";

export default async function PenggunaPage() {
  const me = await requirePrincipal();
  if (me.role !== "super_admin") notFound();
  const supabase = await createClient();
  const [{ data: members }, { data: officials }] = await Promise.all([
    supabase.from("tenant_members").select("user_id, display_name, role, active").eq("tenant_id", me.tenantId).order("display_name"),
    supabase.from("officials").select("id, display_name, appointment, kedudukan").eq("tenant_id", me.tenantId),
  ]);

  return (
    <>
      <PageHeader eyebrow="Administrasi" title="Pengguna dan peran" />
      <div className="mx-auto w-full max-w-[960px] space-y-8 px-8 py-7">
        <section>
          <h2 className="mb-3 text-[13.5px] font-semibold">Tambah pengguna ke kantor</h2>
          <AddMemberForm />
          <p className="mt-2 text-[12px] text-subtle">
            Akun login dibuat oleh administrator sistem dengan skrip admin. Di sini Anda memberi akun itu peran di kantor.
            Setiap perubahan dicatat dan diberitahukan kepada Notaris.
          </p>
        </section>

        <section className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-background text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Nama</th>
                <th className="px-4 py-2.5 font-medium">Peran</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.user_id} className="border-t border-border-soft">
                  <td className="px-4 py-2.5">{m.display_name}</td>
                  {m.user_id === me.userId ? (
                    <>
                      <td className="px-4 py-2.5 text-muted-foreground">{ROLE_LABEL[m.role as AppRole]}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">Aktif</td>
                      <td className="px-4 py-2.5 text-[12px] text-subtle">Akun Anda</td>
                    </>
                  ) : (
                    <td colSpan={3} className="px-4 py-2">
                      <form action={setRole} className="grid grid-cols-[180px_120px_auto] items-center gap-2">
                        <input type="hidden" name="userId" value={m.user_id} />
                        <Select name="role" defaultValue={m.role} aria-label={`Peran ${m.display_name}`}>
                          {APP_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </Select>
                        <Select name="active" defaultValue={String(m.active)} aria-label={`Status ${m.display_name}`}>
                          <option value="true">Aktif</option>
                          <option value="false">Nonaktif</option>
                        </Select>
                        <Button size="sm" type="submit" className="justify-self-start">Simpan</Button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-1 text-[13.5px] font-semibold">Pejabat (pengangkatan)</h2>
          <p className="mb-3 text-[12px] text-subtle">
            Setiap akta ditandatangani atas nama satu pengangkatan. Satu orang yang menjabat Notaris sekaligus PPAT memiliki dua entri,
            dengan penomoran dan register yang terpisah.
          </p>
          <div className="mb-4 rounded-md border border-border bg-card p-4">
            <OfficialForm notaries={(members ?? []).filter((m) => m.role === "notaris" && m.active).map((m) => ({ id: m.user_id, name: m.display_name }))} />
          </div>
          {(officials ?? []).length === 0 ? (
            <p className="text-[13px] text-subtle">Belum ada data pengangkatan Notaris atau PPAT.</p>
          ) : (
            <ul className="text-[13px]">
              {officials!.map((o) => (
                <li key={o.id} className="border-b border-border py-2.5">
                  {o.display_name} · {o.appointment === "notaris" ? "Notaris" : "PPAT"}
                  {o.kedudukan ? ` · ${o.kedudukan}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
