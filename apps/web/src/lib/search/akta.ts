import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Text safe to put inside a PostgREST `or=(... ilike ...)` filter. */
export const likeTerm = (q: string) => `%${q.replace(/[%,()*\\]/g, " ").trim()}%`;

/** "001/2026", "12" or "12/2026" → akta number and optional period. */
export function parseAktaNumber(q: string): { number: number; period?: string } | null {
  const m = q.trim().match(/^0*(\d{1,5})(?:\s*\/\s*(\d{4}))?$/);
  return m ? { number: Number(m[1]), period: m[2] } : null;
}

/**
 * Ids of akta the user may see whose number or party (person or company) matches `q`.
 * Every query runs under the user's RLS, like the list itself.
 */
export async function aktaIdsMatching(supabase: SupabaseClient, q: string): Promise<string[]> {
  const like = likeTerm(q);
  const num = parseAktaNumber(q);
  const [persons, companies, byNumber] = await Promise.all([
    supabase.from("persons").select("id").ilike("full_name", like).limit(200),
    supabase.from("companies").select("id").ilike("name", like).limit(200),
    num
      ? (num.period
          ? supabase.from("akta").select("id").eq("number", num.number).eq("number_period", num.period)
          : supabase.from("akta").select("id").eq("number", num.number)).limit(200)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const personIds = (persons.data ?? []).map((p) => p.id);
  const companyIds = (companies.data ?? []).map((c) => c.id);
  const ors = [
    personIds.length ? `person_id.in.(${personIds.join(",")})` : null,
    companyIds.length ? `company_id.in.(${companyIds.join(",")})` : null,
  ].filter(Boolean);
  const parties = ors.length
    ? await supabase.from("akta_parties").select("akta_id").or(ors.join(",")).limit(500)
    : { data: [] as { akta_id: string }[] };
  return [...new Set([...(byNumber.data ?? []).map((a) => a.id), ...(parties.data ?? []).map((p) => p.akta_id)])];
}
