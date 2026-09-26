import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { principalSchema } from "@verity/schema-ts";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/roles";

export type Principal = {
  userId: string;
  email?: string;
  aal: string;
  tenantId?: string;
  role?: AppRole;
  /** Has a verified second factor: then every session must complete it (aal2). */
  mfaEnrolled: boolean;
};

/**
 * Identity from the verified JWT only (JWT check 2, rule 5). getClaims() verifies the
 * signature against the project's JWKS; nothing is read from request headers.
 */
export const getPrincipal = cache(async (): Promise<Principal | null> => {
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
  // 2FA is optional (ADR 0005); nextLevel is aal2 exactly when the user has a verified factor.
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    mfaEnrolled: level?.nextLevel === "aal2",
    userId: p.user_id,
    email: typeof c.email === "string" ? c.email : undefined,
    aal: p.aal,
    tenantId: p.tenant_id ?? undefined,
    role: p.app_role ?? undefined,
  };
});

export type ActivePrincipal = Principal & { tenantId: string; role: AppRole };

/** For pages inside the app shell: signed in, member of a tenant, 2FA completed if enrolled. */
export async function requirePrincipal(): Promise<ActivePrincipal> {
  const p = await getPrincipal();
  if (!p) redirect("/masuk");
  if (!p.tenantId || !p.role) redirect("/tanpa-akses");
  if (needsMfa(p)) redirect("/masuk/mfa");
  return p as ActivePrincipal;
}

/** 2FA is optional, but a user who enrolled a factor must complete it in every session. */
export function needsMfa(p: Principal) {
  return p.mfaEnrolled && p.aal !== "aal2";
}

/** Registers and protokol exist only for a notary office, not for a law firm. */
export const isNotaryOffice = cache(async (tenantId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("tenants").select("kind").eq("id", tenantId).maybeSingle();
  return data?.kind === "kantor_notaris";
});
