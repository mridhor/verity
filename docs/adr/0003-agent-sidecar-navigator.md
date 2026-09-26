# ADR 0003: Agent sidecar and navigator (UI phase)

Date: 2026-09-25. Status: accepted.

The owner asked for the AI agent surface before a domestic LLM provider is chosen. This phase
builds the full UI, the event contract and a real approval flow, backed by a deterministic
scenario agent that reads real data under the user's RLS.

## Decisions
- **One agent, three surfaces:** sidecar (topbar "Tanya agent", `⌘J`), the berkas "Percakapan" tab
  with a document pane, and the navigator (`⌘K`, sidebar search box). They share threads: one per
  berkas (visible to berkas members) and private office threads per user and page context.
- **Event contract:** `packages/schema/schemas/agent-event.schema.json`, generated to Zod and
  Pydantic. The future engine must emit the same events; the UI does not change.
- **Provider switch:** `VERITY_AGENT_PROVIDER` (only `scenario` today). The scenario agent is
  labelled "Mode uji" in the UI and says plainly when it cannot answer.
- **Rule 1 in code and DB:** skills only get `readonlyDb` (select + the `create_proposed_changes`
  RPC). Changes are `proposed_changes`, applied only by `decide_proposed_change` after a human
  approves. Tiers: staff (`checklist.add`, `schedule.add`, `akta.submit_verification`) and Notaris
  (`akta.approve_for_signing`, needs Notaris/Partner and aal2). Finalizing, numbering and signing
  are not ops at all (rule 2).
- **Citations** are re-checked against the database (exists and visible) before they are sent;
  invalid ones are dropped and the claim is marked "tanpa sumber".

## Not in this phase
Real LLM and LangGraph engine, groundedness checks, a separate agent PostgREST role, SSE resume
via `Last-Event-ID`, rate limits, a mobile layout for the app shell as a whole.
