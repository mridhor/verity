import "server-only";
import type { ReadonlyDb } from "./readonly-db";
import type { CitationTarget } from "./types";

const TABLE: Record<CitationTarget["kind"], string> = {
  berkas: "berkas",
  akta: "akta",
  person: "persons",
  company: "companies",
  document: "documents",
  checklist: "checklist_items",
  schedule: "schedules",
  legal: "legal_references",
  repertorium: "repertorium_entries",
  klapper: "klapper_entries",
};

/**
 * REQ-AI-06 (a) and (b): re-check that every cited record exists and is visible to the user,
 * under RLS, before it reaches the UI. Returns the ids that survived. Groundedness (c) needs
 * the language model and comes with the engine.
 */
export async function validateCitations(db: ReadonlyDb, targets: CitationTarget[]): Promise<Set<string>> {
  const ok = new Set<string>();
  const byKind = new Map<CitationTarget["kind"], string[]>();
  for (const t of targets) byKind.set(t.kind, [...(byKind.get(t.kind) ?? []), t.id]);
  await Promise.all(
    [...byKind.entries()].map(async ([kind, ids]) => {
      const { data } = await db.select(TABLE[kind], "id").in("id", [...new Set(ids)]);
      for (const r of (data ?? []) as unknown as { id: string }[]) ok.add(`${kind}:${r.id}`);
    }),
  );
  return ok;
}
