"""Jadwal, Dokumen, Transfer Protokol and Dasar Hukum: access rules and immutability."""

import datetime as dt

import psycopg
import pytest

forbidden = pytest.raises(psycopg.errors.InsufficientPrivilege)
SOON = dt.datetime.now(dt.UTC) + dt.timedelta(days=1)


def test_schedule_visibility(world):
    andi = world.as_(world.andi)
    andi.run("insert into public.schedules (berkas_id, kind, title, starts_at) values (%s, 'penandatanganan', 'TTD PT', %s)",
             (world.berkas_pt, SOON))
    andi.run("insert into public.schedules (kind, title, starts_at) values ('internal', 'Rapat mingguan', %s)", (SOON,))
    assert {r["title"] for r in andi.all("select title from public.schedules")} == {"TTD PT", "Rapat mingguan"}
    assert {r["title"] for r in world.as_(world.retno).all("select title from public.schedules")} == {"Rapat mingguan"}
    assert world.as_(world.bambang).all("select title from public.schedules") == []
    assert world.as_(world.assoc).all("select title from public.schedules") == []


def test_only_creator_or_notaris_deletes_schedule(world):
    sid = world.as_(world.andi).one(
        "insert into public.schedules (kind, title, starts_at) values ('internal', 'Rapat', %s) returning id", (SOON,))
    world.as_(world.retno).run("delete from public.schedules where id = %s", (sid,))
    assert world.as_(world.andi).one("select count(*) from public.schedules") == 1
    world.as_(world.sari).run("delete from public.schedules where id = %s", (sid,))
    assert world.as_(world.andi).one("select count(*) from public.schedules") == 0


def register(actor, world, berkas, path=None):
    path = path or f"{world.notary}/{berkas}/f1/ktp.pdf"
    return actor.one("select public.register_document(%s, null, 'ktp', 'KTP Laras', 'ktp.pdf', %s, 'application/pdf', 1000)",
                     (berkas, path))


def test_documents_follow_berkas_and_are_immutable(world, conn):
    did = register(world.as_(world.andi), world, world.berkas_pt)
    assert len(world.as_(world.sari).all("select id from public.documents")) == 1
    assert world.as_(world.retno).all("select id from public.documents") == []
    assert world.as_(world.bambang).all("select id from public.documents") == []
    with forbidden:
        register(world.as_(world.retno), world, world.berkas_pt)
    conn.execute("savepoint s")
    with pytest.raises(psycopg.errors.InsufficientPrivilege, match="append-only"):
        conn.execute("delete from public.documents where id = %s", (did,))
    conn.execute("rollback to savepoint s")


def test_document_path_must_match_berkas(world):
    with pytest.raises(psycopg.errors.CheckViolation):
        register(world.as_(world.andi), world, world.berkas_pt, path=f"{world.notary}/{world.berkas_ajb}/x/a.pdf")


def test_document_access_is_logged(world, conn):
    did = register(world.as_(world.andi), world, world.berkas_pt)
    path = world.as_(world.sari).one("select public.log_document_access(%s)", (did,))
    assert path.endswith("/ktp.pdf")
    row = conn.execute("select action, actor_user_id from public.audit_log order by id desc limit 1").fetchone()
    assert row == {"action": "document.read", "actor_user_id": world.sari}
    with forbidden:
        world.as_(world.retno).one("select public.log_document_access(%s)", (did,))


def test_protokol_transfers_notaris_only(world):
    sql = ("insert into public.protokol_transfers (source_notaris_name, handover_date, akta_count, year_range) "
           "values ('Notaris Ahmad Dahlan, S.H.', current_date, 3482, '1998-2024') returning id")
    with forbidden:
        world.as_(world.andi).one(sql)
    pid = world.as_(world.sari).one(sql)
    assert len(world.as_(world.andi).all("select id from public.protokol_transfers")) == 1
    world.as_(world.sari).run("update public.protokol_transfers set status = 'diterima' where id = %s", (pid,))
    with pytest.raises(psycopg.errors.InsufficientPrivilege, match="sudah diterima"):
        world.as_(world.sari).run("update public.protokol_transfers set akta_count = 1 where id = %s", (pid,))


def test_protokol_not_for_firm_tenant(world, conn):
    conn.execute("update public.tenant_members set role = 'notaris' where user_id = %s", (world.partner,))
    with pytest.raises(psycopg.errors.CheckViolation):
        world.as_(world.partner).one(
            "insert into public.protokol_transfers (source_notaris_name, handover_date) values ('X Y', current_date) returning id")


def test_legal_reference_verification_rules(world):
    andi = world.as_(world.andi)
    rid = andi.one(
        "insert into public.legal_references (category, number_label, title, year, verified_by, verified_at) "
        "values ('undang_undang', 'UU 2/2014', 'Perubahan atas UU Jabatan Notaris', 2014, %s, now()) returning id",
        (world.andi,))
    assert andi.one("select verified_by from public.legal_references where id = %s", (rid,)) is None
    with forbidden:
        andi.run("select public.verify_legal_reference(%s)", (rid,))
    world.as_(world.sari).run("select public.verify_legal_reference(%s)", (rid,))
    assert world.as_(world.bambang).one("select verified_by from public.legal_references where id = %s", (rid,)) == world.sari
    # Staff can no longer edit a verified entry; the Notaris can, and editing clears verification.
    andi.run("update public.legal_references set title = 'Diubah staf' where id = %s", (rid,))
    assert andi.one("select title from public.legal_references where id = %s", (rid,)) != "Diubah staf"
    world.as_(world.sari).run("update public.legal_references set year = 2015 where id = %s", (rid,))
    assert andi.one("select verified_by from public.legal_references where id = %s", (rid,)) is None


def test_bookmarks_are_private(world):
    rid = world.as_(world.andi).one(
        "insert into public.legal_references (category, number_label, title) values ('undang_undang', 'UU 30/2004', 'UUJN') returning id")
    world.as_(world.andi).run("insert into public.legal_bookmarks (reference_id) values (%s)", (rid,))
    assert world.as_(world.retno).all("select * from public.legal_bookmarks") == []
    assert len(world.as_(world.andi).all("select * from public.legal_bookmarks")) == 1
