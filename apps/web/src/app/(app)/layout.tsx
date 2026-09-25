import { Sidebar } from "@/components/shell/sidebar";
import { requirePrincipal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePrincipal();
  const supabase = await createClient();
  const [{ data: berkas }, { data: tenants }, { data: self }] = await Promise.all([
    supabase.from("berkas").select("id, title, status").eq("status", "aktif").order("updated_at", { ascending: false }).limit(8),
    supabase.from("tenants").select("id, name, kind").order("name"),
    supabase.from("tenant_members").select("display_name").eq("user_id", me.userId).eq("tenant_id", me.tenantId).maybeSingle(),
  ]);

  return (
    <div className="flex h-screen">
      <Sidebar
        me={{ role: me.role, tenantId: me.tenantId, name: self?.display_name ?? me.email ?? "" }}
        berkas={berkas ?? []}
        tenants={tenants ?? []}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
