import Link from "next/link";
import {
  BookMarked, BookOpen, CalendarDays, FileText, FolderArchive, FolderOpen, Home, Library, ScrollText,
  ShieldCheck, Users, ArrowLeftRight,
} from "lucide-react";
import { PaletteTrigger } from "@/components/agent/command-palette";
import { Dot } from "@/components/ui/input";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";
import { NavLink } from "./nav-link";
import { SidebarFrame } from "./sidebar-frame";
import { TenantSwitcher } from "./tenant-switcher";

type Props = {
  me: { role: AppRole; tenantId: string; name: string };
  tenantKind: string;
  berkas: { id: string; title: string }[];
  tenants: { id: string; name: string }[];
};

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 group-data-[collapsed=true]/side:mt-3">
      <div className="px-[18px] pb-1.5 text-[11px] font-medium tracking-[0.06em] text-subtle uppercase group-data-[collapsed=true]/side:hidden">{label}</div>
      <div className="hidden group-data-[collapsed=true]/side:mx-4 group-data-[collapsed=true]/side:mb-2 group-data-[collapsed=true]/side:block group-data-[collapsed=true]/side:border-t group-data-[collapsed=true]/side:border-border" />
      {children}
    </div>
  );
}

export function Sidebar({ me, tenantKind, berkas, tenants }: Props) {
  const initials = me.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const isAdmin = me.role === "super_admin";
  const content = !isAdmin; // the Super Admin never sees client content (PLAN.md C-17)
  const notaryOffice = tenantKind === "kantor_notaris";
  const canSeeAudit = isAdmin || me.role === "notaris";

  return (
    <SidebarFrame>
      <Link href="/beranda" className="flex items-center gap-2.5 px-4 pt-4 pb-3 group-data-[collapsed=true]/side:justify-center group-data-[collapsed=true]/side:px-0">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-foreground font-serif text-[17px] leading-none text-card">V</span>
        <span className="font-serif text-[20px] leading-none tracking-[-0.01em] group-data-[collapsed=true]/side:hidden">Verity</span>
      </Link>
      <div className="px-3 pt-1 group-data-[collapsed=true]/side:pt-9"><PaletteTrigger /></div>

      <Group label="Kerja">
        <NavLink href="/beranda" icon={<Home size={15} />}>Beranda</NavLink>
        <NavLink href="/berkas" icon={<FolderOpen size={15} />}>Berkas</NavLink>
        {content && <NavLink href="/akta" icon={<FileText size={15} />}>Akta</NavLink>}
        {content && <NavLink href="/jadwal" icon={<CalendarDays size={15} />}>Jadwal</NavLink>}
        {content && <NavLink href="/dokumen" icon={<FolderArchive size={15} />}>Minuta & dokumen</NavLink>}
      </Group>

      {content && notaryOffice && (
        <Group label="Register">
          <NavLink href="/register/repertorium" icon={<BookMarked size={15} />}>Repertorium</NavLink>
          <NavLink href="/register/klapper" icon={<BookOpen size={15} />}>Buku klapper</NavLink>
          <NavLink href="/protokol" icon={<ArrowLeftRight size={15} />}>Protokol notaris</NavLink>
        </Group>
      )}

      <Group label="Referensi">
        <NavLink href="/dasar-hukum" icon={<Library size={15} />}>Dasar hukum</NavLink>
      </Group>

      <Group label="Administrasi">
        {isAdmin && <NavLink href="/admin/pengguna" icon={<Users size={15} />}>Pengguna</NavLink>}
        {canSeeAudit && <NavLink href="/admin/audit" icon={<ScrollText size={15} />}>Audit log</NavLink>}
        <NavLink href="/keamanan" icon={<ShieldCheck size={15} />}>Keamanan</NavLink>
      </Group>

      {berkas.length > 0 && (
        <div className="group-data-[collapsed=true]/side:hidden"><Group label="Berkas aktif">
          {berkas.map((b) => (
            <Link
              key={b.id}
              href={`/berkas/${b.id}`}
              className="mx-2 flex min-w-0 items-center gap-[9px] rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              <Dot />
              <span className="truncate">{b.title}</span>
            </Link>
          ))}
        </Group></div>
      )}

      <div className="mt-auto px-3 pt-4 pb-3">
        <div className="group-data-[collapsed=true]/side:hidden">
          {tenants.length > 1 && <TenantSwitcher tenants={tenants} activeId={me.tenantId} />}
        </div>
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 group-data-[collapsed=true]/side:justify-center group-data-[collapsed=true]/side:px-0">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-[12px] font-semibold text-foreground shadow-surface" title={me.name}>
            {initials}
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsed=true]/side:hidden">
            <div className="truncate text-[13px] font-medium">{me.name}</div>
            <div className="truncate text-[11.5px] text-subtle">{ROLE_LABEL[me.role]}</div>
          </div>
          <form action="/auth/keluar" method="post" className="group-data-[collapsed=true]/side:hidden">
            <button className="rounded-md px-1.5 py-1 text-[12px] text-subtle hover:bg-foreground/[0.05] hover:text-foreground">Keluar</button>
          </form>
        </div>
      </div>
    </SidebarFrame>
  );
}
