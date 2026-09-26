"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

// Trail for every static page; the section label comes first, the page title last.
const STATIC: [RegExp, Crumb[]][] = [
  [/^\/beranda$/, [{ label: "Beranda" }]],
  [/^\/berkas$/, [{ label: "Kerja" }, { label: "Berkas" }]],
  [/^\/akta$/, [{ label: "Kerja" }, { label: "Akta" }]],
  [/^\/akta\/baru$/, [{ label: "Kerja" }, { label: "Akta", href: "/akta" }, { label: "Akta baru" }]],
  [/^\/jadwal$/, [{ label: "Kerja" }, { label: "Jadwal" }]],
  [/^\/dokumen$/, [{ label: "Kerja" }, { label: "Minuta & dokumen" }]],
  [/^\/register\/repertorium$/, [{ label: "Register" }, { label: "Repertorium" }]],
  [/^\/register\/klapper$/, [{ label: "Register" }, { label: "Buku klapper" }]],
  [/^\/protokol$/, [{ label: "Register" }, { label: "Protokol notaris" }]],
  [/^\/dasar-hukum$/, [{ label: "Referensi" }, { label: "Dasar hukum" }]],
  [/^\/admin\/pengguna$/, [{ label: "Administrasi" }, { label: "Pengguna" }]],
  [/^\/admin\/audit$/, [{ label: "Administrasi" }, { label: "Audit log" }]],
  [/^\/keamanan$/, [{ label: "Administrasi" }, { label: "Keamanan" }]],
  // Detail pages until they register their own title (see <PageCrumbs>).
  [/^\/berkas\//, [{ label: "Kerja" }, { label: "Berkas", href: "/berkas" }]],
  [/^\/akta\//, [{ label: "Kerja" }, { label: "Akta", href: "/akta" }]],
  [/^\/dasar-hukum\//, [{ label: "Referensi" }, { label: "Dasar hukum", href: "/dasar-hukum" }]],
];

// Detail pages publish their trail (with record titles) for the current path.
let current: { path: string; items: Crumb[] } | null = null;
const listeners = new Set<() => void>();
const store = {
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  get: () => current,
  set: (v: typeof current) => { current = v; listeners.forEach((fn) => fn()); },
};

/** Placed on a detail page to show record titles in the breadcrumb and the browser tab. */
export function PageCrumbs({ items }: { items: Crumb[] }) {
  const path = usePathname();
  const key = JSON.stringify(items);
  useEffect(() => {
    store.set({ path, items: JSON.parse(key) });
    return () => { if (store.get()?.path === path) store.set(null); };
  }, [path, key]);
  return null;
}

export function Breadcrumbs() {
  const path = usePathname();
  const registered = useSyncExternalStore(store.subscribe, store.get, () => null);
  const items = registered?.path === path ? registered.items : STATIC.find(([re]) => re.test(path))?.[1] ?? [];
  if (items.length === 0) return <span />;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[13px]">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className={cn("flex items-center gap-1",
              // Only long record titles give way; short labels keep their width.
              c.label.length > 24 ? "min-w-0" : "shrink-0",
              // Section labels (no link) are context only: hidden when space is short.
              !last && !c.href && "max-xl:hidden",
              !last && i < items.length - 2 && "max-md:hidden")}>
              {c.href && !last ? (
                <Link href={c.href} className="truncate rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined}
                  className={cn("truncate px-1.5 py-1", last ? "max-w-[46ch] font-medium text-foreground" : "text-subtle")} title={c.label}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight size={13} className="shrink-0 text-subtle" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
