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

## Environment variables

Every place that reads one has a `.env.example` next to it — copy it, don't invent values:

| File | Used by | Notes |
| --- | --- | --- |
| [`apps/web/.env.example`](apps/web/.env.example) | Next.js app | `NEXT_PUBLIC_*`, safe for the browser; RLS is the real access control |
| [`apps/engine/.env.example`](apps/engine/.env.example) | FastAPI engine | No secret key — the engine only ever holds the caller's own JWT |
| [`scripts/.env.example`](scripts/.env.example) | `scripts/invite_user.py` | Holds the Supabase secret key — bastion-only, never on a laptop or in CI |
| [`supabase/tests/.env.example`](supabase/tests/.env.example) | `pnpm db:test` | Optional; only needed to point tests at an already-running Postgres |
| [`infra/selfhost/.env.example`](infra/selfhost/.env.example) | Self-hosted Supabase (production, Jakarta) | Merge into the upstream Compose stack's `.env` |

**Vercel** (monorepo): set the project **Root Directory** to `apps/web`. Put the same two
`apps/web/.env.example` values in the Vercel project as **Environment Variables**. Next.js
inlines `NEXT_PUBLIC_*` at build time.

## Rules that code must not break
The ten non-negotiable rules and where each is enforced are in PLAN.md §10.1. In short: the
agent never writes to the system of record, identity comes only from verified JWT claims,
RLS is the final authority, registers and the audit log are append-only in the database, and
no client data leaves Indonesia.
