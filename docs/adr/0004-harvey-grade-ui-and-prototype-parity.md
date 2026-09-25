# ADR 0004: Harvey-grade UI, performance, and prototype parity

Date: 2026-09-26. Status: accepted.

The owner asked for a UI/UX at the level of harvey.ai, the rest of the prototype's features
(`docs/old-version/old.jsx`), popups for every create and edit action, data in every page, and
whether Redis is needed. Nothing that existed was removed.

## Visual language (packages/tokens/tokens.css, components/ui/*)
- A stone canvas (`--background`) with the work surface as a white, rounded panel; the sidecar is
  its own rounded panel.
- Serif titles (Newsreader, weight 400, tight tracking) and large serif figures.
- Soft-filled stat cards, airy tables with a rounded header bar, and status pills with a dot:
  draft grey, verification blue, awaiting signature amber, final green.
- Violet stays reserved for authority: citations, approvals, the stamp, the active workflow step,
  and Notaris/PPAT roles and appointments.
- Every create and edit action opens a centred dialog (`components/ui/dialog.tsx`, native
  `<dialog>`). Irreversible actions use `ConfirmAction`. Single records are shown in a right-hand
  sheet (`components/ui/sheet.tsx`), for example the document preview.
- Page-specific updates:
  - Beranda: the "perlu tindakan" command banner
  - Berkas: list shown as cards, and a detail header with a monogram and pill tabs
  - Agent: steps shown as a progress checklist
  - Sidebar: folds into an icon rail

## Performance: no Redis
The slowness came from distance, not a missing cache: Vercel functions ran in iad1 while the
database is in ap-southeast-1.

What changed:
- `apps/web/vercel.json` pins functions to `sin1`.
- The Supabase client and the principal are cached per request.
- The shell makes fewer queries, and the bell loads its content only when opened.
- `loading.tsx` shows skeletons while a page loads.
- Agent threads load only when a conversation is visible.

Why Redis was rejected:
- It would not fix the cross-region latency.
- A shared cache would sit outside RLS, so one user could be served another user's rows.
- A hosted Redis would put client data with a third party outside Indonesia (rule 9).

## Features added from the prototype
- **Pengguna**
  - Email, last sign-in, counts per role, search, and editing the display name, role and status.
  - Account creation with an initial password through the `admin-create-user` Edge Function. The
    secret key stays on Supabase. Only a Super Admin with 2FA may call it, and the user must set
    their own password at first sign-in.
- **Keamanan**
  - Office session timeout from 1 to 24 hours, enforced in the proxy from the `amr` sign-in time.
  - Count of active sessions, and revoking all sessions in the office.
  - The yearly akta target.
  - Turning 2FA off, only for roles where it is optional.
- **Audit**
  - Sign-in, sign-out, 2FA verification and password changes are logged.
  - A content-free "Detail" column and a total count.
- **Notifikasi**
  - Stored notifications: akta awaiting signature, returned or finalized, and new agent proposals.
  - Reminders: today's schedule, checklist items due or late, and akta awaiting signature.
- **Other pages**
  - Dokumen: inline preview (logged), the akta number shown and searchable, and four summary cards.
  - Dasar hukum: a detail page, with an attached PDF and logged downloads.
  - Akta: search by number and party, and counts per status.
  - Login: "Ingat saya". When it is off, the auth cookies last only until the browser closes.

## Synthetic demo data
`supabase/demo/seed.mjs` writes data straight into Supabase through the real RPCs, with simulated
member claims: numbering, registers, status history, notifications and the audit chain all come
out as in real use. All names, NIK (prefix 99) and files are fictitious. It runs once per office.

## Still intentionally absent
- A topbar page title: the title is in the page header.
- A simulated security score, and backup or firewall status (the app cannot observe them).
- Deleting users or numbered akta.
