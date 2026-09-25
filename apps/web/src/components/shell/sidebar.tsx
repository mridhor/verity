import Link from "next/link";
import { FolderOpen, ScrollText, Users } from "lucide-react";
import { Dot } from "@/components/ui/input";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";
import { NavLink } from "./nav-link";
import { TenantSwitcher } from "./tenant-switcher";

type Props = {
  me: { role: AppRole; tenantId: string; name: string };
  berkas: { id: string; title: string }[];
  tenants: { id: string; name: string }[];
};

export function Sidebar({ me, berkas, tenants }: Props) {
  const initials = me.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const isAdmin = me.role === "super_admin";
  const canSeeAudit = isAdmin || me.role === "notaris";

  return (
    <nav aria-label="Navigasi utama" className="flex w-[248px] shrink-0 flex-col overflow-y-auto border-r border-border bg-background">
      <Link href="/berkas" className="px-[18px] pt-[18px] pb-4 font-serif text-[19px] font-semibold">
        Verity
      </Link>

      <NavLink href="/berkas" icon={<FolderOpen size={15} />}>Berkas</NavLink>
      {canSeeAudit && <NavLink href="/admin/audit" icon={<ScrollText size={15} />}>Audit log</NavLink>}
      {isAdmin && <NavLink href="/admin/pengguna" icon={<Users size={15} />}>Pengguna</NavLink>}

      {berkas.length > 0 && (
        <>
          <div className="px-[18px] pt-[22px] pb-2 text-xs text-subtle">Berkas aktif</div>
          {berkas.map((b) => (
            <Link
              key={b.id}
              href={`/berkas/${b.id}`}
              className="mx-2 flex min-w-0 items-center gap-[9px] rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground hover:bg-border-soft"
            >
              <Dot />
              <span className="truncate">{b.title}</span>
            </Link>
          ))}
        </>
      )}

      <div className="mt-auto border-t border-border px-4 py-3">
        {tenants.length > 1 && <TenantSwitcher tenants={tenants} activeId={me.tenantId} />}
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">{me.name}</div>
            <div className="text-[11.5px] text-subtle">{ROLE_LABEL[me.role]}</div>
          </div>
          <form action="/auth/keluar" method="post">
            <button className="text-[11.5px] text-subtle hover:text-foreground">Keluar</button>
          </form>
        </div>
      </div>
    </nav>
  );
}
