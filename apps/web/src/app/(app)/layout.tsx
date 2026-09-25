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
  // One parallel round trip for the shell; the unread count comes from the same list.
  const [{ data: berkas }, { data: tenants }, { data: self }, { data: notes }] = await Promise.all([
    supabase.from("berkas").select("id, title, status").eq("status", "aktif").order("updated_at", { ascending: false }).limit(8),
    supabase.from("tenants").select("id, name, kind").order("name"),
    supabase.from("tenant_members").select("display_name").eq("user_id", me.userId).eq("tenant_id", me.tenantId).maybeSingle(),
    supabase.from("notifications").select("id, kind, payload, created_at, read_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const unread = (notes ?? []).filter((n) => !n.read_at).length;
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
        <Topbar notifications={notes ?? []} unread={unread} />
        {children}
      </main>
      <AgentSidecar />
    </div>
    <CommandPalette />
    </AgentProvider>
  );
}
