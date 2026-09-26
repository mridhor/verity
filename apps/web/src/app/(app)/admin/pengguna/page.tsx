import { notFound } from "next/navigation";
import { AgentPageContext } from "@/components/agent/agent-provider";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState, FilterChips, SearchForm, Section, StatCard, Table, td } from "@/components/ui/blocks";
import { requirePrincipal } from "@/lib/auth";
import { APP_ROLES, ROLE_LABEL, type AppRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { OfficialForm } from "./official-form";
import { AddUserDialog, EditMemberDialog } from "./user-dialogs";

export const metadata = { title: "Pengguna" };

type Member = {
  user_id: string; display_name: string; role: AppRole; active: boolean; email: string;
  last_sign_in_at: string | null; created_at: string;
};

export default async function PenggunaPage({ searchParams }: { searchParams: Promise<{ q?: string; peran?: string }> }) {
  const me = await requirePrincipal();
  if (me.role !== "super_admin") notFound();
  const { q, peran } = await searchParams;
  const supabase = await createClient();
  const [{ data, error }, { data: officials }] = await Promise.all([
    supabase.rpc("list_tenant_members"),
    supabase.from("officials").select("id, display_name, appointment, kedudukan, sk_ref, active").eq("tenant_id", me.tenantId).order("appointment"),
  ]);
  const members = (data ?? []) as Member[];
  const term = q?.trim().toLowerCase();
  const shown = members.filter((m) =>
    (!peran || m.role === peran) && (!term || m.display_name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term)));
  const byRole = (r: AppRole) => members.filter((m) => m.role === r && m.active).length;
  const initials = (n: string) => n.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <>
      <AgentPageContext context={{ kind: "kantor", label: "Pengguna", page: "lainnya" }} suggestions={["akta menunggu TTD", "tenggat minggu ini"]} />
      <PageHeader eyebrow="Administrasi" title="Pengguna dan peran"
        meta={<span>{members.length} pengguna terdaftar · {members.filter((m) => m.active).length} aktif</span>}
        actions={<AddUserDialog />} />
      <div className="w-full max-w-[1100px] space-y-6 px-8 pt-5 pb-10">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Notaris/PPAT" value={byRole("notaris")} href="/admin/pengguna?peran=notaris" />
          <StatCard label="Staf administrasi" value={byRole("staf_admin")} href="/admin/pengguna?peran=staf_admin" />
          <StatCard label="Partner & associate" value={byRole("partner") + byRole("associate")} />
          <StatCard label="Super Admin" value={byRole("super_admin")} href="/admin/pengguna?peran=super_admin" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips base="/admin/pengguna" param="peran" value={peran} extra={{ q }}
            options={APP_ROLES.filter((r) => members.some((m) => m.role === r)).map((r) => ({ value: r, label: ROLE_LABEL[r], count: members.filter((m) => m.role === r).length }))} />
          <SearchForm action="/admin/pengguna" value={q} placeholder="Cari nama atau email" hidden={{ peran }} />
        </div>

        {error && <p role="alert" className="text-destructive">Daftar pengguna gagal dimuat.</p>}
        {shown.length === 0 ? (
          <EmptyState>{q || peran ? "Tidak ada pengguna yang cocok." : "Belum ada pengguna."}</EmptyState>
        ) : (
          <Table head={["Pengguna", "Peran", "Status", "Terakhir masuk", ""]}>
            {shown.map((m) => (
              <tr key={m.user_id}>
                <td className={`${td} min-w-64`}>
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[12px] font-semibold text-muted-foreground">{initials(m.display_name)}</span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{m.display_name}{m.user_id === me.userId && <span className="ml-1.5 text-[12px] font-normal text-subtle">(Anda)</span>}</div>
                      <div className="truncate text-[12px] text-subtle">{m.email}</div>
                    </div>
                  </div>
                </td>
                <td className={td}><Badge dot={false} tone={m.role === "notaris" ? "authority" : "neutral"}>{ROLE_LABEL[m.role]}</Badge></td>
                <td className={td}><Badge tone={m.active ? "success" : "neutral"}>{m.active ? "Aktif" : "Nonaktif"}</Badge></td>
                <td className={`${td} whitespace-nowrap text-muted-foreground`}>
                  {m.last_sign_in_at ? formatDateTime(m.last_sign_in_at) : <span className="text-subtle">Belum pernah</span>}
                </td>
                <td className={`${td} text-right`}>
                  {m.user_id === me.userId ? <span className="text-[12px] text-subtle">Akun Anda</span> : (
                    <EditMemberDialog member={{ userId: m.user_id, name: m.display_name, email: m.email, role: m.role, active: m.active }} />
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}

        <Section title="Pejabat (pengangkatan)"
          description="Setiap akta ditandatangani atas nama satu pengangkatan. Notaris yang juga PPAT punya dua entri, dengan penomoran dan register terpisah."
          actions={<OfficialForm notaries={members.filter((m) => m.role === "notaris" && m.active).map((m) => ({ id: m.user_id, name: m.display_name }))} />}>
          {(officials ?? []).length === 0 ? (
            <p className="py-4 text-[13px] text-subtle">Belum ada data pengangkatan Notaris atau PPAT. Tanpa ini akta tidak dapat dibuat.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {officials!.map((o) => (
                <li key={o.id} className="rounded-lg bg-muted px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-medium">{o.display_name}</span>
                    <Badge dot={false} tone="authority">{o.appointment === "notaris" ? "Notaris" : "PPAT"}</Badge>
                  </div>
                  <div className="mt-0.5 text-[12px] text-subtle">{[o.kedudukan, o.sk_ref && `SK ${o.sk_ref}`].filter(Boolean).join(" · ") || "Kedudukan belum diisi"}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
