# ADR 0005: Two-step verification is optional

Date: 2026-09-26. Status: accepted. Supersedes REQ-GW-05 ("2FA is mandatory for Notaris, Partner
and Super Admin"), which is no longer enforced.

The owner decided that two-step verification (TOTP) is optional for every role, and that accounts
which already enrolled a factor keep it.

## Rule
- **Without a verified factor:** the user signs in with a password only (`aal1`). All roles,
  including Notaris and Super Admin, may then use everything their role allows.
- **With a verified factor:** the user must enter the code in every session. Until the session is
  `aal2`:
  - the proxy sends them to `/masuk/mfa`;
  - the database treats them as before. RLS (`private.aal_ok()`) shows nothing, and privileged
    RPCs refuse: finalize, notaris status changes, register corrections, verifying legal
    references, deciding Notaris-tier proposals, office settings, and session revocation.
- **Either way:** anyone may enrol from Keamanan, and turn their own factor off there again (that
  needs a session verified with it).

## Implementation
- `private.mfa_ok()` is true when the session is `aal2` or the user has no verified factor in
  `auth.mfa_factors`. `private.aal_ok()` and every former "must be aal2" check now call it
  (migration `20260928000100_optional_mfa.sql`).
- The web app decides from `getAuthenticatorAssuranceLevel()`: `nextLevel = aal2` means the user
  is enrolled. This drives `proxy.ts`, `requirePrincipal`/`needsMfa`, the audit export, and the
  agent API.
- The `admin-create-user` Edge Function accepts a Super Admin at `aal1` only when that Super Admin
  has no verified factor.

## Risk
A stolen password is now enough to act as a Notaris or Super Admin whose account has no second
factor, including finalizing and numbering akta. The Keamanan page recommends 2FA for those roles.
Making it mandatory again means restoring the role check in `private.mfa_ok()` and the app.
