import { AgentToggleButton } from "@/components/agent/sidecar";
import { formatLongDate, jakartaToday } from "@/lib/jakarta-time";
import { Breadcrumbs } from "./breadcrumbs";
import { NotificationBell } from "./notification-bell";

export function Topbar({ unread }: { unread: number }) {
  return (
    <div className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-transparent bg-card/85 pr-5 pl-6 text-[12.5px] text-muted-foreground backdrop-blur">
      <div className="min-w-0 flex-1"><Breadcrumbs /></div>
      <span className="mr-2 whitespace-nowrap text-subtle max-lg:hidden">{formatLongDate(jakartaToday().date)}</span>
      <NotificationBell unread={unread} />
      <AgentToggleButton />
    </div>
  );
}
