# Verity

Internal workspace for a Notaris/PPAT office and a separate non-litigation firm. Every client
matter is a **berkas**; an AI agent reads and proposes, humans approve. See
[docs/PLAN.md](docs/PLAN.md) (approved plan), [docs/PRD.md](docs/PRD.md), [docs/TRD.md](docs/TRD.md).

All client data, including model inference, stays in Indonesia (PLAN.md §4, §10).

## Layout

| Path | What |
| --- | --- |
| `apps/web` | Next.js 16 app (Bahasa Indonesia UI), Supabase auth with TOTP MFA |
| `apps/engine` | FastAPI engine; Phase 0 has JWT verification only |
| `packages/schema` | JSON Schema source of truth → `packages/schema-ts` (Zod) and `python/verity_schema` (Pydantic) |
| `packages/tokens` | Design tokens from `docs/design/berkas-workspace.jsx` |
| `python/verity_core` | Shared Python: JWKS verification, log redaction |
| `supabase/migrations` | Schema, RLS, RPCs, append-only audit log |
| `supabase/tests` | RLS / isolation / append-only tests (plain Postgres or Supabase) |
| `infra/selfhost` | Overrides for self-hosted Supabase in Jakarta |
| `scripts/invite_user.py` | Bastion-only account creation |

## Develop

```bash
pnpm install
uv sync --all-packages
```

```bash
pnpm db:test            # starts a throwaway Postgres 17 (Homebrew) and runs the RLS tests
uv run pytest python/verity_core/tests apps/engine/tests
pnpm --filter @verity/web dev
pnpm gen:schema         # regenerate Zod + Pydantic after editing packages/schema/schemas
```

Full local stack (`supabase start`) needs Docker. Then create accounts with
`scripts/invite_user.py` against the local API and attach them to a tenant from the
Pengguna page as a Super Admin.

## Rules that code must not break
The ten non-negotiable rules and where each is enforced are in PLAN.md §10.1. In short: the
agent never writes to the system of record, identity comes only from verified JWT claims,
RLS is the final authority, registers and the audit log are append-only in the database, and
no client data leaves Indonesia.
