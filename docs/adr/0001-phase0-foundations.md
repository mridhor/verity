# ADR 0001: Phase 0 foundations and deviations

Date: 2026-09-25. Status: accepted (implements PLAN.md Phase 0 partially).

## Decisions taken while building
- **Next.js 16, ESLint 9, TypeScript 5.** npm resolved TypeScript 7 and ESLint 10, which
  `next build` and `eslint-plugin-react` do not yet support. Revisit on upgrade.
- **Active tenant stored in `public.user_settings`**, not `auth.users.raw_app_meta_data`,
  so no migration needs write access to the `auth` schema. The access token hook reads it.
- **Accounts are created by a bastion script** with the admin API (secret key never in an
  app container). The Super Admin grants roles and memberships in the app.
- **Super Admin** sees berkas metadata and the audit log but no content, cannot create
  berkas, cannot be a berkas member, and cannot change their own role (C-17, D-07 recommendation).
- **Partner** sees only assigned berkas (PRD §4; D-08 still open).
- **Staff are not forced to aal2 by RLS**; MFA is mandatory for notaris, partner and
  super_admin (REQ-GW-05).
- **Tables are owned by the migration role** (`postgres`), not a separate NOLOGIN owner as
  PLAN.md §6 suggests. Append-only triggers apply to the owner too; revisit before Phase 1 registers.

## Test harness
Docker is not available on the development machine, so `supabase test db` (pgTAP) cannot
run locally. DB tests are pytest + psycopg against a throwaway Postgres 17 with a minimal
stub of Supabase's `auth.uid()`/`auth.jwt()`/roles (`supabase/tests/bootstrap`). CI runs
the same tests against `postgres:17`; they can also target a real Supabase stack via
`VERITY_TEST_DATABASE_URL`.

## Not done in Phase 0 yet (blocked or pending)
- Jakarta infrastructure, backups and restore drill: blocked on D-01 (cloud provider) and D-02.
- In-region edge (WAF, rate limit, JWT check 1): blocked on D-01 and D-09.
- Auth email provider for invites/password reset: D-10.
- Password change screen for first login.
