"use server";

import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/lib/auth";
import { formatTime, jakartaInstant, jakartaToday } from "@/lib/jakarta-time";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export async function markAllNotificationsRead(): Promise<void> {
  await requirePrincipal();
  const supabase = await createClient();
  // RLS limits this to the caller's own notifications.
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/", "layout");
}

export type InboxItem = { id: string; title: string; sub: string; href: string; tone: "info" | "warning" | "success" | "neutral"; unread?: boolean };

const KIND: Record<string, { label: string; tone: InboxItem["tone"] }> = {
  "akta.awaiting_signature": { label: "Akta menunggu tanda tangan", tone: "warning" },
  "akta.returned": { label: "Akta dikembalikan ke draft", tone: "neutral" },
  "akta.finalized": { label: "Akta difinalkan", tone: "success" },
  "proposal.pending": { label: "Usulan agen menunggu persetujuan", tone: "info" },
  "agent.presigning": { label: "Pemeriksaan pra-tanda tangan", tone: "info" },
  "tenant_member.added": { label: "Pengguna baru ditambahkan ke kantor", tone: "neutral" },
  "tenant_member.updated": { label: "Peran pengguna diubah", tone: "neutral" },
  "berkas_member.changed": { label: "Keanggotaan berkas diubah", tone: "neutral" },
};

/**
 * Bell contents, loaded only when the bell is opened: stored notifications with their akta or
 * berkas title, plus reminders computed from today's agenda and due checklist items (RLS applies).
 */
export async function getInbox(): Promise<{ reminders: InboxItem[]; notifications: InboxItem[] }> {
  const me = await requirePrincipal();
  const supabase = await createClient();
  const { date: today } = jakartaToday();
  const inTwoDays = new Date(`${today}T00:00:00Z`);
  inTwoDays.setUTCDate(inTwoDays.getUTCDate() + 2);
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const content = me.role !== "super_admin";

  const [{ data: notes }, schedules, checklist, waiting] = await Promise.all([
    supabase.from("notifications").select("id, kind, payload, created_at, read_at").order("created_at", { ascending: false }).limit(15),
    content
      ? supabase.from("schedules").select("id, title, starts_at, location")
          .gte("starts_at", jakartaInstant(today)).lt("starts_at", jakartaInstant(tomorrow.toISOString().slice(0, 10))).order("starts_at").limit(6)
      : Promise.resolve({ data: [] as { id: string; title: string; starts_at: string; location: string | null }[] }),
    content
      ? supabase.from("checklist_items").select("id, title, due_date, berkas_id, berkas(title)")
          .eq("done", false).not("due_date", "is", null).lte("due_date", inTwoDays.toISOString().slice(0, 10)).order("due_date").limit(6)
      : Promise.resolve({ data: [] as unknown[] }),
    content && me.role === "notaris"
      ? supabase.from("akta").select("id", { count: "exact", head: true }).eq("status", "menunggu_ttd")
      : Promise.resolve({ count: 0 }),
  ]);

  const aktaIds = [...new Set((notes ?? []).map((n) => (n.payload as { akta_id?: string })?.akta_id).filter(Boolean))] as string[];
  const berkasIds = [...new Set((notes ?? []).map((n) => (n.payload as { berkas_id?: string })?.berkas_id).filter(Boolean))] as string[];
  const [{ data: akta }, { data: berkas }] = await Promise.all([
    aktaIds.length ? supabase.from("akta").select("id, title").in("id", aktaIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    berkasIds.length ? supabase.from("berkas").select("id, title").in("id", berkasIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  const aktaTitle = new Map((akta ?? []).map((a) => [a.id, a.title]));
  const berkasTitle = new Map((berkas ?? []).map((b) => [b.id, b.title]));

  const reminders: InboxItem[] = [
    ...(waiting.count ? [{ id: "ttd", title: `${waiting.count} akta menunggu tanda tangan`, sub: "Perlu difinalkan setelah ditandatangani", href: "/akta?status=menunggu_ttd", tone: "warning" as const }] : []),
    ...((schedules.data ?? []) as { id: string; title: string; starts_at: string; location: string | null }[]).map((s) => ({
      id: `s-${s.id}`, title: s.title, sub: `Hari ini ${formatTime(s.starts_at)}${s.location ? ` · ${s.location}` : ""}`, href: "/jadwal", tone: "info" as const,
    })),
    ...((checklist.data ?? []) as { id: string; title: string; due_date: string; berkas_id: string; berkas: { title: string } | null }[]).map((c) => ({
      id: `c-${c.id}`, title: c.title,
      sub: `${c.due_date < today ? "Terlambat" : c.due_date === today ? "Tenggat hari ini" : "Tenggat besok/lusa"} · ${c.berkas?.title ?? ""}`,
      href: `/berkas/${c.berkas_id}?tab=checklist`, tone: (c.due_date < today ? "warning" : "neutral") as InboxItem["tone"],
    })),
  ];
  const notifications: InboxItem[] = (notes ?? []).map((n) => {
    const p = (n.payload ?? {}) as { akta_id?: string; berkas_id?: string };
    const k = KIND[n.kind] ?? { label: n.kind, tone: "neutral" as const };
    const subject = (p.akta_id && aktaTitle.get(p.akta_id)) || (p.berkas_id && berkasTitle.get(p.berkas_id)) || "";
    const toChat = n.kind === "proposal.pending" || n.kind === "agent.presigning";
    const href = p.akta_id ? `/akta/${p.akta_id}` : p.berkas_id ? `/berkas/${p.berkas_id}${toChat ? "?tab=percakapan" : ""}` : "/beranda";
    const findings = (n.payload as { findings?: number })?.findings;
    const title = n.kind === "agent.presigning" && findings !== undefined
      ? `${k.label}: ${findings ? `${findings} temuan` : "siap"}` : k.label;
    const tone = n.kind === "agent.presigning" ? (findings ? "warning" : "success") : k.tone;
    return { id: String(n.id), title, sub: [subject, formatDateTime(n.created_at)].filter(Boolean).join(" · "), href, tone, unread: !n.read_at };
  });
  return { reminders, notifications };
}
