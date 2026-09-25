"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  const active = usePathname().startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "mx-2 my-px flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] text-muted-foreground hover:bg-border-soft",
        active && "bg-card font-medium text-foreground shadow-[inset_0_0_0_1px_var(--border)]",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
