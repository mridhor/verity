// Generated from packages/schema/schemas by `pnpm gen:schema`. Do not edit.
import { z } from "zod"

export const principalSchema = z.object({ "user_id": z.string().uuid(), "tenant_id": z.union([z.string().uuid(), z.null()]).optional(), "app_role": z.union([z.enum(["notaris","partner","associate","staf_admin","super_admin"]), z.null()]).optional(), "aal": z.enum(["aal1","aal2"]) }).strict().describe("Identity derived only from verified Supabase JWT claims (PLAN.md rule 5).")
export type PrincipalSchema = z.infer<typeof principalSchema>
