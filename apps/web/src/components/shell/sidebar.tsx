import Link from "next/link";
import {
  BookMarked, BookOpen, CalendarDays, FileText, FolderArchive, FolderOpen, Home, Library, ScrollText,
  ShieldCheck, Users, ArrowLeftRight,
} from "lucide-react";
import { Dot } from "@/components/ui/input";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";
import { NavLink } from "./nav-link";
import { TenantSwitcher } from "./tenant-switcher";

type Props = {
  me: { role: AppRole; tenantId: string; name: string };
  tenantKind: string;
  berkas: { id: string; title: string }[];
  tenants: { id: string; name: string }[];
};

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="px-[18px] pb-1 text-[11px] uppercase tracking-[0.06em] text-subtle">{label}</div>
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
    <nav aria-label="Navigasi utama" className="flex w-[248px] shrink-0 flex-col overflow-y-auto border-r border-border bg-background">
      <Link href="/beranda" className="px-[18px] pt-[18px] pb-2 font-serif text-[19px] font-semibold">
        Verity
      </Link>

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
        <Group label="Berkas aktif">
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
        </Group>
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
