import { Bell } from "lucide-react";
import { formatLongDate, jakartaToday } from "@/lib/jakarta-time";
import { formatDateTime } from "@/lib/utils";
import { markAllNotificationsRead } from "./notification-actions";

const NOTE_LABEL: Record<string, string> = {
  "tenant_member.added": "Pengguna baru ditambahkan ke kantor",
  "tenant_member.updated": "Peran pengguna diubah",
  "berkas_member.changed": "Keanggotaan berkas diubah",
};

type Note = { id: number; kind: string; created_at: string; read_at: string | null };

export function Topbar({ notifications, unread }: { notifications: Note[]; unread: number }) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-end gap-4 border-b border-border-soft px-8 text-[12.5px] text-muted-foreground">
      <span>{formatLongDate(jakartaToday().date)}</span>
      <details className="relative">
        <summary
          className="relative flex cursor-pointer list-none items-center rounded-md p-1.5 hover:bg-border-soft [&::-webkit-details-marker]:hidden"
          aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
        >
          <Bell size={15} />
          {unread > 0 && <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive" />}
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-80 rounded-md border border-border bg-card shadow-[0_12px_30px_-18px_rgba(40,36,20,.35)]">
          <div className="flex items-center justify-between border-b border-border-soft px-3.5 py-2.5">
            <span className="text-[13px] font-semibold text-foreground">Notifikasi</span>
            {unread > 0 && (
              <form action={markAllNotificationsRead}>
                <button className="text-[11.5px] hover:text-foreground">Tandai sudah dibaca</button>
              </form>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-[12.5px] text-subtle">Tidak ada notifikasi.</p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n.id} className="flex gap-2.5 border-b border-border-soft px-3.5 py-2.5 last:border-0">
                  <span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.read_at ? "bg-border" : "bg-primary"}`} />
                  <div>
                    <div className="text-[12.5px] text-foreground">{NOTE_LABEL[n.kind] ?? n.kind}</div>
                    <div className="text-[11px] text-subtle">{formatDateTime(n.created_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}
