"""Rules 2 and 6: akta lifecycle, numbering only at finalization, append-only registers."""

import datetime as dt

import psycopg
import pytest

forbidden = pytest.raises(psycopg.errors.InsufficientPrivilege)
TODAY = dt.date.today()


def test_staff_creates_draft_in_assigned_berkas(world):
    andi = world.as_(world.andi)
    row = andi.all(
        "insert into public.akta (berkas_id, official_id, akta_type, title) values (%s, %s, 'Pendirian PT', 'PT Uji') "
        "returning tenant_id, appointment::text, status::text, number",
        (world.berkas_pt, world.off_notaris),
    )[0]
    assert row == {"tenant_id": world.notary, "appointment": "notaris", "status": "draft", "number": None}


def test_staff_cannot_create_akta_in_unassigned_berkas(world):
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        world.as_(world.andi).run(
            "insert into public.akta (berkas_id, official_id, akta_type, title) values (%s, %s, 'AJB', 'x')",
            (world.berkas_ajb, world.off_ppat),
        )


def test_super_admin_cannot_create_or_read_akta(world):
    world.akta(world.berkas_pt)
    admin = world.as_(world.bambang)
    assert admin.all("select id from public.akta") == []
    with forbidden:
        admin.run(
            "insert into public.akta (berkas_id, official_id, akta_type, title) values (%s, %s, 'AJB', 'x')",
            (world.berkas_pt, world.off_notaris),
        )


def test_number_and_status_cannot_be_set_directly(world, conn):
    aid = world.akta(world.berkas_pt)
    with forbidden:
        world.as_(world.andi).run("update public.akta set status = 'selesai', number = 1 where id = %s", (aid,))
    # Even the table owner goes through the guard trigger.
    conn.execute("savepoint s")
    with pytest.raises(psycopg.errors.InsufficientPrivilege, match="alur status"):
        conn.execute("update public.akta set status = 'verifikasi' where id = %s", (aid,))
    conn.execute("rollback to savepoint s")


def test_staff_may_submit_but_only_notaris_moves_to_signing(world):
    aid = world.akta(world.berkas_pt, parties=[world.person("Rahmat Hidayat")])
    andi = world.as_(world.andi)
    andi.run("select public.transition_akta_status(%s, 'verifikasi')", (aid,))
    with forbidden:
        andi.run("select public.transition_akta_status(%s, 'menunggu_ttd')", (aid,))
    with forbidden:
        world.as_(world.sari, aal="aal1").run("select public.transition_akta_status(%s, 'menunggu_ttd')", (aid,))
    world.as_(world.sari).run("select public.transition_akta_status(%s, 'menunggu_ttd')", (aid,))
    history = world.as_(world.sari).all(
        "select from_status::text, to_status::text from public.akta_status_history where akta_id = %s order by id", (aid,)
    )
    assert history == [
        {"from_status": "draft", "to_status": "verifikasi"},
        {"from_status": "verifikasi", "to_status": "menunggu_ttd"},
    ]


def test_signing_requires_a_party(world):
    aid = world.akta(world.berkas_pt)
    sari = world.as_(world.sari)
    sari.run("select public.transition_akta_status(%s, 'verifikasi')", (aid,))
    with pytest.raises(psycopg.errors.CheckViolation):
        sari.run("select public.transition_akta_status(%s, 'menunggu_ttd')", (aid,))


def test_selesai_only_through_finalize(world):
    aid = world.akta(world.berkas_pt, parties=[world.person("Rahmat Hidayat")])
    world.ready_for_signing(aid)
    with pytest.raises(psycopg.errors.InvalidParameterValue):
        world.as_(world.sari).run("select public.transition_akta_status(%s, 'selesai')", (aid,))


def test_finalize_numbers_sequentially_and_writes_registers(world):
    laras, rahmat = world.person("Laras Anggraini"), world.person("rahmat hidayat")
    first = world.akta(world.berkas_pt, parties=[rahmat, laras], title="Pendirian PT Sinar Kopi Nusantara")
    second = world.akta(world.berkas_pt, parties=[laras], title="Perubahan AD")
    for a in (first, second):
        world.ready_for_signing(a)
    sari = world.as_(world.sari)
    assert sari.all("select * from public.finalize_akta(%s, %s)", (first, TODAY)) == [
        {"akta_number": 1, "period": str(TODAY.year)}
    ]
    assert sari.all("select * from public.finalize_akta(%s, %s)", (second, TODAY))[0]["akta_number"] == 2

    rep = sari.all("select entry_no, akta_number, parties_summary from public.repertorium_entries order by entry_no")
    assert rep == [
        {"entry_no": 1, "akta_number": 1, "parties_summary": "rahmat hidayat; Laras Anggraini"},
        {"entry_no": 2, "akta_number": 2, "parties_summary": "Laras Anggraini"},
    ]
    kl = sari.all("select indexed_name, initial_letter, akta_number from public.klapper_entries order by akta_number, indexed_name")
    assert [(k["initial_letter"], k["akta_number"]) for k in kl] == [("L", 1), ("R", 1), ("L", 2)]


def test_ppat_has_its_own_sequence(world):
    notaris_akta = world.akta(world.berkas_pt, parties=[world.person("Ahmad Fauzi")])
    ppat_akta = world.akta(world.berkas_pt, official=world.off_ppat, parties=[world.person("Budi Santoso")])
    for a in (notaris_akta, ppat_akta):
        world.ready_for_signing(a)
    sari = world.as_(world.sari)
    assert sari.one("select akta_number from public.finalize_akta(%s, %s)", (notaris_akta, TODAY)) == 1
    assert sari.one("select akta_number from public.finalize_akta(%s, %s)", (ppat_akta, TODAY)) == 1


@pytest.mark.parametrize("who,aal", [("andi", "aal2"), ("sari", "aal1")])
def test_finalize_needs_official_with_mfa(world, who, aal):
    aid = world.akta(world.berkas_pt, parties=[world.person("Ahmad Fauzi")])
    world.ready_for_signing(aid)
    with forbidden:
        world.as_(getattr(world, who), aal=aal).run("select public.finalize_akta(%s, %s)", (aid, TODAY))


def test_finalize_rejects_future_date(world):
    aid = world.akta(world.berkas_pt, parties=[world.person("Ahmad Fauzi")])
    world.ready_for_signing(aid)
    with pytest.raises(psycopg.errors.InvalidParameterValue):
        world.as_(world.sari).run("select public.finalize_akta(%s, %s)", (aid, TODAY + dt.timedelta(days=2)))


def test_failed_finalize_consumes_no_number(world):
    a1 = world.akta(world.berkas_pt, parties=[world.person("Ahmad Fauzi")])
    a2 = world.akta(world.berkas_pt, parties=[world.person("Budi Santoso")])
    world.ready_for_signing(a1)
    world.ready_for_signing(a2)
    sari = world.as_(world.sari)
    with pytest.raises(psycopg.errors.InvalidParameterValue):
        sari.run("select public.finalize_akta(%s, %s)", (a1, TODAY + dt.timedelta(days=5)))
    assert sari.one("select akta_number from public.finalize_akta(%s, %s)", (a1, TODAY)) == 1
    assert sari.one("select akta_number from public.finalize_akta(%s, %s)", (a2, TODAY)) == 2


def test_final_akta_is_immutable_and_registers_append_only(world, conn):
    aid = world.akta(world.berkas_pt, parties=[world.person("Ahmad Fauzi")])
    world.ready_for_signing(aid)
    world.as_(world.sari).run("select public.finalize_akta(%s, %s)", (aid, TODAY))
    for stmt in (
        "update public.akta set number = 99 where id = %s",
        "update public.repertorium_entries set title = 'x' where akta_id = %s",
        "delete from public.klapper_entries where akta_id = %s",
    ):
        conn.execute("savepoint s")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute(stmt, (aid,))
        conn.execute("rollback to savepoint s")
    for role in ("authenticated", "service_role"):
        conn.execute("savepoint s")
        conn.execute(f"set local role {role}")
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute("delete from public.repertorium_entries")
        conn.execute("rollback to savepoint s")


def test_parties_locked_after_submission_for_signing(world):
    aid = world.akta(world.berkas_pt, parties=[world.person("Ahmad Fauzi")])
    world.ready_for_signing(aid)
    with pytest.raises(psycopg.errors.InsufficientPrivilege, match="terkunci"):
        world.as_(world.andi).run(
            "insert into public.akta_parties (akta_id, person_id, role) values (%s, %s, 'saksi')",
            (aid, world.person("Budi Santoso")),
        )


def test_only_numberless_drafts_can_be_deleted(world):
    draft = world.akta(world.berkas_pt)
    final = world.akta(world.berkas_pt, parties=[world.person("Ahmad Fauzi")])
    world.ready_for_signing(final)
    world.as_(world.sari).run("select public.finalize_akta(%s, %s)", (final, TODAY))
    andi = world.as_(world.andi)
    andi.run("delete from public.akta where id in (%s, %s)", (draft, final))
    remaining = {r["id"] for r in world.as_(world.sari).all("select id from public.akta")}
    assert remaining == {final}


def test_correction_adds_entry_and_keeps_original(world):
    aid = world.akta(world.berkas_pt, parties=[world.person("Ahmad Fauzi")])
    world.ready_for_signing(aid)
    sari = world.as_(world.sari)
    sari.run("select public.finalize_akta(%s, %s)", (aid, TODAY))
    original = sari.one("select id from public.repertorium_entries where akta_id = %s", (aid,))
    with forbidden:
        world.as_(world.andi).run("select public.correct_repertorium_entry(%s, 'salah ketik nama')", (original,))
    sari.run("select public.correct_repertorium_entry(%s, 'salah ketik nama pihak')", (original,))
    rows = sari.all("select source, corrects_entry_id from public.repertorium_entries order by created_at, source")
    assert {(r["source"], r["corrects_entry_id"]) for r in rows} == {("system", None), ("correction", original)}


def test_register_visibility_follows_berkas(world):
    aid = world.akta(world.berkas_ajb, official=world.off_ppat, parties=[world.person("Budi Santoso")])
    world.ready_for_signing(aid)
    world.as_(world.sari).run("select public.finalize_akta(%s, %s)", (aid, TODAY))
    assert len(world.as_(world.retno).all("select id from public.klapper_entries")) == 1
    assert world.as_(world.andi).all("select id from public.klapper_entries") == []
    assert world.as_(world.bambang).all("select id from public.repertorium_entries") == []


def test_persons_are_tenant_scoped_and_hidden_from_super_admin(world):
    world.person("Laras Anggraini", nik="3174055707910004")
    assert len(world.as_(world.andi).all("select id from public.persons")) == 1
    assert world.as_(world.assoc).all("select id from public.persons") == []
    assert world.as_(world.bambang).all("select id from public.persons") == []
    with pytest.raises(psycopg.errors.UniqueViolation):
        world.as_(world.retno).run(
            "insert into public.persons (full_name, nik) values ('Laras A.', '3174055707910004')"
        )


def test_audit_records_ids_not_content(world, conn):
    world.as_(world.andi).run(
        "insert into public.persons (full_name, nik) values ('Rahasia Klien', '3174010303880002')"
    )
    row = conn.execute("select action, details::text as d from public.audit_log order by id desc limit 1").fetchone()
    assert row["action"] == "persons.insert"
    assert "Rahasia" not in row["d"] and "3174010303880002" not in row["d"]


def test_checklist_follows_berkas_and_stamps_completion(world):
    andi = world.as_(world.andi)
    cid = andi.one("insert into public.checklist_items (berkas_id, title) values (%s, 'KTP pendiri') returning id",
                   (world.berkas_pt,))
    andi.run("update public.checklist_items set done = true where id = %s", (cid,))
    row = andi.all("select done_by, done_at is not null as stamped from public.checklist_items where id = %s", (cid,))[0]
    assert row == {"done_by": world.andi, "stamped": True}
    assert world.as_(world.retno).all("select id from public.checklist_items") == []
