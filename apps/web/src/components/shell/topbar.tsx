import { AgentToggleButton } from "@/components/agent/sidecar";
import { formatLongDate, jakartaToday } from "@/lib/jakarta-time";
import { NotificationBell } from "./notification-bell";

export function Topbar({ unread }: { unread: number }) {
  return (
    <div className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-end gap-2 bg-card/85 px-5 text-[12.5px] text-muted-foreground backdrop-blur">
      <span className="mr-2 text-subtle">{formatLongDate(jakartaToday().date)}</span>
      <NotificationBell unread={unread} />
      <AgentToggleButton />
    </div>
  );
}
