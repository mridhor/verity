// Creates a login account with an initial password and adds it to the caller's office.
// Runs on Supabase, where the secret key lives; the web app never holds it (PLAN.md §6).
// Only an active Super Admin of the office may call it, having completed 2FA if they enrolled it
// (2FA is optional since ADR 0005). The new
// user must change the password at first sign-in (app_metadata.must_change_password).
import { createClient } from "npm:@supabase/supabase-js@2";

const ROLES = new Set(["notaris", "partner", "associate", "staf_admin", "super_admin"]);
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function secretKey(): string | undefined {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default; } catch { return undefined; }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const url = Deno.env.get("SUPABASE_URL");
  const key = secretKey();
  const apikey = req.headers.get("apikey") ?? "";
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !apikey || !token) return json(401, { error: "unauthorized" });

  // The caller, acting under their own session and RLS.
  const caller = createClient(url, apikey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claimsData } = await caller.auth.getClaims(token);
  const claims = claimsData?.claims as Record<string, unknown> | undefined;
  if (!claims || claims.app_role !== "super_admin" || !claims.tenant_id) {
    return json(403, { error: "forbidden" });
  }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  if (claims.aal !== "aal2") {
    // Optional 2FA: aal1 is enough only for a caller without a verified factor.
    const { data: factors, error: factorError } = await admin.auth.admin.mfa.listFactors({ userId: String(claims.sub) });
    if (factorError || (factors?.factors ?? []).some((f) => f.status === "verified")) return json(403, { error: "forbidden" });
  }
  // Live membership check (a revoked role stops working before the token expires).
  const { error: liveError } = await caller.rpc("list_tenant_members");
  if (liveError) return json(403, { error: "forbidden" });

  let body: { email?: string; password?: string; displayName?: string; role?: string };
  try { body = await req.json(); } catch { return json(400, { error: "invalid_body" }); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim();
  const role = String(body.role ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || displayName.length < 2 || displayName.length > 120 || !ROLES.has(role)) {
    return json(400, { error: "invalid_input" });
  }
  if (password.length < 10 || password.length > 72) return json(400, { error: "weak_password" });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { must_change_password: true },
  });
  if (createError || !created.user) {
    const exists = createError?.code === "email_exists" || /already/i.test(createError?.message ?? "");
    return json(exists ? 409 : 400, { error: exists ? "email_exists" : "create_failed" });
  }

  // Membership and role are granted by the existing RPC, as the caller (audited, Notaris notified).
  const { error: addError } = await caller.rpc("add_tenant_member", { p_email: email, p_role: role, p_display_name: displayName });
  if (addError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json(addError.code === "42501" ? 403 : 400, { error: "add_failed" });
  }
  return json(200, { ok: true, userId: created.user.id });
});
