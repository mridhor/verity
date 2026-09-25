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
      title={typeof children === "string" ? children : undefined}
      className={cn(
        "mx-2 my-px flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground",
        "group-data-[collapsed=true]/side:justify-center group-data-[collapsed=true]/side:px-0",
        active && "bg-card font-medium text-foreground shadow-surface hover:bg-card",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate group-data-[collapsed=true]/side:sr-only">{children}</span>
    </Link>
  );
}
