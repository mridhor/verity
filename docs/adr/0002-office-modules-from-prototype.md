# ADR 0002: Office modules from the earlier prototype

Date: 2026-09-25. Status: accepted.

The owner asked for every module of `docs/old-version/old.jsx` to exist in the real app. They are
built on the approved design (`docs/design/berkas-workspace.jsx`, TRD §8) and on the PLAN.md
rules, not on the prototype's navy/gold look or its in-memory behaviour.

| Prototype module | Built as | Where |
| --- | --- | --- |
| Dashboard | Beranda: counts, finalized akta per month, status mix, recent akta, today's schedule, archive summary. All from real data under RLS | `/beranda` |
| Manajemen Akta | Akta list (status filter, search), new draft, detail with status flow, parties, finalization | `/akta` |
| Jadwal | Agenda grouped by date, kind filter, create, delete | `/jadwal` |
| Buku Klapper Digital | A–Z index generated from final akta, detail panel | `/register/klapper` |
| (not in prototype) | Repertorium per official and year, corrections as new entries | `/register/repertorium` |
| Minuta Akta | Upload to private storage, type/format filters, logged downloads | `/dokumen`, berkas "Dokumen" tab |
| Protokol Notaris | Handover records from other notaries; Notaris-only writes | `/protokol` |
| Portal Dasar Hukum | Categories, search, bookmarks, Notaris verification | `/dasar-hukum` |
| Manajemen Pengguna | Existing Pengguna page plus official appointments | `/admin/pengguna` |
| Audit Log | Search, module filter, CSV export, hash-chain status | `/admin/audit` |
| Keamanan | Real account and system status (no simulated score) | `/keamanan` |
| Topbar notifications | Date and notification bell | all pages |

## Prototype behaviour deliberately changed
- **Akta number** is not typed or generated at creation. It is assigned only by `finalize_akta()`
  (Notaris, MFA, official of the akta), sequential per official and appointment per year, in one
  locked transaction that also writes repertorium and klapper (PRD-R-03, rule 6).
- **No editing or deleting of numbered akta.** Only numberless drafts can be deleted. Registers,
  status history, documents and the audit log are append-only in the database.
- **Status cannot be advanced by anyone.** Staff may submit a draft for verification and withdraw
  it; approval for signing, returning from signing and archiving are Notaris-only.
- **2FA cannot be switched off** for Notaris, Partner and Super Admin (REQ-GW-05).
- **Users cannot be deleted** from the UI; they are deactivated (audit trail stays intact).
- **Legal references are not seeded with the prototype's sample entries**, some of which could not
  be confirmed to exist. The seed holds ten well-known statutes, all marked "belum terverifikasi".
- **Super Admin sees no client content** (akta, persons, documents, schedules), per PLAN.md C-17.

## Open points that affect these modules
- Number format and reset period (currently `001/2026`, yearly): PLAN.md N-01.
- Which parties go into the klapper (currently all except witnesses): N-04.
- Retention of documents; they cannot be deleted in the app at all yet: N-07.
- Hash chains on registers (the audit log has one; registers rely on append-only triggers for now).
- NIK is stored in plain text under RLS; column encryption with a blind index is still planned
  (NFR-SEC-04).
- Exporting the audit log is not itself audited yet.
