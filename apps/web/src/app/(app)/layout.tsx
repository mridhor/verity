import { AgentProvider } from "@/components/agent/agent-provider";
import { CommandPalette } from "@/components/agent/command-palette";
import { AgentSidecar } from "@/components/agent/sidecar";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { requirePrincipal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requirePrincipal();
  const supabase = await createClient();
  const [{ data: berkas }, { data: tenants }, { data: self }, { data: notes }, { count: unread }] = await Promise.all([
    supabase.from("berkas").select("id, title, status").eq("status", "aktif").order("updated_at", { ascending: false }).limit(8),
    supabase.from("tenants").select("id, name, kind").order("name"),
    supabase.from("tenant_members").select("display_name").eq("user_id", me.userId).eq("tenant_id", me.tenantId).maybeSingle(),
    supabase.from("notifications").select("id, kind, created_at, read_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  const tenantKind = (tenants ?? []).find((t) => t.id === me.tenantId)?.kind ?? "kantor_notaris";

  return (
    <AgentProvider>
    <div className="flex h-screen">
      <Sidebar
        me={{ role: me.role, tenantId: me.tenantId, name: self?.display_name ?? me.email ?? "" }}
        tenantKind={tenantKind}
        berkas={berkas ?? []}
        tenants={tenants ?? []}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar notifications={notes ?? []} unread={unread ?? 0} />
        {children}
      </main>
      <AgentSidecar />
    </div>
    <CommandPalette />
    </AgentProvider>
  );
}
