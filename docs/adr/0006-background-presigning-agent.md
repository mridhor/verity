# ADR 0006: Background pre-signing checks; akta status stays manual

Date: 2026-09-26. Status: accepted.

The owner wants the agent to keep working when the Notaris is not in the office: before a
scheduled signing it should check the berkas, report, and prepare what it can. The owner also
decided that verifying an akta and acting on it are sensitive and stay manual for the Notaris.

## Decision
- **The agent no longer proposes akta status changes.** `akta.submit_verification` and
  `akta.approve_for_signing` are removed from `approval_policies`, so `create_proposed_changes`
  rejects them, and pending proposals of that kind were expired. In chat, the agent explains what
  is missing and links to the akta page. The tier machinery stays for future operations.
- **Pre-signing checks run in the background.**
  - `pg_cron` runs `private.run_presigning_checks()` hourly (job `verity-presigning`).
  - Every `penandatanganan` appointment of an active berkas gets one check at H-3 and one at H-1.
  - Moving the appointment gives a new signing time, which is checked again.
  - Members can also run a check from the schedule ("Periksa sekarang",
    `public.run_presigning_check`).
- **What is checked (data only, no legal rules, rule 8):**
  - akta that are not final yet (their status is reported, never changed)
  - parties with no NIK, address or NIB
  - no KTP (or passport) on file, matched by name the same way as the chat skill
  - open checklist items due by the signing day
- **What it produces:**
  - a message in the berkas conversation, in the same event contract as the chat agent
  - notifications to the berkas team and the akta officials
  - checklist proposals for missing identity documents, decided by a person
- **Identity:**
  - It acts with the rights of the person in charge of the berkas, using simulated claims marked
    `verity_actor = 'agent'`.
  - The audit log records `actor_type = agent` and `on_behalf_of`.
  - The access token hook drops that claim from real tokens, so no user can forge it.
- **It never** changes akta, parties or documents, and never finalizes, numbers or signs.
  Signing remains in person (UUJN), and finalization remains the Notaris's own action.

## Not yet
- Checks that need a language model or reading document contents (OCR).
- Legal requirement rules, for example witness counts per akta type, until confirmed by a Notaris.
- Push or e-mail delivery; notifications are in-app only.
