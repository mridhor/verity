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
  // One parallel round trip for the shell; bell contents load only when it is opened.
  const [{ data: berkas }, { data: tenants }, { data: self }, { data: notes }] = await Promise.all([
    supabase.from("berkas").select("id, title, status").eq("status", "aktif").order("updated_at", { ascending: false }).limit(8),
    supabase.from("tenants").select("id, name, kind").order("name"),
    supabase.from("tenant_members").select("display_name").eq("user_id", me.userId).eq("tenant_id", me.tenantId).maybeSingle(),
    supabase.from("notifications").select("id, read_at").is("read_at", null).limit(50),
  ]);
  const unread = (notes ?? []).length;
  const tenantKind = (tenants ?? []).find((t) => t.id === me.tenantId)?.kind ?? "kantor_notaris";

  return (
    <AgentProvider>
    <div className="flex h-screen gap-2 overflow-hidden bg-background p-2 pl-0">
      <Sidebar
        me={{ role: me.role, tenantId: me.tenantId, name: self?.display_name ?? me.email ?? "" }}
        tenantKind={tenantKind}
        berkas={berkas ?? []}
        tenants={tenants ?? []}
      />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-y-auto rounded-xl bg-card shadow-surface">
        <Topbar unread={unread} />
        {children}
      </main>
      <AgentSidecar />
    </div>
    <CommandPalette />
    </AgentProvider>
  );
}
