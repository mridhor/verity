import "server-only";
import { redirect } from "next/navigation";
import { principalSchema } from "@verity/schema-ts";
import { createClient } from "@/lib/supabase/server";
import { MFA_REQUIRED, type AppRole } from "@/lib/roles";

export type Principal = {
  userId: string;
  email?: string;
  aal: string;
  tenantId?: string;
  role?: AppRole;
};

/**
 * Identity from the verified JWT only (JWT check 2, rule 5). getClaims() verifies the
 * signature against the project's JWKS; nothing is read from request headers.
 */
export async function getPrincipal(): Promise<Principal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  const c = data.claims;
  // Same schema the engine uses (packages/schema/schemas/principal.schema.json).
  const parsed = principalSchema.safeParse({
    user_id: c.sub,
    tenant_id: c.tenant_id ?? null,
    app_role: c.app_role ?? null,
    aal: c.aal ?? "aal1",
  });
  if (!parsed.success) return null;
  const p = parsed.data;
  return {
    userId: p.user_id,
    email: typeof c.email === "string" ? c.email : undefined,
    aal: p.aal,
    tenantId: p.tenant_id ?? undefined,
    role: p.app_role ?? undefined,
  };
}

export type ActivePrincipal = Principal & { tenantId: string; role: AppRole };

/** For pages inside the app shell: signed in, member of a tenant, MFA done when required. */
export async function requirePrincipal(): Promise<ActivePrincipal> {
  const p = await getPrincipal();
  if (!p) redirect("/masuk");
  if (!p.tenantId || !p.role) redirect("/tanpa-akses");
  if (MFA_REQUIRED.has(p.role) && p.aal !== "aal2") redirect("/masuk/mfa");
  return p as ActivePrincipal;
}

export function needsMfa(p: Principal) {
  return !!p.role && MFA_REQUIRED.has(p.role) && p.aal !== "aal2";
}

/** Registers and protokol exist only for a notary office, not for a law firm. */
export async function isNotaryOffice(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("tenants").select("kind").eq("id", tenantId).maybeSingle();
  return data?.kind === "kantor_notaris";
}
