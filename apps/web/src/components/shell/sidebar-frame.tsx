"use client";

import { useCallback, useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "verity.sidebar.collapsed";
const listeners = new Set<() => void>();
const store = {
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  get: () => window.localStorage.getItem(KEY) === "1",
  set: (v: boolean) => { window.localStorage.setItem(KEY, v ? "1" : "0"); listeners.forEach((fn) => fn()); },
};

/** Sidebar that folds into an icon rail; the choice is remembered on this device. */
export function SidebarFrame({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(store.subscribe, store.get, () => false);
  const toggle = useCallback(() => store.set(!collapsed), [collapsed]);
  return (
    <nav
      aria-label="Navigasi utama"
      data-collapsed={collapsed}
      className={cn("group/side relative flex shrink-0 flex-col overflow-y-auto overflow-x-hidden transition-[width] duration-200",
        collapsed ? "w-[60px]" : "w-[236px]")}
    >
      <button type="button" onClick={toggle} aria-label={collapsed ? "Buka sidebar" : "Ciutkan sidebar"} title={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
        className={cn("absolute top-[18px] z-10 grid size-7 place-items-center rounded-md text-subtle hover:bg-foreground/[0.05] hover:text-foreground",
          collapsed ? "left-1/2 -translate-x-1/2 top-[60px]" : "right-2")}>
        {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
      </button>
      {children}
    </nav>
  );
}
