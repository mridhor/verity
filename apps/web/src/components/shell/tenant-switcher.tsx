"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Switches the active tenant (D-11). New claims only exist after the session refresh. */
export function TenantSwitcher({ tenants, activeId }: { tenants: { id: string; name: string }[]; activeId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tenant = e.target.value;
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("switch_tenant", { p_tenant: tenant });
      if (error) return;
      await supabase.auth.refreshSession();
      router.replace("/berkas");
      router.refresh();
    });
  }

  return (
    <label className="mb-3 block">
      <span className="sr-only">Kantor aktif</span>
      <select
        value={activeId}
        onChange={onChange}
        disabled={pending}
        className="h-8 w-full rounded-md border border-border bg-card px-2 text-[12.5px]"
      >
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
