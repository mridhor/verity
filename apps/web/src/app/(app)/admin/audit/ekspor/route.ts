import { NextResponse, type NextRequest } from "next/server";
import { AUDIT_MODULES, auditLabel } from "@/lib/audit-labels";
import { getPrincipal, needsMfa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const csv = (v: unknown) => {
  const s = String(v ?? "");
  // Neutralise spreadsheet formulas as well as quoting.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV export of audit metadata (no client content is ever stored in the log). RLS limits rows. */
export async function GET(request: NextRequest) {
  const me = await getPrincipal();
  if (!me || (me.role !== "notaris" && me.role !== "super_admin") || needsMfa(me)) {
    return new NextResponse("Tidak diizinkan.", { status: 403 });
  }
  const mod = AUDIT_MODULES.find((m) => m.id === request.nextUrl.searchParams.get("modul"));
  const supabase = await createClient();
  let query = supabase.from("audit_log").select("id, occurred_at, actor_type, actor_user_id, action, target_type, target_id, berkas_id")
    .order("id", { ascending: true }).limit(50000);
  if (mod) query = query.or(mod.prefixes.map((p) => `action.like.${p}*`).join(","));
  const [{ data: rows }, { data: colleagues }] = await Promise.all([
    query,
    supabase.from("tenant_members").select("user_id, display_name").eq("tenant_id", me.tenantId!),
  ]);
  const nameOf = new Map((colleagues ?? []).map((c) => [c.user_id, c.display_name]));
  const lines = [
    ["id", "waktu_utc", "pelaku", "jenis_pelaku", "kode_tindakan", "tindakan", "target", "target_id", "berkas_id"].join(","),
    ...(rows ?? []).map((r) => [r.id, r.occurred_at, nameOf.get(r.actor_user_id ?? "") ?? r.actor_user_id ?? "", r.actor_type, r.action,
      auditLabel(r.action), r.target_type ?? "", r.target_id ?? "", r.berkas_id ?? ""].map(csv).join(",")),
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
